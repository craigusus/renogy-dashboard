const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const RENOGY_BASE_URL = 'https://openapi.renogy.com';
const ACCESS_KEY = process.env.RENOGY_ACCESS_KEY;
const SECRET_KEY = process.env.RENOGY_SECRET_KEY;

// Cache configuration
const CACHE_TTL = 60000; // 60 seconds cache
const cache = new Map();

function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params)}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Calculate HMAC-SHA256 signature for Renogy API
function calcSign(url, paramStr, ts, secretKey) {
  const strToSign = `${ts}.${url}.${paramStr}`;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(strToSign);
  return hmac.digest('base64');
}

// Make authenticated request to Renogy API with caching
async function renogyRequest(endpoint, params = {}) {
  // Check cache first
  const cacheKey = getCacheKey(endpoint, params);
  const cached = getFromCache(cacheKey);
  if (cached) {
    console.log(`Cache hit: ${cacheKey}`);
    return cached;
  }

  const timestamp = Date.now();
  const url = endpoint;
  const paramStr = new URLSearchParams(params).toString();
  const signature = calcSign(url, paramStr, timestamp, SECRET_KEY);

  const fullUrl = `${RENOGY_BASE_URL}${endpoint}${paramStr ? '?' + paramStr : ''}`;

  try {
    console.log(`API call: ${endpoint}`);
    const response = await axios.get(fullUrl, {
      headers: {
        'Access-Key': ACCESS_KEY,
        'Timestamp': timestamp.toString(),
        'Signature': signature
      }
    });

    // Cache the response
    setCache(cacheKey, response.data);

    return response.data;
  } catch (error) {
    console.error('Renogy API Error:', error.response?.data || error.message);
    throw error;
  }
}

// API Routes

// Get all devices
app.get('/api/devices', async (req, res) => {
  try {
    const data = await renogyRequest('/device/list');
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch devices',
      details: error.response?.data || error.message
    });
  }
});

// Get device data map
app.get('/api/devices/:deviceId/datamap', async (req, res) => {
  try {
    const data = await renogyRequest(`/device/datamap/${req.params.deviceId}`);
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch device datamap',
      details: error.response?.data || error.message
    });
  }
});

// Get latest device data
app.get('/api/devices/:deviceId/latest', async (req, res) => {
  try {
    const data = await renogyRequest(`/device/data/latest/${req.params.deviceId}`);
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch latest device data',
      details: error.response?.data || error.message
    });
  }
});

// Get device history (solar yield)
app.get('/api/devices/:deviceId/history', async (req, res) => {
  try {
    const { year, month, utcOffsetHours } = req.query;
    const data = await renogyRequest(`/device/data/history/${req.params.deviceId}`, {
      year: year || new Date().getFullYear(),
      month: month || (new Date().getMonth() + 1),
      utcOffsetHours: utcOffsetHours || 0
    });
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch device history',
      details: error.response?.data || error.message
    });
  }
});

// Get device alarms
app.get('/api/devices/:deviceId/alarms', async (req, res) => {
  try {
    const data = await renogyRequest(`/device/alarm/${req.params.deviceId}`);
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch device alarms',
      details: error.response?.data || error.message
    });
  }
});

// Get device logs (Zigbee devices)
app.get('/api/devices/:deviceId/logs', async (req, res) => {
  try {
    const data = await renogyRequest(`/device/log/${req.params.deviceId}`);
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch device logs',
      details: error.response?.data || error.message
    });
  }
});

// Test endpoint to verify API credentials
app.get('/api/test', async (req, res) => {
  try {
    if (!ACCESS_KEY || !SECRET_KEY) {
      return res.status(500).json({
        error: 'Missing credentials',
        details: 'ACCESS_KEY or SECRET_KEY not configured in .env file'
      });
    }

    const data = await renogyRequest('/device/list');
    res.json({
      success: true,
      message: 'API credentials are working!',
      deviceCount: data.length,
      devices: data
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: 'API test failed',
      statusCode: error.response?.status,
      statusText: error.response?.statusText,
      details: error.response?.data || error.message,
      headers: error.response?.headers
    });
  }
});

// Combined endpoint for dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    // Get all devices first
    const devices = await renogyRequest('/device/list');

    // Process each device and its subdevices
    const dashboardData = await Promise.all(
      devices.map(async (device) => {
        try {
          // Fetch data for main device
          const [latest, alarms] = await Promise.all([
            renogyRequest(`/device/data/latest/${device.deviceId}`).catch(() => ({ data: {} })),
            renogyRequest(`/device/alarm/${device.deviceId}`).catch(() => [])
          ]);

          // Fetch data for all subdevices if they exist
          let sublistWithData = [];
          if (device.sublist && device.sublist.length > 0) {
            sublistWithData = await Promise.all(
              device.sublist.map(async (subDevice) => {
                try {
                  const [subLatest, subAlarms] = await Promise.all([
                    renogyRequest(`/device/data/latest/${subDevice.deviceId}`).catch(() => ({ data: {} })),
                    renogyRequest(`/device/alarm/${subDevice.deviceId}`).catch(() => [])
                  ]);

                  return {
                    ...subDevice,
                    latestData: subLatest.data || {},
                    alarms: subAlarms || []
                  };
                } catch (err) {
                  console.error(`Error fetching data for subdevice ${subDevice.deviceId}:`, err.message);
                  return {
                    ...subDevice,
                    latestData: {},
                    alarms: [],
                    error: err.message
                  };
                }
              })
            );
          }

          return {
            ...device,
            latestData: latest.data || {},
            alarms: alarms || [],
            sublist: sublistWithData
          };
        } catch (err) {
          console.error(`Error fetching data for device ${device.deviceId}:`, err.message);
          return {
            ...device,
            latestData: {},
            alarms: [],
            sublist: [],
            error: err.message
          };
        }
      })
    );

    res.json(dashboardData);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch dashboard data',
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Renogy Dashboard Server running on http://localhost:${PORT}`);
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.warn('WARNING: RENOGY_ACCESS_KEY and RENOGY_SECRET_KEY not set in .env file');
  }
});
