# Smart Trash Monitoring System

## 📝 Deskripsi Proyek

Sistem monitoring tempat sampah pintar berbasis IoT yang memantau tingkat pengisian tempat sampah menggunakan sensor ultrasonik dan menampilkan data secara real-time melalui antarmuka web. Sistem ini terdiri dari:

- Perangkat IoT berbasis ESP32
- Backend server (Node.js)
- Frontend web (HTML, CSS, JavaScript)
- Integrasi dengan Firebase, Telegram, dan Discord

## 🛠️ Fitur Utama

- **Monitoring Real-time**:
  - Tinggi sampah dalam cm
  - Persentase pengisian
  - Status (KOSONG/SEDANG/PENUH)
  - Tegangan baterai
- **Notifikasi Otomatis**:
  - Telegram untuk status penting
  - Discord untuk logging sistem
- **Manajemen Data**:
  - Penyimpanan data di Firebase
  - Ekspor data ke CSV
    Filter dan pencarian data
- **Multi-device Support**:
  - Dukungan untuk 2 perangkat terpisah
  - Antarmuka khusus untuk setiap perangkat
- **Keamanan**:
  - Sistem login dengan 3 level akses (admin, user1, user2)
  - Proteksi endpoint API

## 🚀 Deployment ke Render

**Prasyarat**

1. Akun [Render](https://render.com/)
2. Firebase project dengan Realtime Database
3. Bot Telegram dan channel Discord (opsional)

**Langkah-langkah Deployment**

1.  **Persiapan Environment Variables**:
    Buat file `.env` di root project dengan konten berikut:

    ```env
    # Firebase Configuration
    FIREBASE_URL=https://[YOUR-FIREBASE-PROJECT].firebaseio.com
    FIREBASE_AUTH_TOKEN=[YOUR-FIREBASE-SECRET]

    # Telegram Configuration
    TELEGRAM_BOT_TOKEN=[BOT-TOKEN-DEVICE1]
    TELEGRAM_CHAT_ID=[CHAT-ID1,CHAT-ID2]
    TELEGRAM_BOT_TOKEN_DEVICE2=[BOT-TOKEN-DEVICE2]
    TELEGRAM_CHAT_ID_DEVICE2=[CHAT-ID3]

    # Discord Configuration
    DISCORD_BOT_TOKEN=[YOUR-DISCORD-BOT-TOKEN]
    DISCORD_CHANNEL_ID_DEVICE1=[CHANNEL-ID-DEVICE1]
    DISCORD_CHANNEL_ID_DEVICE2=[CHANNEL-ID-DEVICE2]

    # Authentication
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=admin123
    USER1_USERNAME=user1
    USER1_PASSWORD=user1pass
    USER2_USERNAME=user2
    USER2_PASSWORD=user2pass

    PORT=3000
    ```

2.  **Deploy ke Render**:

    - Buat new Web Service di Render
    - Connect ke repository GitHub Anda
    - Gunakan konfigurasi berikut:
      - **Runtime**: Node
      - **Build Command**: `npm install`
      - **Start Command**: `node server.js`
      - **Environment Variables**: Salin semua dari file `.env`

3.  **Konfigurasi Webhook**:
    Setelah deploy selesai, dapatkan URL dari Render (format: `https://[nama-service].onrender.com`) dan update di file `script.js` dengan:

    ```javascript
    const API_BASE_URL = "https://[nama-service].onrender.com";
    ```

4.  **Konfigurasi ESP32**:

    - Biarkan `firebaseHost` mengarah langsung ke Firebase:
      ```cpp
      const char *firebaseHost = "https://[PROJECT-ID].firebasedatabase.app/";
      ```
    - Tidak perlu diubah ke URL Render

5.  Konfigurasi Firebase Rules:
    Pastikan Firebase Realtime Database memiliki rules berikut:
    ```json
    {
      "rules": {
        "devices": {
          "device1": {
            ".read": "auth != null",
            ".write": "auth != null"
          },
          "device2": {
            ".read": "auth != null",
            ".write": "auth != null"
          }
        }
      }
    }
    ```
6.  🏗️ Struktur Proyek

    ```bash
    smart-trash-monitoring/
    ├── Arduino IDE/             # Kode untuk perangkat IoT
    │ ├── Device-1.ino           # Kode untuk perangkat 1
    │ └── Device-2.ino           # Kode untuk perangkat 2
    ├── public/                  # File frontend
    │ ├── assets/                # Gambar dan logo
    │ ├── css/                   # Stylesheet
    │ ├── js/                    # JavaScript
    │ ├── device-1.html          # Halaman device 1
    │ ├── device-2.html          # Halaman device 2
    │ └── login.html             # Halaman login
    ├── server.js                # Backend server
    ├── package.json             # Dependencies Node.js
    └── service-account-key.json # Kredensial Firebase
    ```

## 🔌 Hardware Requirements

    - ESP32 Dev Module
    - Sensor Ultrasonik HC-SR04
    - Power supply (baterai 18650 atau USB)
    - Modul pengukur tegangan baterai
    - LCD I2C 16x2 (opsional)

## 📊 Diagram Arsitektur

    ```bash
    [ESP32 Device] --(WiFi)--> [Firebase Realtime Database]
                               ↑
                               |
    [Web Browser] <--(HTTP)--> [Node.js Server on Render]
    ↓
    [Telegram/Discord] <--(API)---+
    ```

## 🧑‍💻 Penggunaan

1. **Login**:
   - Admin: Akses penuh ke kedua device
   - User1: Hanya bisa akses device 1
   - User2: Hanya bisa akses device 2
2. **Fitur Dashboard**:
   - Lihat status real-time
   - Filter data berdasarkan tanggal/status
   - Ekspor data ke CSV
   - Pause/resume data collection
3. **Notifikasi**:
   - Telegram: Status penting dan alert
   - Discord: Logging sistem

## 🛠️ Teknologi yang Digunakan

- **Frontend**: Bootstrap 5, Chart.js, Flatpickr
- **Backend**: Node.js, Express.js
- **Database**: Firebase Realtime Database
- **IoT**: ESP32 (Arduino Core)
- **Integrasi**: Telegram Bot API, Discord.js

## 📄 License

Proyek ini dilisensikan di bawah MIT License - lihat file [LICENSE]() untuk detailnya.

## ✉️ Kontak

Untuk pertanyaan lebih lanjut, silakan hubungi:

Fatony Ahmad Fauzi
Email: fatonyahmadfauzi@gmail.com
Telegram: @fatonyahmadfauzi
