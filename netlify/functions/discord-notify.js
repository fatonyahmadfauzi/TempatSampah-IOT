// Lokasi: netlify/functions/discord-notify.js
const axios = require('axios');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, device = 'device1' } = JSON.parse(event.body);
        const token = process.env.DISCORD_BOT_TOKEN;

        // --- BAGIAN YANG DIPERBAIKI (SINTAKS SUDAH BENAR) ---
        const channelId = (device === 'device2')
            ? process.env.DISCORD_CHANNEL_ID_DEVICE2
            : process.env.DISCORD_CHANNEL_ID_DEVICE1;

        if (!token || !channelId) {
            throw new Error(`Discord credentials for ${device} are not configured.`);
        }

        const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
        const discordPayload = {
            embeds: [{
                color: 0x00FF00,
                title: '🔔 Notifikasi Sistem',
                description: message.replace(/<b>/g, '**').replace(/<\/b>/g, '**'),
                timestamp: new Date().toISOString(),
                footer: { text: `Sistem Monitoring - ${device.toUpperCase()}` }
            }]
        };

        await axios.post(url, discordPayload, {
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json'
            }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        console.error("Discord function error:", error.response ? error.response.data : error.message);
        return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
    }
};