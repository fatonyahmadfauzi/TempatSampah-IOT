require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const morgan = require('morgan');
const moment = require('moment-timezone');
const app = express();
const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

axios.interceptors.request.use(request => {
  console.log('Request being sent:', {
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.data
  });
  return request;
});

// Tangkap error yang tidak tertangkap
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Kirim notifikasi error ke Discord
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) {
    const errorMessage = `❌ **ERROR SISTEM TIDAK TERTANGKAP**\n` +
                        `Error: ${reason.message || reason}\n` +
                        `Waktu: ${moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss")}`;
    
    sendDiscordNotification(errorMessage).catch(err => {
      console.error('Gagal mengirim notifikasi error ke Discord:', err);
    });
  }
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  
  // Kirim notifikasi error ke Discord
  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_ID) {
    const errorMessage = `💥 **ERROR KRITIS SISTEM**\n` +
                        `Error: ${error.message}\n` +
                        `Stack: ${error.stack}\n` +
                        `Waktu: ${moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss")}`;
    
    try {
      await sendDiscordNotification(errorMessage);
    } catch (err) {
      console.error('Gagal mengirim notifikasi error ke Discord:', err);
    }
  }
  
  // Tutup proses setelah 5 detik untuk memberi waktu notifikasi terkirim
  setTimeout(() => process.exit(1), 5000);
});

// Hapus bagian axios dan FIREBASE_URL yang tidak perlu
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json'); // Pastikan file ini ada

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_URL
});

const db = admin.database(); // Gunakan ini untuk semua operasi database

// In server.js, modify the data path reference:
const devicePaths = {
  device1: 'devices/device1',
  device2: 'devices/device2'
};

// Konfigurasi dari environment variables
const firebaseBase = process.env.FIREBASE_URL
  .replace('.json', '')
  .replace(/\/$/, '');
const FIREBASE_URL = `${firebaseBase}.json?auth=${process.env.FIREBASE_AUTH_TOKEN}`;
const TELEGRAM_TOKENS = {
  device1: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatIds: process.env.TELEGRAM_CHAT_ID?.split(',').map(id => id.trim()) || []
  },
  device2: {
    token: process.env.TELEGRAM_BOT_TOKEN_DEVICE2,
    chatIds: process.env.TELEGRAM_CHAT_ID_DEVICE2?.split(',').map(id => id.trim()) || []
  }
};
const PORT = process.env.PORT || 3000;

const { Client, GatewayIntentBits } = require('discord.js');
const discordBot = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ] 
});

// Bot login
discordBot.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('Discord bot logged in'))
  .catch(err => console.error('Discord login error:', err));

// Fungsi untuk kirim notifikasi ke Discord
async function sendDiscordNotification(message, device = 'device1') {
  const channelId = device === 'device2'
    ? process.env.DISCORD_CHANNEL_ID_DEVICE2
    : process.env.DISCORD_CHANNEL_ID_DEVICE1;

  if (!process.env.DISCORD_BOT_TOKEN || !channelId) {
    console.warn('Discord not properly configured');
    return false;
  }

  try {
    if (!discordBot.isReady()) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 5000);
        discordBot.once('ready', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    const channel = await discordBot.channels.fetch(channelId);
    if (!channel) throw new Error('Channel not found');

    await channel.send({
      content: '🔔 **NOTIFIKASI SISTEM** 🔔',
      embeds: [{
        color: 0x00FF00,
        title: 'Notifikasi Sistem',
        description: message,
        timestamp: new Date().toISOString(),
        footer: { text: 'Sistem Monitoring Tempat Sampah' }
      }]
    });

    return true;
  } catch (error) {
    console.error('Discord notification error:', error.message);
    return false;
  }
}

// Fungsi untuk menghitung tingkat pengisian berdasarkan jarak (distance)
function calculateFillLevel(distance) {
  if(distance <= 0) return 0; // Handle nilai invalid
  const maxHeight = 20;
  distance = Math.min(distance, maxHeight);
  return Math.round(((maxHeight - distance)/maxHeight) * 100);
}

let autoUpdatePaused = false; // Kontrol notifikasi otomatis

console.log('===== CONFIGURATION =====');
console.log('Firebase URL:', FIREBASE_URL.replace(/(auth=)[^&]+/, '$1***')); // Menyensor token untuk keamanan
console.log('Telegram Bot Device1:', TELEGRAM_TOKENS.device1.token ? 'Configured' : 'Not Configured');
console.log('Telegram Chat IDs Device1:', TELEGRAM_TOKENS.device1.chatIds.join(', ') || 'Not Configured');
console.log('Telegram Bot Device2:', TELEGRAM_TOKENS.device2.token ? 'Configured' : 'Not Configured');
console.log('Telegram Chat IDs Device2:', TELEGRAM_TOKENS.device2.chatIds.join(', ') || 'Not Configured');
console.log('=========================');

// Fungsi untuk notifikasi admin (ke semua chat)
async function sendAdminNotification(message) {
  return sendTelegramNotification(message, allowedChatIds);
}

// Fungsi untuk mengirim notifikasi ke user tertentu
async function sendUserNotification(message, chatId) {
  return sendTelegramNotification(message, [chatId]);
}

// Middleware
app.use(morgan('dev'));
// Update your CORS middleware in server.js
app.use(cors({
    origin: [
        'http://127.0.0.1:3002', 
        'http://localhost:3002',
        'https://5248-157-15-46-172.ngrok-free.app'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// Hapus ekstensi .html untuk semua route
app.get('/(.*)?', (req, res, next) => {
  let path = req.params[0];
  if (!path.includes('.') && !path.endsWith('/')) {
    res.sendFile(__dirname + '/public/' + path + '.html');
  } else {
    next();
  }
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

// Cek status pause dari Firebase
async function isPaused() {
  try {
    const snapshot = await db.ref(`devices/${device}/control/pause`).set(pause).once('value');
    return snapshot.val() === true;
  } catch (error) {
    console.error("Gagal cek status pause:", error);
    return false;
  }
}

// Initialize Firebase
async function initializeFirebase() {
  try {
    const snapshot = await db.ref('devices/device2').once('value');
    console.log('Firebase connected. Latest data:', snapshot.exists());
    
    const pauseSnapshot = await db.ref('control/autoPause').once('value');
    autoUpdatePaused = pauseSnapshot.val() === true;
    
    checkAndSendLatestData();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Call the initialization
initializeFirebase();

// Simpan daftar chat ID yang boleh menerima notifikasi
let allowedChatIds = [];
if (process.env.TELEGRAM_CHAT_ID) {
  allowedChatIds = process.env.TELEGRAM_CHAT_ID.split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

// Endpoint untuk mendapatkan konfigurasi env
app.get('/env-config', (req, res) => {
  res.json({
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    USER1_USERNAME: process.env.USER1_USERNAME,
    USER1_PASSWORD: process.env.USER1_PASSWORD,
    USER2_USERNAME: process.env.USER2_USERNAME,
    USER2_PASSWORD: process.env.USER2_PASSWORD
  });
});

// Endpoint untuk menambahkan chat ID
app.post('/api/add-telegram-chat', (req, res) => {
  const { chatId } = req.body;
  
  if (!chatId) {
    return res.status(400).json({ success: false, error: 'chatId is required' });
  }

  if (!allowedChatIds.includes(chatId)) {
    allowedChatIds.push(chatId);
  }

  res.json({ 
    success: true, 
    chatIds: allowedChatIds 
  });
});

// Endpoint untuk mendapatkan daftar chat ID
app.get('/api/telegram-chats', (req, res) => {
  res.json({ 
    success: true, 
    chatIds: allowedChatIds 
  });
});

// Endpoint khusus Device 1
app.get('/api/telegram-users-status/device1', async (req, res) => {
  try {
    const telegramUsers = [
      { chatId: '5080707943', name: 'Fatony Ahmad Fauzi' },
      { chatId: '5869060700', name: 'Ahmad Rifai' }
    ];

    const results = await Promise.all(
      telegramUsers.map(async (user) => {
        const snapshot = await db.ref(`devices/device1/control/autoPausePerChat/${user.chatId}`).once('value');
        return {
          ...user,
          isPaused: snapshot.val() === true,
          device: 'Device 1'
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint khusus Device 2
app.get('/api/telegram-users-status/device2', async (req, res) => {
  try {
    const telegramUsers = [
      { chatId: '5413131276', name: 'Fatony Ahmad Fauzi' }
    ];

    const results = await Promise.all(
      telegramUsers.map(async (user) => {
        const snapshot = await db.ref(`devices/device2/control/autoPausePerChat/${user.chatId}`).once('value');
        return {
          ...user,
          isPaused: snapshot.val() === true,
          device: 'Device 2'
        };
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function sendTelegramNotification(message, chatIds = null, device = 'device1') {
  const config = TELEGRAM_TOKENS[device] || TELEGRAM_TOKENS.device1;
  const targets = chatIds || config.chatIds;
  
  const results = [];
  
  for (const chatId of targets) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${config.token}/sendMessage`, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );
      
      const data = await response.json();
      results.push({ success: data.ok, chatId, response: data });
    } catch (error) {
      results.push({ success: false, chatId, error });
    }
  }
  
  return results;
}

// Endpoint untuk data sampah
app.get('/api/trash-data', async (req, res) => {
  try {
    const { device = 'device2' } = req.query;
    const path = devicePaths[device] || devicePaths.device2;
    const snapshot = await db.ref(path).once('value');
    const deviceInfo = snapshot.val() || {};
    
    // Debug log struktur data baru
    console.log('Firebase data structure:', Object.keys(deviceInfo));
    
    res.json({ 
      success: true, 
      data: transformFirebaseData(deviceInfo, device)
    });
  } catch (error) {
    console.error('Error fetching trash data:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

// In your test-write endpoint, modify to:
app.post('/api/test-write', async (req, res) => {
  try {
    const testData = {
      devices: {
        device1: {
          distance: 15.5,
          status: 'SEDANG',
          timestamp: new Date().toISOString(),
          batteryVoltage: 3.8,
          history: {
            [Date.now()]: {  // Using timestamp as key
              distance: 15.5,
              status: 'SEDANG',
              batteryVoltage: 3.8
            }
          }
        }
      }
    };
    
    await axios.patch(FIREBASE_URL, testData);
    res.json({ success: true });
  } catch (error) {
    console.error('Write test failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk menerima data baru dari IoT device
app.post('/api/trash-data', async (req, res) => {
  try {
    const { distance, status, batteryVoltage, device = 'device2' } = req.body;
    
    // Validasi
    if (typeof distance !== 'number' || distance < 0) {
      return res.status(400).json({ success: false, error: 'Invalid distance' });
    }
    
    const timestamp = new Date().toISOString();
    const newData = {
      distance,
      status: status || 'UNKNOWN',
      batteryVoltage: batteryVoltage || 0,
      fillLevel: calculateFillLevel(distance),
      timestamp,
      device
    };

    // 1. Simpan ke Firebase
    await db.ref(`devices/${device}/data/${Date.now()}`).set(newData);
    
    // 2. Simpan ke Google Sheets
    await saveToGoogleSheets(newData);

    res.json({ success: true, data: newData });
  } catch (error) {
    console.error('Data save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fungsi baru untuk mengirim data ke Google Sheets
async function saveToGoogleSheets(data) {
  const today = new Date().toISOString().split('T')[0];
  const webAppUrl = "https://script.google.com/macros/s/AKfycbyb7QrBAQFLQ1dwawghVKzMKc_Ifzy33-LKbU3fI1Hze83hVjiRJ4lWf4uU2hJouOXF/exec"; 

  try {
    // Send as JSON like in your working Postman example
    const payload = {
      date: today,
      timestamp: data.timestamp,
      distance: data.distance,
      status: data.status,
      batteryVoltage: data.batteryVoltage,
      device: data.device
    };

    console.log("Mengirim data ke Google Sheets:", payload); // Log the payload

    const response = await axios.post(webAppUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Response dari Google Sheets:", response.data);
    return true;
  } catch (error) {
    console.error("Gagal mengirim ke Google Sheets:", {
      error: error.message,
      response: error.response?.data,
      request: error.config?.data // Log the request payload
    });
    return false;
  }
}

// Endpoint untuk memeriksa konfigurasi Telegram
app.get('/api/telegram-config', (req, res) => {
  res.json({
      hasTelegram: !!TELEGRAM_BOT_TOKEN && !!TELEGRAM_CHAT_ID
  });
});

app.get('/api/debug-telegram', (req, res) => {
  res.json({
    hasConfig: !!TELEGRAM_BOT_TOKEN && !!TELEGRAM_CHAT_ID,
    botToken: TELEGRAM_BOT_TOKEN ? '****' + TELEGRAM_BOT_TOKEN.slice(-4) : 'undefined',
    chatId: TELEGRAM_CHAT_ID || 'undefined'
  });
});

// Endpoint untuk mengatur pause status
app.post('/api/set-pause-status', async (req, res) => {
  const { device, pause } = req.body;

  if (!device || typeof pause !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Invalid request body' });
  }

  try {
    // Update status pause untuk device tertentu
    await db.ref(`devices/${device}/control/pause`).set(pause);

    // Format waktu
    const timestamp = moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss");
    const actionText = pause ? 'PAUSE' : 'RESUME';
    const emoji = pause ? '⏸️' : '▶️';

    // Buat pesan spesifik untuk platform
    const messageTelegram = `${emoji} <b>SISTEM MONITORING TELAH DI ${actionText}</b>\n` +
                          `Oleh: Admin\n` +
                          `Waktu: ${timestamp}\n` +
                          `Device: ${device.toUpperCase()}`;

    const messageDiscord = `${emoji} **SISTEM MONITORING TELAH DI ${actionText}**\n` +
                          `Oleh: Admin\n` +
                          `Waktu: ${timestamp}\n` +
                          `Device: ${device.toUpperCase()}`;

    // Kirim notifikasi ke platform sesuai device
    await Promise.all([
      sendTelegramNotification(messageTelegram, null, device),
      sendDiscordNotification(messageDiscord, device)
    ]);
    
    res.json({ success: true, pause });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint untuk menerima permintaan notifikasi dari frontend
app.post('/api/telegram-notify', async (req, res) => {
  try {
    const { message, skipPauseCheck, device = 'device1' } = req.body;

    if (!skipPauseCheck && await isPaused()) {
      return res.json({ success: false, message: "Paused" });
    }

    // Kirim ke Telegram dengan device yang sesuai
    await sendTelegramNotification(message, null, device);
    
    // Kirim ke Discord
    const discordMessage = message.replace(/<b>/g, '**').replace(/<\/b>/g, '**');
    await sendDiscordNotification(discordMessage, device);

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/discord-notify', async (req, res) => {
  const { message, device } = req.body;

  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = device === 'device2'
    ? process.env.DISCORD_CHANNEL_ID_DEVICE2
    : process.env.DISCORD_CHANNEL_ID_DEVICE1;

  if (!token || !channelId) {
    return res.status(500).json({ success: false, error: 'Missing Discord config' });
  }

  try {
    // gunakan axios atau discord.js untuk kirim
    await axios.post(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      content: message
    }, {
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Discord error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Di server.js
app.post('/api/set-notification-pause', async (req, res) => {
  const { pause } = req.body;

  try {
    // Update status pause di Firebase
    await axios.put(
      `https://tempatsampah-iot-e2c70-default-rtdb.asia-southeast1.firebasedatabase.app/control/notificationPause.json?auth=${process.env.FIREBASE_AUTH_TOKEN}`,
      JSON.stringify(pause),
      { headers: { 'Content-Type': 'application/json' } }
    );

    // Kirim notifikasi
    const message = pause 
      ? '🔕 <b>Notifikasi otomatis dipause</b>\nTidak akan ada notifikasi sampai diresume.' 
      : '🔔 <b>Notifikasi otomatis diaktifkan</b>\nAnda akan menerima update berkala.';
    
    await sendAdminNotification(message);
    res.json({ success: true });

  } catch (error) {
    console.error("Error update notification pause:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fungsi transformasi data Firebase (tetap sama)
function transformFirebaseData(firebaseData, device) {
  if (!firebaseData) {
    console.warn('No firebase data received for device:', device);
    return [];
  }
  const result = [];
  const deviceInfo = firebaseData.device || `ESP32-${device}`;
  const powerSource = firebaseData.powerSource || 'Battery';

  if (firebaseData.data) {
    Object.entries(firebaseData.data).forEach(([timestampKey, level1]) => {
      if (level1 && typeof level1 === 'object') {
        Object.entries(level1).forEach(([level2Key, level2]) => {
          if (level2 && typeof level2 === 'object') {
            Object.entries(level2).forEach(([randomId, sensorData]) => {
              const processedData = processDeviceData(sensorData, timestampKey, device);
              result.push(processedData);
            });
          }
        });
      }
    });
    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  return generateFallbackData();
}

function processDeviceData(deviceData, timestampKey, device = 'device2') {
  if (!deviceData) {
    console.warn('Device data is undefined for timestamp:', timestampKey);
    return generateFallbackData()[0];
  }

  let timestamp;
  try {
    if (deviceData.timestamp) {
      if (!isNaN(deviceData.timestamp)) {
        const tsNum = parseInt(deviceData.timestamp);
        timestamp = new Date(tsNum > 1e12 ? tsNum : tsNum * 1000).toISOString();
      } else if (typeof deviceData.timestamp === 'string') {
        const fixedTimestamp = deviceData.timestamp.replace(/(T\d{2}:\d{2}:)\d+/, '$100').replace(/Z?$/, 'Z');
        timestamp = new Date(fixedTimestamp).toISOString();
      } else {
        timestamp = new Date().toISOString();
      }
    } else {
      const tsNum = parseInt(timestampKey);
      timestamp = new Date(tsNum > 1e12 ? tsNum : tsNum * 1000).toISOString();
    }
  } catch (e) {
    console.error('Error processing timestamp:', e);
    timestamp = new Date().toISOString();
  }

  return {
    timestamp,
    distance: parseFloat(deviceData.distance) || 0,
    status: deviceData.status || 'UNKNOWN',
    batteryVoltage: parseFloat(deviceData.batteryVoltage) || 0,
    powerSource: deviceData.powerSource || 'Battery',
    device: deviceData.device || `ESP32-${device}`,
    fillLevel: deviceData.fillLevel || calculateFillLevel(deviceData.distance || 0)
  };
}

// Fungsi fallback data (tetap sama)
function generateFallbackData() {
    const data = [];
    const now = new Date();
    const statuses = ['KOSONG', 'SEDANG', 'PENUH'];
    
    for (let i = 0; i < 24; i++) {
        const timestamp = new Date(now);
        timestamp.setHours(now.getHours() - i);
        
        const status = statuses[i % 3];
        const distance = status === 'KOSONG' ? 2 + Math.random() * 3 :
                        status === 'SEDANG' ? 8 + Math.random() * 4 :
                        15 + Math.random() * 5;
        
        data.push({
            timestamp: timestamp.toISOString(),
            distance: parseFloat(distance.toFixed(1)),
            status: status,
            batteryVoltage: parseFloat((3.3 + Math.random() * 0.7).toFixed(2)),
            powerSource: 'Battery',
            device: 'Fallback Device',
            fillLevel: calculateFillLevel(distance)
        });
    }
    
    return data;
}

app.use('/public', express.static('public'));

async function checkAndSendLatestData(device) {
  try {
    // 1. Cek status pause untuk device tertentu
    const [globalPauseSnapshot, userPausesSnapshot] = await Promise.all([
      db.ref(`devices/${device}/control/pause`).once('value'),
      db.ref(`devices/${device}/control/autoPausePerChat`).once('value')
    ]);

    const globalPaused = globalPauseSnapshot.val() === true;
    const userPauses = userPausesSnapshot.val() || {};

    if (globalPaused) {
      console.log(`Notifikasi ${device} dipause secara global`);
      return;
    }

    // 2. Ambil data terbaru dari device tertentu
    const snapshot = await db.ref(`devices/${device}/data`)
      .orderByKey()
      .limitToLast(1)
      .once('value');

    const deviceData = snapshot.val() || {};
    console.log(`🔥 RAW FIREBASE DATA ${device}:`, JSON.stringify(deviceData, null, 2));

    // Proses data device
    let transformedData = [];
    
    Object.entries(deviceData).forEach(([timestampKey, timestampData]) => {
      Object.values(timestampData).forEach(sensorEntry => {
        Object.values(sensorEntry).forEach(sensorData => {
          transformedData.push({
            timestamp: sensorData.timestamp || timestampKey,
            distance: parseFloat(sensorData.distance) || 0,
            status: sensorData.status || 'KOSONG',
            batteryVoltage: parseFloat(sensorData.batteryVoltage) || 0,
            device: `ESP32-${device}`,
            fillLevel: calculateFillLevel(sensorData.distance || 0)
          });
        });
      });
    });

    if (!transformedData.length) return;

    const latestData = transformedData[0];

    // 3. Format pesan untuk device tertentu
    const formattedTimestamp = latestData.timestamp
      .replace('T', ' ')
      .replace('Z', '');

    const messageTelegram = `🗑️ <b>Update ${device.toUpperCase()}</b>\n` +
      `Status: ${latestData.status}\n` +
      `Jarak: ${latestData.distance.toFixed(1)} cm\n` +
      `Tinggi: ${latestData.fillLevel}%\n` +
      `Baterai: ${latestData.batteryVoltage.toFixed(2)}V\n` +
      `Perangkat: ${latestData.device}\n` +
      `Waktu: ${formattedTimestamp}`;

    const messageDiscord = `🗑️ **Update ${device.toUpperCase()}**\n` +
      `Status: ${latestData.status}\n` +
      `Jarak: ${latestData.distance.toFixed(1)} cm\n` +
      `Tinggi: ${latestData.fillLevel}%\n` +
      `Baterai: ${latestData.batteryVoltage.toFixed(2)}V\n` +
      `Perangkat: ${latestData.device}\n` +
      `Waktu: ${formattedTimestamp}`;

    // 4. Kirim notifikasi untuk device tertentu
    const activeChatIds = TELEGRAM_TOKENS[device].chatIds.filter(chatId => !userPauses[chatId]);
    
    await Promise.all([
      // Kirim ke Telegram
      activeChatIds.length > 0 
        ? sendTelegramNotification(messageTelegram, activeChatIds, device)
        : Promise.resolve(),
      
      // Kirim ke Discord
      sendDiscordNotification(messageDiscord, device)
    ]);

    console.log(`Notifikasi terkirim untuk ${device}`);
  } catch (err) {
    console.error(`Error in checkAndSendLatestData for ${device}:`, err);
  }
}

// Jalankan untuk kedua device secara terpisah
setInterval(() => checkAndSendLatestData('device1'), 10 * 1000);
setInterval(() => checkAndSendLatestData('device2'), 10 * 1000);

async function sendDevice2Notification() {
  const message = `🗑️ <b>Update Terbaru</b>\n` +
    `Status: KOSONG\n` +
    `Jarak: 18.7 cm\n` +
    `Tinggi: 7%\n` +
    `Baterai: 3.30V\n` +
    `Perangkat: ESP32-device2\n` +
    `Waktu: 2025-05-27 05:13:30`;

  try {
    // Call the Telegram notification function directly
    await sendTelegramNotification(message, null, 'device2');
    return { success: true };
  } catch (err) {
    console.error("Telegram notification error:", err);
    return { success: false, error: err.message };
  }
}

// Panggil fungsi ini ketika diperlukan
sendDevice2Notification();

// Endpoint untuk mendapatkan status pause
app.get('/api/get-pause-status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { device = 'device1' } = req.query;
    const snapshot = await db.ref(`devices/${device}/control/pause`).once('value');
    
    res.json({ 
      success: true,
      device,
      paused: snapshot.val() === true
    });
  } catch (error) {
    console.error("Error getting pause status:", error);
    res.status(500).json({ 
      success: false,
      error: error.message
    });
  }
});

// New way with Admin SDK
app.get('/api/debug-firebase', async (req, res) => {
  try {
    const { device = 'device2' } = req.query;
    const snapshot = await db.ref(`devices/${device}/data`).once('value');
    res.json({ success: true, data: snapshot.val() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/delete-all-data', async (req, res) => {
  try {
    const { device = 'device1' } = req.query;

    // 1. Hapus data berdasarkan device
    await db.ref(`devices/${device}/data`).remove();

    // 2. Format waktu dan pesan
    const timestamp = moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss");
    const messageTelegram = `🗑️ <b>SEMUA DATA ${device.toUpperCase()} TELAH DIHAPUS</b>\n` +
                            `Oleh: Admin\n` +
                            `Waktu: ${timestamp}\n` +
                            `Sistem akan mulai mengumpulkan data baru.`;
    const messageDiscord = `🗑️ **SEMUA DATA ${device.toUpperCase()} TELAH DIHAPUS**\n` +
                           `Oleh: Admin\n` +
                           `Waktu: ${timestamp}\n` +
                           `Sistem akan mulai mengumpulkan data baru.`;

    // 3. Kirim ke Telegram & Discord sesuai device
    await Promise.all([
      sendTelegramNotification(messageTelegram, null, device),
      sendDiscordNotification(messageDiscord, device)
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting all Firebase data:", error);

    // Notifikasi error ke Discord (umum)
    await sendDiscordNotification(
      `❌ **GAGAL MENGHAPUS DATA**\n` +
      `Error: ${error.message}\n` +
      `Silakan cek logs server.`
    );

    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/webhook/telegram', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.chat || !message.text) {
      return res.status(400).json({ status: "invalid message" });
    }

    const text = message.text.toLowerCase();
    const chatId = message.chat.id.toString();

    // Daftar chat ID yang diizinkan (Device 1 + Device 2)
    const allowedChatIds = [
      '5080707943', // Device 1 - Fatony
      '5869060700', // Device 1 - Rifai
      '5413131276'  // Device 2 - Fatony
    ];

    if (!allowedChatIds.includes(chatId)) {
      console.log(`Chat ID ${chatId} tidak terdaftar`);
      return res.status(403).json({ status: "unauthorized" });
    }

    // Tentukan device berdasarkan chat ID
    const isDevice1 = ['5080707943', '5869060700'].includes(chatId);
    const targetDevice = isDevice1 ? 'device1' : 'device2';

    // Handle /pause dan /resume
    if (text === '/pause' || text === '/resume') {
      try {
        const setPauseValue = text === '/pause';
        await db.ref(`devices/${targetDevice}/control/autoPausePerChat/${chatId}`).set(setPauseValue);

        const action = setPauseValue ? 'pause' : 'resume';
        console.log(`Notifikasi ${action} untuk ${targetDevice}, chat ID: ${chatId}`);

        const replyMessage = setPauseValue 
          ? '⏸️ Notifikasi dipause. Kirim /resume untuk melanjutkan' 
          : '▶️ Notifikasi diaktifkan kembali';

        await sendTelegramNotification(replyMessage, [chatId], targetDevice);
        return res.json({ status: "success" });
      } catch (error) {
        console.error('Error:', error);
        await sendTelegramNotification('❌ Gagal memproses perintah', [chatId], targetDevice);
        return res.status(500).json({ error: "Failed to process command" });
      }
    }

    res.json({ status: "ignored" });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =============================================
// HANDLER COMMAND BOT DISCORD
// =============================================
discordBot.on('messageCreate', async (message) => {
  // Abaikan jika pesan dari bot lain atau bukan command
  if (message.author.bot || !message.content.startsWith('!')) return;

  // Parse command
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Command: !status
  if (command === 'status') {
    try {
      const res = await axios.get(FIREBASE_URL);
      const latestData = transformFirebaseData(res.data)[0] || {};
      
      const statusMessage = `🗑️ **STATUS TERKINI**\n` +
        `• Tinggi: ${latestData.fillLevel || 0}%\n` +
        `• Status: ${latestData.status || 'UNKNOWN'}\n` +
        `• Baterai: ${latestData.batteryVoltage?.toFixed(2) || '0.00'}V\n` +
        `• Terakhir Update: ${formatDiscordTimestamp(latestData.timestamp)}`;
      
      await message.reply(statusMessage);
    } catch (error) {
      console.error('Error fetching status:', error);
      await message.reply('⚠️ Gagal mengambil data status');
    }
  }

  // Tambahkan command lain di sini...
});

// Helper untuk format timestamp Discord
function formatDiscordTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

setInterval(checkAndSendLatestData, 10 * 1000);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Firebase endpoint: ${FIREBASE_URL}`);

  // Format pesan untuk Telegram (HTML)
  const telegramMessage = 
    `🤖 <b>Sistem Monitoring Tempat Sampah</b> 🤖\n` +
    `Server telah berjalan di http://localhost:${PORT}\n` +
    `Waktu mulai: ${moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss")}\n` +
    `Environment: ${process.env.NODE_ENV || 'development'}`;

  // Format pesan untuk Discord (Markdown)
  const discordMessage = 
    `🤖 **Sistem Monitoring Tempat Sampah** 🤖\n` +
    `Server telah berjalan di http://localhost:${PORT}\n` +
    `Waktu mulai: ${moment().tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss")}\n` +
    `Environment: ${process.env.NODE_ENV || 'development'}`;

// Kirim ke semua platform
const notifications = [];

  // Device 1 notifications
  if (TELEGRAM_TOKENS.device1.token && TELEGRAM_TOKENS.device1.chatIds.length) {
    notifications.push(
      sendTelegramNotification(telegramMessage, null, 'device1')
    );
  } else {
    console.warn('Telegram credentials for device1 not configured - skipping startup notification');
  }

  // Device 2 notifications
  if (TELEGRAM_TOKENS.device2.token && TELEGRAM_TOKENS.device2.chatIds.length) {
    notifications.push(
      sendTelegramNotification(telegramMessage, null, 'device2')
    );
  } else {
    console.warn('Telegram credentials for device2 not configured - skipping startup notification');
  }

  if (process.env.DISCORD_BOT_TOKEN) {
    notifications.push(
      sendDiscordNotification(discordMessage, 'device1')
    );
    notifications.push(
      sendDiscordNotification(discordMessage, 'device2')
    );
  } else {
    console.warn('Discord bot token not configured - skipping Discord notifications');
  }
});