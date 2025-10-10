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

// Ganti fungsi lama dengan fungsi baru ini di dalam netlify/functions/trash-data.js

function transformFirebaseData(firebaseData, device) {
    if (!firebaseData || !firebaseData.data) {
        console.warn('Tidak ada data yang ditemukan di Firebase untuk device:', device);
        return [];
    }

    const result = [];

    // Loop Level 1: Timestamp
    Object.values(firebaseData.data).forEach(level1 => {
        if (level1 && typeof level1 === 'object') {
            // Loop Level 2: Unique Key (millis)
            Object.values(level1).forEach(level2 => {
                if (level2 && typeof level2 === 'object') {
                    // Loop Level 3: Random ID
                    Object.values(level2).forEach(sensorData => {
                        if (sensorData && typeof sensorData === 'object') {
                            const dataPoint = {
                                timestamp: sensorData.timestamp || 'N/A',
                                distance: parseFloat(sensorData.distance) || 0,
                                status: sensorData.status || 'UNKNOWN',
                                batteryVoltage: parseFloat(sensorData.batteryVoltage) || 0,
                                device: device
                            };
                            result.push(dataPoint);
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