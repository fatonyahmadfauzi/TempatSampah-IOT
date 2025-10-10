// ... (Salin bagian inisialisasi Firebase dari contoh di atas) ...

// Fungsi handler utama
exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { device, pause } = JSON.parse(event.body);

    if (!device || typeof pause !== 'boolean') {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid request body' }) };
    }

    await db.ref(`devices/${device}/control/pause`).set(pause);
    
    // Catatan: Mengirim notifikasi Telegram/Discord dari sini akan lebih kompleks
    // karena Anda perlu membuat fungsi terpisah untuk itu dan memanggilnya.
    
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