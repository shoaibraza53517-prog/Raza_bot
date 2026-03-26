const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const ytSearch = require('yt-search');

const client = new Client();

client.on('qr', (qr) => {
    // Generate and show QR code
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async message => {
    const chat = await message.getChat();
    
    // Handle group and private chat
    if (message.body === '.ping') {
        message.reply('Pong!');
    }
    else if (message.body === '.menu') {
        message.reply('Menu:
1. .ping
2. .yt <search term>');
    }
    else if (message.body.startsWith('.yt')) {
        const query = message.body.split('.yt ')[1];
        try {
            const results = await ytSearch(query);
            const video = results.videos[0];
            message.reply(`Title: ${video.title}\nLink: ${video.url}`);
        } catch (error) {
            console.error(error);
            message.reply('Error while searching. Please try again.');
        }
    }
    else if (message.body.toLowerCase() === 'hi') {
        message.reply('Hello! How can I assist you today?');
    }
});

client.initialize();

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

client.on('authenticated', () => {
    console.log('Authenticated successfully!');
});
