// Lokasi: netlify/functions/telegram-notify.js
const axios = require('axios');
const admin = require('firebase-admin'); // Tambahkan firebase-admin

// Inisialisasi Firebase (WAJIB ADA)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_URL,
  });
}

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, device = 'device1' } = JSON.parse(event.body);

        const token = (device === 'device2')
            ? process.env.TELEGRAM_BOT_TOKEN_DEVICE2
            : process.env.TELEGRAM_BOT_TOKEN;

        const chatIdsString = (device === 'device2')
            ? process.env.TELEGRAM_CHAT_ID_DEVICE2
            : process.env.TELEGRAM_CHAT_ID;

        if (!token || !chatIdsString) {
            throw new Error('Telegram credentials for ' + device + ' are not configured.');
        }
        
        const chatIds = chatIdsString.split(',');
        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        // Loop melalui setiap pengguna yang terdaftar
        for (const chatId of chatIds) {
            const trimmedChatId = chatId.trim();
            if (trimmedChatId) {
                // --- PERUBAHAN UTAMA: Cek status pause untuk pengguna ini ---
                const pauseRef = admin.database().ref(`devices/${device}/control/autoPausePerChat/${trimmedChatId}`);
                const snapshot = await pauseRef.once('value');
                const isPaused = snapshot.val() === true;

                // Hanya kirim notifikasi jika pengguna TIDAK sedang dalam mode pause
                if (!isPaused) {
                    try {
                        await axios.post(url, {
                            chat_id: trimmedChatId,
                            text: message,
                            parse_mode: 'HTML'
                        });
                    } catch (e) {
                        console.warn(`Failed to send message to ${trimmedChatId}:`, e.message);
                    }
                }
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, message: "Notifications sent to active users." })
        };
    } catch (error) {
        console.error("Telegram function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};