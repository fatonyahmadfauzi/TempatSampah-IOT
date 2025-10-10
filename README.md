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

## 🚀 Deployment ke Netlify

**Prasyarat**

1.  Akun [Netlify](https://www.netlify.com/)
2.  Firebase project dengan Realtime Database & Kunci Service Account (file JSON).
3.  Bot Telegram dan channel Discord (opsional).

**Langkah-langkah Deployment**

1.  **Unggah Proyek ke GitHub**:
    Pastikan semua file, termasuk folder `netlify` dan file `netlify.toml`, sudah ada di repositori GitHub Anda.

2.  **Deploy di Netlify**:

    - Dari dashboard Netlify, pilih "Add new site" -> "Import an existing project".
    - Hubungkan ke repositori GitHub Anda.
    - Pengaturan build akan terdeteksi otomatis dari `netlify.toml`. Cukup konfirmasi dan lanjutkan.

3.  **Konfigurasi Environment Variables**:

    - Buka **Site settings > Build & deploy > Environment**.
    - Tambahkan semua variabel yang Anda butuhkan (dari file `.env` lokal Anda), seperti `TELEGRAM_BOT_TOKEN`, `ADMIN_USERNAME`, dll.
    - **Penting untuk Firebase**: Tambahkan variabel dari file `service-account-key.json` Anda:
      - `FIREBASE_URL`: URL database Firebase Anda.
      - `FIREBASE_PROJECT_ID`: `project_id` dari file JSON.
      - `FIREBASE_CLIENT_EMAIL`: `client_email` dari file JSON.
      - `FIREBASE_PRIVATE_KEY`: Salin seluruh isi `private_key` dari file JSON (termasuk `-----BEGIN PRIVATE KEY-----` dan `-----END PRIVATE KEY-----`), lalu tempelkan sebagai satu baris teks.

4.  **Trigger Deploy**:
    Setelah semua variabel disimpan, pergi ke tab "Deploys" dan trigger deploy ulang agar Netlify menggunakan variabel lingkungan yang baru.

5.  **Konfigurasi ESP32**:

    - Kode pada perangkat ESP32 tidak perlu diubah. Variabel `firebaseHost` tetap mengarah langsung ke URL Firebase, bukan ke URL Netlify.

6.  Konfigurasi Firebase Rules:
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
7.  🏗️ Struktur Proyek

    ```bash
    smart-trash-monitoring/
    ├── Arduino IDE/    # Kode untuk perangkat IoT
    ├── netlify/
    │ └── functions/    # Backend Serverless Functions
    │ ├── env-config.js
    │ └── trash-data.js
    │ └── ...
    ├── public/         # File frontend (situs statis)
    │ ├── assets/
    │ ├── css/
    │ ├── js/
    │ ├── device-1.html
    │ ├── device-2.html
    │ └── login.html
    ├── netlify.toml    # Konfigurasi untuk Netlify
    ├── package.json    # Dependencies Node.js
    └── .gitignore      # Mengabaikan file sensitif
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
    [Web Browser] <--(HTTP)--> [Netlify (CDN + Functions)]
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
