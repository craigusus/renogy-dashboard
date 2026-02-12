# Renogy Dashboard

A web-based dashboard for monitoring Renogy devices, optimized for a 720x720 round display (Raspberry Pi + Chrome kiosk mode).

## Features

- 🔋 Real-time battery level, voltage, and current monitoring
- ☀️ Solar generation tracking
- ⚠️ Alarm and alert notifications
- 📱 Multiple device support with navigation
- 🎨 Circular gauges optimized for round displays
- 🔄 Auto-refresh every 10 seconds

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Renogy API credentials:
   ```
   RENOGY_ACCESS_KEY=your_access_key_here
   RENOGY_SECRET_KEY=your_secret_key_here
   PORT=3000
   ```

### 3. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The dashboard will be available at `http://localhost:3000`

## Raspberry Pi Setup

### 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Clone and Setup

```bash
cd ~
git clone <your-repo-url> renogy-dashboard
cd renogy-dashboard
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your API keys
```

### 4. Auto-start on Boot

Create a systemd service:

```bash
sudo nano /etc/systemd/system/renogy-dashboard.service
```

Add:
```ini
[Unit]
Description=Renogy Dashboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/renogy-dashboard
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable renogy-dashboard
sudo systemctl start renogy-dashboard
```

### 5. Chrome Kiosk Mode

Install Chromium:
```bash
sudo apt-get install chromium-browser
```

Create autostart script:
```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/dashboard.desktop
```

Add:
```ini
[Desktop Entry]
Type=Application
Name=Renogy Dashboard
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble http://localhost:3000
```

## API Endpoints

The server provides these endpoints:

- `GET /api/devices` - List all devices
- `GET /api/devices/:deviceId/latest` - Get latest device data
- `GET /api/devices/:deviceId/history` - Get solar yield history
- `GET /api/devices/:deviceId/alarms` - Get device alarms
- `GET /api/dashboard` - Get combined dashboard data

## Display Configuration

The dashboard is optimized for:
- **Resolution**: 720x720 pixels
- **Shape**: Circular display
- **Browser**: Chrome/Chromium fullscreen kiosk mode

## Customization

### Refresh Interval

Edit `public/app.js` and change:
```javascript
const REFRESH_INTERVAL = 10000; // milliseconds
```

### Gauge Colors

Edit `public/styles.css` and modify the gauge stroke colors:
```css
#batteryGauge { stroke: #00ffc8; }
#voltageGauge { stroke: #ffd700; }
#currentGauge { stroke: #ff6b6b; }
```

### Voltage/Current Ranges

Edit `public/app.js` and modify max values:
```javascript
const maxVoltage = 15; // Typical max for 12V system
const maxCurrent = 100; // Max display current
```

## Troubleshooting

### Server won't start
- Check that `.env` file exists with valid API keys
- Ensure port 3000 is not in use: `lsof -i :3000`

### No data showing
- Verify API keys are correct
- Check server logs for API errors
- Test API directly: `curl http://localhost:3000/api/devices`

### Display issues on round screen
- Ensure browser zoom is at 100%
- Check display resolution is set to 720x720
- Verify Chrome is in fullscreen kiosk mode

## License

MIT
