// Lokasi: netlify/functions/get-pause-status.js
const admin = require('firebase-admin');

// BLOK INISIALISASI FIREBASE (WAJIB ADA)
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
  const { device = 'device1' } = event.queryStringParameters;
  try {
    const snapshot = await admin.database().ref(`devices/${device}/control/pause`).once('value');
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, paused: snapshot.val() === true })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};