// Lokasi: netlify/functions/telegram-notify.js
const axios = require('axios');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, device = 'device1' } = JSON.parse(event.body);

        const token = (device === 'device2')
            ? process.env.TELEGRAM_BOT_TOKEN_DEVICE2
            : process.env.TELEGRAM_BOT_TOKEN;

        const chatIds = (device === 'device2')
            ? (process.env.TELEGRAM_CHAT_ID_DEVICE2 || '').split(',')
            : (process.env.TELEGRAM_CHAT_ID || '').split(',');

        if (!token || chatIds.length === 0) {
            throw new Error('Telegram credentials for ' + device + ' are not configured.');
        }

        // Kirim notifikasi ke setiap chat ID
        for (const chatId of chatIds) {
            if (chatId) {
                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                await axios.post(url, {
                    chat_id: chatId.trim(),
                    text: message,
                    parse_mode: 'HTML'
                });
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Telegram notification sent." })
        };
    } catch (error) {
        console.error("Telegram function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};