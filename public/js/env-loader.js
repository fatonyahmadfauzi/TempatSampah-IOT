// Lokasi file: public/js/env-loader.js

async function loadEnv() {
  try {
    // PERBAIKAN: Menggunakan path /api/ yang benar
    const response = await fetch('/api/env-config'); 

    if (!response.ok) {
      throw new Error('Failed to load environment config from API');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading environment:', error);

    // Pesan ini hanya akan muncul jika API gagal, BUKAN untuk validasi password
    console.warn('FALLBACK: Using local credentials. This should not happen in production.');

    // Fallback values for local development if Netlify Dev fails
    return {
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin123',
      USER1_USERNAME: 'user1',
      USER1_PASSWORD: 'user1pass',
      USER2_USERNAME: 'user2',
      USER2_PASSWORD: 'user2pass'
    };
  }
}

// PERBAIKAN: Mengekspor fungsi dengan cara ini lebih aman
export { loadEnv };