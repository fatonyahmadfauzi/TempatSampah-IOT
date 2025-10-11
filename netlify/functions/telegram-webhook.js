// Lokasi: netlify/functions/telegram-webhook.js
const admin = require('firebase-admin');
const axios = require('axios');

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

// Fungsi untuk mengirim balasan ke Telegram
async function sendTelegramReply(chatId, text, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
    });
  } catch (error) {
    console.error("Error sending Telegram reply:", error.response ? error.response.data : error.message);
  }
}

// Fungsi untuk memeriksa status online perangkat
async function isDeviceOnline(deviceId) {
  try {
    // Mencari data terakhir berdasarkan timestamp
    const snapshot = await admin.database().ref(`devices/${deviceId}/data`).orderByChild('timestamp').limitToLast(1).once('value');
    const data = snapshot.val();

    if (!data) {
        // Jika tidak ada data sama sekali, anggap offline
        return false;
    }
    
    // Ambil timestamp dari data terakhir
    const dateKey = Object.keys(data)[0];
    const timeKey = Object.keys(data[dateKey])[0];
    const lastDataEntry = data[dateKey][timeKey];
    const lastTimestamp = lastDataEntry.timestamp;
    
    if (!lastTimestamp) return false;

    const lastDataTime = new Date(lastTimestamp).getTime();
    const now = new Date().getTime();
    const timeDifference = (now - lastDataTime) / 1000; // Selisih dalam detik

    // Jika data terakhir lebih dari 2 menit (120 detik) yang lalu, anggap offline
    return timeDifference <= 120;

  } catch (error) {
    console.error(`Error checking device status for ${deviceId}:`, error);
    return false; // Anggap offline jika terjadi error
  }
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const message = body.message || body.edited_message;

    if (!message || !message.text) {
      return { statusCode: 200, body: 'OK' };
    }

    const chatId = message.chat.id;
    const text = message.text.toLowerCase().trim();

    let command, deviceId, botToken;

    // Menentukan perintah dan device ID dari teks
    if (text.startsWith('/pause') || text.startsWith('/resume')) {
        const match = text.match(/\/(pause|resume)(\d*)/);
        if (match) {
            command = match[1]; // "pause" atau "resume"
            const deviceNumber = match[2] || '1'; // default ke device 1 jika tidak ada angka
            deviceId = `device${deviceNumber}`;
            botToken = (deviceId === 'device2') ? process.env.TELEGRAM_BOT_TOKEN_DEVICE2 : process.env.TELEGRAM_BOT_TOKEN;
        }
    } else {
        // Bukan perintah yang relevan, abaikan
        return { statusCode: 200, body: 'OK' };
    }
    
    // --- PEMERIKSAAN STATUS OFFLINE ---
    const online = await isDeviceOnline(deviceId);

    if (!online) {
      const offlineMessage = `⚠️ <b>Perintah Gagal</b> ⚠️\n\nPerangkat ${deviceId.toUpperCase()} terdeteksi sedang <b>OFFLINE</b>. Perintah tidak dapat diproses.`;
      await sendTelegramReply(chatId, offlineMessage, botToken);
      return { statusCode: 200, body: 'Device is offline, notification sent.' };
    }
    
    // --- JIKA PERANGKAT ONLINE, LANJUTKAN PROSES ---
    const isPausing = (command === 'pause');
    await admin.database().ref(`devices/${deviceId}/control/pause`).set(isPausing);

    const successMessage = `✅ <b>Perintah Berhasil</b> ✅\n\nStatus pengiriman data untuk <b>${deviceId.toUpperCase()}</b> telah diatur ke: <b>${isPausing ? 'PAUSED' : 'RESUMED'}</b>.`;
    await sendTelegramReply(chatId, successMessage, botToken);

    return { statusCode: 200, body: 'Command processed successfully.' };

  } catch (error) {
    console.error("Webhook Error:", error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};