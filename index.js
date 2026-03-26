const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const ytSearch = require("yt-search");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const logger = pino({ level: "error" });
const authDir = path.join(process.cwd(), "auth_info");

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

const menu = `
╭─────────────────────────────╮
│   🤖 *RAZA BOT MENU*        │
├─────────────────────────────┤
│                             │
│ 📋 *Commands:*              │
│                             │
│ .menu → Show this menu      │
│ .ping → Check bot status    │
│ .yt <query> → Search YouTube│
│                             │
│ Hi/Hello/Hey → Get greeting │
│                             │
╰─────────────────────────────╯
`;

// Function to get phone number from user
async function getPhoneNumber() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("\n📱 Enter your WhatsApp phone number (with country code, e.g., +1234567890):\n→ ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function startBot() {
  console.log("\n╔═════════════════════════════════╗");
  console.log("║   🤖 RAZA BOT - STARTING...     ║");
  console.log("╚═════════════════════════════════╝\n");

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      logger: logger,
      printQRInTerminal: false,
      browser: Browsers.chrome("120"),
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
    });

    // Handle pairing code login
    if (!state.creds.me) {
      console.log("╭─────────────────────────────╮");
      console.log("│  📌 FIRST TIME LOGIN ONLY    │");
      console.log("╰─────────────────────────────╯");
      
      const phoneNumber = await getPhoneNumber();
      
      console.log("\n⏳ Requesting pairing code...\n");
      const code = await sock.requestPairingCode(phoneNumber);
      
      console.log("╔═════════════════════════════════╗");
      console.log("║  📱 YOUR PAIRING CODE:          ║");
      console.log("╟─────────────────────────────────╢");
      console.log(`║  ${code}                   ║`);
      console.log("╟─────────────────────────────────╢");
      console.log("║  Steps:                         ║");
      console.log("║  1. Open WhatsApp on phone      ║");
      console.log("║  2. Go to Settings → Devices    ║");
      console.log("║  3. Link a Device               ║");
      console.log("║  4. Enter this code             ║");
      console.log("║  5. Wait for connection ✅      ║");
      console.log("╚═════════════════════════════════╝\n");
    }

    // Connection update handler
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, isOnline } = update;

      if (connection === "close") {
        const shouldReconnect = 
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut &&
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.connectionClosed;

        console.log("❌ Connection closed:", lastDisconnect?.error?.output?.statusCode);

        if (shouldReconnect) {
          console.log("🔄 Reconnecting in 3 seconds...\n");
          setTimeout(startBot, 3000);
        } else {
          console.log("🛑 Logged out. Please restart bot.\n");
          process.exit(1);
        }
      }

      if (connection === "connecting") {
        console.log("⏳ Connecting to WhatsApp...");
      }

      if (connection === "open") {
        console.log("✅ Connected successfully!\n");
        console.log("╔═════════════════════════════════╗");
        console.log("║ 🎉 BOT IS READY TO USE! 🎉     ║");
        console.log("╚═════════════════════════════════╝\n");
      }

      if (isOnline === true) {
        console.log("🟢 Bot is online!");
      } else if (isOnline === false) {
        console.log("🔴 Bot is offline!");
      }
    });

    // Credentials updated handler
    sock.ev.on("creds.update", saveCreds);

    // Messages handler
    sock.ev.on("messages.upsert", async (m) => {
      try {
        const message = m.messages[0];

        // Ignore if no message text or from bot itself
        if (!message.message || message.key.fromMe) return;

        const text = (message.message.conversation || message.message.extendedTextMessage?.text || "").trim();
        const sender = message.key.remoteJid;
        const isGroup = sender.endsWith("@g.us");
        const senderName = message.pushName || "User";

        if (!text) return;

        // Log incoming message
        const chatType = isGroup ? "GROUP" : "PRIVATE";
        console.log(`\n📨 [${chatType}] ${senderName}:`);
        console.log(`   💬 ${text}\n`);

        // Simple greeting
        if (text.toLowerCase() === "hi" || text.toLowerCase() === "hello" || text.toLowerCase() === "hey") {
          await sock.sendMessage(sender, { text: "Hello 👋" });
          console.log("✅ Sent: Hello 👋");
          return;
        }

        // Menu command
        if (text === ".menu" || text === ".Menu") {
          await sock.sendMessage(sender, { text: menu });
          console.log("✅ Sent: Menu");
          return;
        }

        // Ping command
        if (text === ".ping" || text === ".Ping") {
          await sock.sendMessage(sender, { text: "pong 🏓" });
          console.log("✅ Sent: pong 🏓");
          return;
        }

        // YouTube search command
        if (text.startsWith(".yt ") || text.startsWith(".yt")) {
          const query = text.slice(4).trim();

          if (!query) {
            await sock.sendMessage(sender, {
              text: "❌ Please provide a search query.\n\n*Usage:* .yt nodejs tutorial",
            });
            console.log("✅ Sent: Error message - no query");
            return;
          }

          // Send searching message
          const searchMsg = await sock.sendMessage(sender, { text: "🔍 Searching YouTube..." });
          console.log("🔍 Searching for:", query);

          try {
            const results = await ytSearch(query);

            if (!results.videos || results.videos.length === 0) {
              await sock.sendMessage(sender, { text: "❌ No results found for: " + query });
              console.log("❌ No YouTube results");
              return;
            }

            const video = results.videos[0];
            const response = `🎬 *YouTube Search Result*

📹 *Title:* ${video.title}
🔗 *Link:* ${video.url}
⏱️ *Duration:* ${video.duration}
👁️ *Views:* ${video.views}
📅 *Uploaded:* ${video.uploadedAt}
👤 *Channel:* ${video.author.name}`;

            await sock.sendMessage(sender, { text: response });
            console.log("✅ Sent: YouTube result");
          } catch (error) {
            console.error("🔴 YouTube search error:", error.message);
            await sock.sendMessage(sender, {
              text: "❌ Error searching YouTube. Please try again later.",
            });
          }
          return;
        }

      } catch (error) {
        console.error("🔴 Message handler error:", error.message);
      }
    });

  } catch (error) {
    console.error("🔴 Bot startup error:", error.message);
    console.log("🔄 Retrying in 5 seconds...\n");
    setTimeout(startBot, 5000);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Bot shutting down...");
  process.exit(0);
});

// Start the bot
startBot().catch(console.error);
