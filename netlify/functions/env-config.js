// Lokasi file: netlify/functions/env-config.js

exports.handler = async function(event, context) {
  // Fungsi ini akan membaca environment variables yang sudah Anda atur di Netlify
  // dan mengirimkannya ke halaman login sebagai respons JSON.
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ADMIN_USERNAME: process.env.ADMIN_USERNAME,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      USER1_USERNAME: process.env.USER1_USERNAME,
      USER1_PASSWORD: process.env.USER1_PASSWORD,
      USER2_USERNAME: process.env.USER2_USERNAME,
      USER2_PASSWORD: process.env.USER2_PASSWORD
    }),
  };
};