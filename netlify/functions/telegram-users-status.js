// Lokasi: netlify/functions/telegram-users-status.js
const admin = require('firebase-admin');
// (Salin kode inisialisasi Firebase dari atas)
if (!admin.apps.length) { /* ... kode inisialisasi ... */ }

exports.handler = async function(event) {
    // Path akan terlihat seperti /api/telegram-users-status/device1
    const pathParts = event.path.split('/');
    const device = pathParts[pathParts.length - 1];

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