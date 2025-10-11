// Lokasi: netlify/functions/telegram-webhook-d1.js
const admin = require('firebase-admin');
const axios = require('axios');

// --- KONFIGURASI KHUSUS UNTUK DEVICE 1 ---
const DEVICE_ID = 'device1';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// -----------------------------------------

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

async function sendTelegramReply(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, { chat_id: chatId, text: text, parse_mode: 'HTML' });
  } catch (error) {
    console.error("Error sending D1 reply:", error.message);
  }
}

async function isDeviceOnline() {
  try {
    const snapshot = await admin.database().ref(`devices/${DEVICE_ID}/data`).orderByKey().limitToLast(1).once('value');
    const data = snapshot.val();
    if (!data) return false;

    const dateKey = Object.keys(data)[0];
    const uniqueKey = Object.keys(data[dateKey])[0];
    const pushIdKey = Object.keys(data[dateKey][uniqueKey])[0];
    const lastDataEntry = data[dateKey][uniqueKey][pushIdKey];
    const lastTimestamp = lastDataEntry.timestamp;
    if (!lastTimestamp) return false;

    const timeDifference = (new Date().getTime() - new Date(lastTimestamp).getTime()) / 1000;
    return timeDifference <= 120;
  } catch (error) {
    console.error(`Error checking D1 status:`, error);
    return false;
  }
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  try {
    const body = JSON.parse(event.body);
    const message = body.message || body.edited_message;
    if (!message || !message.text) return { statusCode: 200 };

    const chatId = message.chat.id;
    const command = message.text.toLowerCase().trim();

    if (command !== '/pause' && command !== '/resume') {
      return { statusCode: 200 };
    }

    if (!(await isDeviceOnline())) {
      const offlineMessage = `⚠️ <b>Perintah Gagal</b> ⚠️\n\nPerangkat ${DEVICE_ID.toUpperCase()} terdeteksi sedang <b>OFFLINE</b>.`;
      await sendTelegramReply(chatId, offlineMessage);
      return { statusCode: 200 };
    }

    const isPausing = (command === '/pause');
    const firebasePath = `devices/${DEVICE_ID}/control/autoPausePerChat/${chatId}`;
    await admin.database().ref(firebasePath).set(isPausing);

    const successMessage = `✅ <b>Notifikasi Pribadi Diubah</b> ✅\n\nNotifikasi untuk Anda dari <b>${DEVICE_ID.toUpperCase()}</b> telah diatur ke: <b>${isPausing ? 'PAUSED' : 'ACTIVE'}</b>.`;
    await sendTelegramReply(chatId, successMessage);

    return { statusCode: 200, body: 'D1 command processed.' };
  } catch (error) {
    console.error("Webhook D1 Error:", error);
    return { statusCode: 500 };
  }
};