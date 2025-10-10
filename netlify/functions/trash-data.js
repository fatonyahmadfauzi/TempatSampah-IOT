// Lokasi: netlify/functions/trash-data.js

const admin = require('firebase-admin');

// Inisialisasi Firebase (pastikan environment variables sudah di-set di Netlify)
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

// Fungsi untuk memproses data mentah dari Firebase
function transformFirebaseData(firebaseData, device) {
    if (!firebaseData || !firebaseData.data) {
        return [];
    }
    const result = [];
    // Loop melalui data history di Firebase
    Object.entries(firebaseData.data).forEach(([timestampKey, value]) => {
        const dataPoint = {
            timestamp: value.timestamp || new Date(parseInt(timestampKey)).toISOString(),
            distance: parseFloat(value.distance) || 0,
            status: value.status || 'UNKNOWN',
            batteryVoltage: parseFloat(value.batteryVoltage) || 0,
            device: device
        };
        result.push(dataPoint);
    });
    // Urutkan dari yang paling baru
    return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}


exports.handler = async function(event) {
  const { device = 'device1' } = event.queryStringParameters;
  const path = `devices/${device}`;

  try {
    const snapshot = await admin.database().ref(path).once('value');
    const rawData = snapshot.val();

    // Proses data sebelum dikirim ke frontend
    const processedData = transformFirebaseData(rawData, device);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: processedData }),
    };
  } catch (error) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};