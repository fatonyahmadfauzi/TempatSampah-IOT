// Lokasi: netlify/functions/telegram-users-status.js
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
    const pathParts = event.path.split('/');
    const device = pathParts[pathParts.length - 1] || 'device1';

    const userList = (device === 'device1') 
        ? [{ chatId: '5080707943', name: 'Fatony Ahmad Fauzi' }, { chatId: '5869060700', name: 'Ahmad Rifai' }]
        : [{ chatId: '5413131276', name: 'Fatony Ahmad Fauzi' }];

    try {
        const results = await Promise.all(
            userList.map(async (user) => {
                const snapshot = await admin.database().ref(`devices/${device}/control/autoPausePerChat/${user.chatId}`).once('value');
                return { ...user, isPaused: snapshot.val() === true };
            })
        );
        return { statusCode: 200, body: JSON.stringify(results) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};