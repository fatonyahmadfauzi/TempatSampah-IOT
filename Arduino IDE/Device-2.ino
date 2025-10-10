#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h> // Untuk LCD I2C

// Inisialisasi Display
LiquidCrystal_I2C lcd(0x27, 16, 2); // Alamat I2C 0x27, LCD 16x2

void setupDisplay()
{
    Wire.begin(21, 22); // SDA, SCL untuk ESP32
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Tempat Sampah");
    lcd.setCursor(0, 1);
    lcd.print("IoT Starting...");
}

void showMessageOnLCD(String line1, String line2)
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);
}

void updateDisplay(float distance, String status, float voltage, bool uploadSuccess)
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Status: ");
    lcd.print(status);

    lcd.setCursor(0, 1);
    lcd.print("Batt:");
    lcd.print(voltage, 1);
    lcd.print("V ");
    lcd.print(uploadSuccess ? "OK" : "FAIL");
}

// WiFi Configuration
const char *ssid = "FATONY AHMAD";
const char *password = "Sri212345";

// Firebase Configuration
const char *firebaseHost = "https://tempatsampah-iot-e2c70-default-rtdb.asia-southeast1.firebasedatabase.app/";
const char *authToken = "cWab9BZE456kaijEX2VHkhbV1YlIkrFGOzrboar5";

// Pin Configuration
const int trigPin = 5;
const int echoPin = 18;
const int batteryPin = 34; // Battery voltage measurement

// Trash Bin Configuration
const float maxHeight = 20.0;     // in cm
const int updateInterval = 30000; // 30 seconds between updates

// NTP Client Setup
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 7 * 3600, 60000); // UTC+7

// Device Configuration
const String deviceID = "device2"; // ID unik untuk Device 2

bool isPaused = false;
bool isUSBPowered = false; // Akan diubah di fungsi readBatteryVoltage()

float readBatteryVoltage()
{
    const int samples = 5;
    float total = 0;
    for (int i = 0; i < samples; i++)
    {
        total += analogRead(batteryPin);
        delay(10);
    }
    float raw = total / samples;
    float voltage;

    if (raw < 10)
    { // Threshold lebih baik dari raw == 0
        Serial.println("Warning: Pembacaan baterai sangat rendah, diasumsikan USB");
        voltage = 3.3; // fallback; asumsi suplai USB menghasilkan output regulator 3.3V
        isUSBPowered = true;
    }
    else
    {
        voltage = (raw / 4095.0) * 3.3 * 2.0;
        isUSBPowered = false;
    }

    Serial.print("Raw ADC: ");
    Serial.print(raw);
    Serial.print(" | Voltage: ");
    Serial.println(voltage);
    return voltage;
}

bool fetchPauseStatus()
{
    if (WiFi.status() != WL_CONNECTED)
        return false;

    HTTPClient http;
    String url = String(firebaseHost) + "devices/" + deviceID + "/control/pause.json?auth=" + authToken;

    http.begin(url);
    int httpCode = http.GET();

    if (httpCode == 200)
    {
        String payload = http.getString();
        http.end();
        return (payload == "true");
    }

    http.end();
    return false;
}

bool fetchNotificationPauseStatus()
{
    if (WiFi.status() == WL_CONNECTED)
    {
        HTTPClient http;
        String url = String(firebaseHost) + "/devices/" + deviceID + "/control/notificationPause.json?auth=" + authToken;
        http.begin(url);
        int httpCode = http.GET();

        if (httpCode == 200)
        {
            String payload = http.getString();
            payload.trim();
            return (payload == "true" || payload == "1");
        }
        http.end();
    }
    return false;
}

void connectWiFi()
{
    Serial.println();
    Serial.print("Connecting to WiFi: ");
    Serial.println(ssid);

    WiFi.begin(ssid, password);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("\nFailed to connect to WiFi!");
        return;
    }

    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.println("Device 2 Online");

    timeClient.begin();
    int ntpAttempts = 0;
    while (!timeClient.update() && ntpAttempts < 5)
    {
        timeClient.forceUpdate();
        ntpAttempts++;
        delay(500);
    }
    if (ntpAttempts >= 5)
    {
        Serial.println("Failed to sync NTP time");
    }
    else
    {
        Serial.println("NTP time synchronized");
    }
}

String getFormattedDateTime()
{
    timeClient.update();
    time_t epochTime = timeClient.getEpochTime();
    struct tm *ptm = gmtime(&epochTime);

    char formattedTime[25];
    sprintf(formattedTime, "%04d-%02d-%02dT%02d:%02d:%02dZ",
            ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday,
            ptm->tm_hour, ptm->tm_min, ptm->tm_sec);
    return String(formattedTime);
}

bool sendToFirebase(float distance, String status, float voltage, float fillLevel)
{
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("WiFi not connected - skip Firebase");
        return false;
    }

    HTTPClient http;
    String timestamp = getFormattedDateTime();
    String uniqueKey = String(millis());

    String url = String(firebaseHost) + "devices/" + deviceID + "/data/" + timestamp + "/" + uniqueKey + ".json?auth=" + authToken;

    Serial.println("Sending to Firebase URL: " + url);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String jsonData = "{";
    jsonData += "\"distance\":" + String(distance, 1) + ",";
    jsonData += "\"status\":\"" + status + "\",";
    jsonData += "\"batteryVoltage\":" + String(voltage, 2) + ",";
    jsonData += "\"fillLevel\":" + String(fillLevel, 0) + ",";
    jsonData += "\"timestamp\":\"" + timestamp + "\"";
    jsonData += "}";

    int httpCode = http.POST(jsonData);

    Serial.println("JSON Data: " + jsonData);

    String response = http.getString();

    Serial.print("HTTP Code: ");
    Serial.println(httpCode);
    Serial.print("Response: ");
    Serial.println(response);

    http.end();

    return (httpCode == 200 || httpCode == 201);
}

void initializeDeviceInFirebase()
{
    if (WiFi.status() != WL_CONNECTED)
        return;

    HTTPClient http;
    String url = String(firebaseHost) + "devices/" + deviceID + ".json?auth=" + authToken;

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    String powerSource = isUSBPowered ? "USB" : "Battery";
    String jsonData = "{\"device\":\"ESP32-" + deviceID + "\",\"powerSource\":\"" + powerSource + "\"}";

    int httpCode = http.PATCH(jsonData);
    http.end();

    if (httpCode == 200)
    {
        Serial.println("Device initialized in Firebase");
    }
}

float readDistance()
{
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    long duration = pulseIn(echoPin, HIGH, 30000);
    float distance = duration * 0.034 / 2;

    if (distance <= 0 || distance > maxHeight * 1.5)
    {
        distance = maxHeight;
        Serial.println("Pembacaan tidak valid, menggunakan nilai maksimum");
    }
    Serial.print("Jarak terukur: ");
    Serial.print(distance);
    Serial.println(" cm");
    return distance;
}

float calculateFillLevel(float distance)
{
    float fillLevel = ((maxHeight - distance) / maxHeight) * 100;
    return constrain(fillLevel, 0, 100);
}

String determineStatus(float distance)
{
    if (distance <= 5)
        return "PENUH";
    if (distance <= 10)
        return "SEDANG";
    return "KOSONG";
}

void setup()
{
    Serial.begin(115200);
    while (!Serial)
        ;
    pinMode(trigPin, OUTPUT);
    pinMode(echoPin, INPUT);
    analogReadResolution(12);

    setupDisplay();
    connectWiFi();
    initializeDeviceInFirebase();
}

void loop()
{
    float voltage = readBatteryVoltage();
    Serial.print("Battery Voltage: ");
    Serial.println(voltage);
    showMessageOnLCD("Battery Volt:", String(voltage, 2) + "V");

    if (!isUSBPowered && voltage < 3.3)
    {
        Serial.println("Battery too low! Skipping upload.");
        delay(10000);
        return;
    }

    isPaused = fetchPauseStatus();
    if (isPaused)
    {
        Serial.println("Paused. Skipping data upload.");
        showMessageOnLCD("Paused", "Skip upload");
        for (int i = 0; i < updateInterval / 1000; i++)
        {
            delay(1000);
            if (!fetchPauseStatus())
                break;
        }
        return;
    }

    float distance = readDistance();
    float fillLevel = calculateFillLevel(distance);
    String status = determineStatus(distance);

    bool success = sendToFirebase(distance, status, voltage, fillLevel);
    updateDisplay(distance, status, voltage, success);
    delay(updateInterval);

    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("WiFi disconnected. Attempting to reconnect...");
        connectWiFi();
    }
}