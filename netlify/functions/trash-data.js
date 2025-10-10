const admin = require('firebase-admin');

// Kredensial Firebase dari Environment Variables
const serviceAccount = {
  "type": process.env.FIREBASE_TYPE,
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Inisialisasi Firebase HANYA JIKA belum ada
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_URL
  });
}

const db = admin.database();

// Fungsi handler utama
exports.handler = async function(event, context) {
  // Hanya izinkan metode GET
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { device = 'device2' } = event.queryStringParameters;
  const path = device === 'device1' ? 'devices/device1' : 'devices/device2';

  try {
    const snapshot = await db.ref(path).once('value');
    const data = snapshot.val() || {};
    
    // Anda perlu memindahkan fungsi transformFirebaseData ke sini atau mengimpornya
    // Untuk sederhana, kita akan langsung kembalikan data mentah
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};