// Lokasi: netlify/functions/trash-data.js

const admin = require('firebase-admin');

// Inisialisasi Firebase
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

// Fungsi BARU untuk memproses data sesuai struktur Anda
function transformFirebaseData(firebaseData, device) {
    if (!firebaseData || !firebaseData.data) {
        return [];
    }
    const result = [];

    // Loop Level 1: Timestamp (Contoh: "2025-05-28T10:58:23Z")
    Object.values(firebaseData.data).forEach(level1 => {
        if (level1 && typeof level1 === 'object') {
            // Loop Level 2: Unique Key (Contoh: "14162")
            Object.values(level1).forEach(level2 => {
                if (level2 && typeof level2 === 'object') {
                    // Loop Level 3: Push ID (Contoh: "-ORK1dD9cR-7QNU_KiTk")
                    Object.values(level2).forEach(sensorData => {
                        if (sensorData && typeof sensorData === 'object') {
                            result.push({
                                timestamp: sensorData.timestamp || 'N/A',
                                distance: parseFloat(sensorData.distance) || 0,
                                status: sensorData.status || 'UNKNOWN',
                                batteryVoltage: parseFloat(sensorData.batteryVoltage) || 0,
                                device: device
                            });
                        }
                    });
                }
            });
        }
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