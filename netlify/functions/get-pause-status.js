// Lokasi: netlify/functions/get-pause-status.js
const admin = require('firebase-admin');
// (Salin kode inisialisasi Firebase dari atas)
if (!admin.apps.length) { /* ... kode inisialisasi ... */ }

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