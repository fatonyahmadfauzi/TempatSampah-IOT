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

// Fungsi untuk mengirim balasan PRIBADI ke pengguna
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

// Fungsi untuk memeriksa status online perangkat (tetap sama)
async function isDeviceOnline(deviceId) {
  try {
    const snapshot = await admin.database().ref(`devices/${deviceId}/data`).orderByKey().limitToLast(1).once('value');
    const data = snapshot.val();
    if (!data) return false;

    // Menyesuaikan dengan struktur baru yang lebih dalam
    const dateKey = Object.keys(data)[0];
    const uniqueKey = Object.keys(data[dateKey])[0];
    const pushIdKey = Object.keys(data[dateKey][uniqueKey])[0];
    const lastDataEntry = data[dateKey][uniqueKey][pushIdKey];
    const lastTimestamp = lastDataEntry.timestamp;

    if (!lastTimestamp) return false;

    const lastDataTime = new Date(lastTimestamp).getTime();
    const now = new Date().getTime();
    const timeDifference = (now - lastDataTime) / 1000;

    return timeDifference <= 120; // Anggap offline jika lebih dari 2 menit
  } catch (error) {
    console.error(`Error checking device status for ${deviceId}:`, error);
    return false;
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

    if (text.startsWith('/pause') || text.startsWith('/resume')) {
        const match = text.match(/\/(pause|resume)(\d*)/);
        if (match) {
            command = match[1];
            const deviceNumber = match[2] || '1';
            deviceId = `device${deviceNumber}`;
            botToken = (deviceId === 'device2') ? process.env.TELEGRAM_BOT_TOKEN_DEVICE2 : process.env.TELEGRAM_BOT_TOKEN;
        }
    } else {
        return { statusCode: 200, body: 'OK' };
    }
    
    const online = await isDeviceOnline(deviceId);

    if (!online) {
      const offlineMessage = `⚠️ <b>Perintah Gagal</b> ⚠️\n\nPerangkat ${deviceId.toUpperCase()} terdeteksi sedang <b>OFFLINE</b>. Perintah tidak dapat diproses.`;
      await sendTelegramReply(chatId, offlineMessage, botToken);
      return { statusCode: 200, body: 'Device is offline, notification sent.' };
    }
    
    const isPausing = (command === 'pause');
    
    // --- PERUBAHAN UTAMA: Menyimpan status pause di bawah ID pengguna ---
    const firebasePath = `devices/${deviceId}/control/autoPausePerChat/${chatId}`;
    await admin.database().ref(firebasePath).set(isPausing);

    const successMessage = `✅ <b>Notifikasi Pribadi Diubah</b> ✅\n\nNotifikasi untuk Anda dari <b>${deviceId.toUpperCase()}</b> telah diatur ke: <b>${isPausing ? 'PAUSED' : 'ACTIVE'}</b>.`;
    await sendTelegramReply(chatId, successMessage, botToken);

    return { statusCode: 200, body: 'Command processed successfully.' };

  } catch (error) {
    console.error("Webhook Error:", error);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};