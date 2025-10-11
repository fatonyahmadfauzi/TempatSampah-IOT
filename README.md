# Smart Trash Monitoring System

## 📝 Project Description

An IoT-based smart trash monitoring system that tracks the fill level of trash cans using ultrasonic sensors and displays real-time data through a web interface. The system consists of:

- An ESP32-based IoT device
- A serverless backend on Netlify (Node.js)
- A web frontend (HTML, CSS, JavaScript)
- Integration with Firebase, Telegram, and Discord

## 🛠️ Key Features

- **Real-time Monitoring**:
  - Trash distance in cm
  - Fill percentage
  - Status (EMPTY/MEDIUM/FULL)
  - Battery voltage
- **Automatic Notifications**:
  - Status notifications to Telegram for each registered user.
  - System logging to a Discord channel.
- **Control via Telegram Commands**:
  - Each user can personally pause (`/pause`) and resume (`/resume`) their own notifications.
  - Support for two separate bots controlling two different devices.
- **Data Management**:
  - Data storage in Firebase Realtime Database.
  - Data export to CSV format.
  - Data filtering and searching on the web dashboard.
- **Multi-device Support**:
  - Full support for 2 separate devices, each with its own dashboard and bot.
- **Security**:
  - Login system with 3 access levels (admin, user1, user2).
  - API endpoint protection.

## 🚀 Deployment to Netlify

**Prerequisites**

1.  A [Netlify](https://www.netlify.com/) account.
2.  A Firebase project with Realtime Database & a Service Account Key (JSON file).
3.  **Two** Telegram Bots (one for each device) and a Discord channel (optional).

**Deployment Steps**

1.  **Upload Project to GitHub**:
    Ensure all files, including the `netlify` folder and the `netlify.toml` file, are in your GitHub repository.

2.  **Deploy on Netlify**:

    - From the Netlify dashboard, select "Add new site" -> "Import an existing project".
    - Connect to your GitHub repository.
    - The build settings will be automatically detected from `netlify.toml`. Simply confirm and proceed.

3.  **Configure Environment Variables**:

    - Go to **Site settings > Build & deploy > Environment**.
    - Add all the required variables:
      - `TELEGRAM_BOT_TOKEN` (For Bot Device 1)
      - `TELEGRAM_CHAT_ID` (List of user IDs for Bot 1, comma-separated)
      - `TELEGRAM_BOT_TOKEN_DEVICE2` (For Bot Device 2)
      - `TELEGRAM_CHAT_ID_DEVICE2` (List of user IDs for Bot 2, comma-separated)
      - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `USER1_USERNAME`, etc.
    - **Important for Firebase**: Add the variables from your `service-account-key.json` file:
      - `FIREBASE_URL`: Your Firebase database URL.
      - `FIREBASE_PROJECT_ID`: The `project_id` from the JSON file.
      - `FIREBASE_CLIENT_EMAIL`: The `client_email` from the JSON file.
      - `FIREBASE_PRIVATE_KEY`: Copy the entire `private_key` content from the JSON file and paste it as a single line of text.

4.  **Configure Telegram Webhooks**:

    - After the project is successfully deployed, you need to register the webhooks for both of your bots. Open the following links in your browser, replacing the required information:

    - **For Bot Device 1:**

      ```
      [https://api.telegram.org/bot](https://api.telegram.org/bot)[YOUR_BOT_TOKEN_FOR_DEVICE_1]/setWebhook?url=https://[YOUR_NETLIFY_SITE_URL]/.netlify/functions/telegram-webhook-d1
      ```

    - **For Bot Device 2:**
      ```
      [https://api.telegram.org/bot](https://api.telegram.org/bot)[YOUR_BOT_TOKEN_FOR_DEVICE_2]/setWebhook?url=https://[YOUR_NETLIFY_SITE_URL]/.netlify/functions/telegram-webhook-d2
      ```
    - Ensure you get a `{"ok":true,"result":true,"description":"Webhook was set"}` response for both.

5.  **Trigger Deploy**:
    After saving all environment variables, go to the "Deploys" tab and trigger a new deploy to apply the changes.

6.  **Firebase Rules Configuration**:
    Ensure your Firebase Realtime Database has the following rules:
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

## 🏗️ Project Structure

`````bash
smart-trash-monitoring/
├── Arduino IDE/
├── netlify/
│   └── functions/
│       ├── telegram-notify.js         # Sends general notifications
│       ├── telegram-webhook-d1.js     # Receives commands for Bot 1
│       ├── telegram-webhook-d2.js     # Receives commands for Bot 2
│       ├── trash-data.js              # Data API for the web
│       └── ...
├── public/
│   ├── assets/
│   ├── css/
│   ├── js/
│   ├── device-1.html
│   ├── device-2.html
│   └── login.html
├── netlify.toml
└── package.json
    ```

## 🔌 Hardware Requirements

    - ESP32 Dev Module
    - Ultrasonic Sensor HC-SR04
    - Power supply (18650 battery or USB)
    - Battery voltage measurement module (or a voltage divider)
    - LCD I2C 16x2 (optional)

## 📊 Architecture Diagram

````bash
[ESP32 Device 1 & 2] ----(WiFi)----> [Firebase Realtime DB]
                                         ^
                                         | (Read/Write Data)
                                         v
[Web Browser] <----(HTTPS)----> [Netlify: CDN + Functions] <----(Webhook)---- [Telegram Bot 1 & 2]
   (API Call)                           ^         |                        (API Reply)
                                        |         | (API Call)
                                        +---------+------> [Discord]
    ```

## 🧑‍💻 Usage

1. **Web Login**:
   - **Admin**: Full access to both devices.
   - **User1**: Access to device 1 only.
   - **User2**: Access to device 2 only.
2. **Web Dashboard**:
   - View real-time status, statistics, and charts.
   - Filter data by date/status.
   - Export data to CSV.
   - Pause/resume data sending from the ESP32 device (globally).
3. **Telegram Bot Commands**:
   - Open a chat with the corresponding bot (Bot 1 for Device 1, Bot 2 for Device 2).
   - Send `/pause` to stop receiving notifications from that bot.
   - Send `/resume` to start receiving notifications again.
   - This feature is personal and will not affect other users' notifications.

## 🛠️ Technologies Used

- **Frontend**: Bootstrap 5, Chart.js, Flatpickr
- **Backend**: Node.js (within Netlify Functions)
- **Database**: Firebase Realtime Database
- **IoT**: ESP32 (Arduino Core)
- **Integrations**: Telegram Bot API, Discord Webhooks

## 📄 License

This project is licensed under the MIT License - see the [LICENSE]() file for details.

## ✉️ Contact

Fatony Ahmad Fauzi
- Email: fatonyahmadfauzi@gmail.com
- Telegram: @fatonyahmadfauzi
`````
