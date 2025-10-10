// Lokasi: netlify/functions/set-pause-status.js
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { device, pause } = JSON.parse(event.body);

    if (!device || typeof pause !== 'boolean') {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid request body' }) };
    }

    await admin.database().ref(`devices/${device}/control/pause`).set(pause);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, pause })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};