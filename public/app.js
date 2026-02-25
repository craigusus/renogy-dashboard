// Configuration
const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 60000; // 60 seconds

// State
let rawData = null;
let currentLocation = 'house';
let refreshTimer = null;

// DOM Elements
const elements = {
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  errorMessage: document.getElementById('errorMessage'),
  deviceName: document.getElementById('deviceName'),
  prevDevice: document.getElementById('prevDevice'),
  nextDevice: document.getElementById('nextDevice'),
  solarPower: document.getElementById('solarPower'),
  solarAmps: document.getElementById('solarAmps'),
  solarVolts: document.getElementById('solarVolts'),
  batteriesSection: document.getElementById('batteriesSection'),
  battery1Percent: document.getElementById('battery1Percent'),
  battery1Volts: document.getElementById('battery1Volts'),
  battery2Percent: document.getElementById('battery2Percent'),
  battery2Volts: document.getElementById('battery2Volts'),
  combinedGauge: document.getElementById('combinedGauge'),
  combinedValue: document.getElementById('combinedValue'),
  combinedBattery: document.querySelector('.combined-battery'),
  totalBatteryDisplay: document.getElementById('totalBatteryDisplay'),
  totalBatteryPercent: document.getElementById('totalBatteryPercent')
};

// Initialize gauge
function initGauge() {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  elements.combinedGauge.style.strokeDasharray = circumference;
  elements.combinedGauge.style.strokeDashoffset = circumference;
}

// Update gauge
function updateGauge(percentage) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  elements.combinedGauge.style.strokeDashoffset = offset;

  // Update color based on battery level
  let color;
  if (percentage >= 50) {
    color = '#4caf50'; // Green
  } else if (percentage >= 25) {
    color = '#ffc107'; // Yellow
  } else {
    color = '#f44336'; // Red
  }
  elements.combinedGauge.style.stroke = color;
}

// Format number
function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined) return '--';
  return Number(value).toFixed(decimals);
}

// Organize devices by location
function organizeDevices(data) {
  if (!data || data.length === 0) return null;

  const mainDevice = data[0];
  const sublist = mainDevice.sublist || [];

  const houseController = sublist.find(d => d.name === 'Controller House');
  const shedController = sublist.find(d => d.name === 'Controller Shed');
  const batteries = sublist.filter(d => d.category === 'Battery');

  return {
    house: {
      controller: houseController,
      batteries: batteries,
      name: 'House'
    },
    shed: {
      controller: shedController,
      batteries: [],
      name: 'Shed'
    }
  };
}

// Update display
function updateDisplay() {
  if (!rawData) return;

  const organized = organizeDevices(rawData);
  if (!organized) {
    showError('No device data available');
    return;
  }

  const location = organized[currentLocation];
  if (!location) {
    showError(`No data for ${currentLocation}`);
    return;
  }

  // Update location name
  elements.deviceName.textContent = location.name;

  // Update controller data (solar section)
  const controller = location.controller;
  if (controller && controller.latestData) {
    const data = controller.latestData;
    elements.solarPower.textContent = `${formatNumber(data.solarWatts || 0, 1)} W`;
    elements.solarAmps.textContent = `${formatNumber(data.solarAmps || 0, 1)} A`;
    elements.solarVolts.textContent = `${formatNumber(data.solarVolts || 0, 1)} V`;
  } else {
    elements.solarPower.textContent = '-- W';
    elements.solarAmps.textContent = '-- A';
    elements.solarVolts.textContent = '-- V';
  }

  // Show/hide batteries and gauge
  if (location.batteries.length > 0) {
    elements.batteriesSection.classList.remove('hidden');
    elements.combinedBattery.classList.remove('hidden');
    updateBatteries(location.batteries);
  } else {
    elements.batteriesSection.classList.add('hidden');
    elements.combinedBattery.classList.add('hidden');
    elements.totalBatteryDisplay.classList.add('hidden');
  }
}

// Update batteries
function updateBatteries(batteries) {
  // Battery 1
  if (batteries[0]) {
    const b1 = batteries[0].latestData || {};
    elements.battery1Percent.textContent = `${formatNumber(b1.batteryLevel || 0, 0)}%`;
    elements.battery1Volts.textContent = `${formatNumber(b1.presentVolts || 0, 1)} V`;
  } else {
    elements.battery1Percent.textContent = '--%';
    elements.battery1Volts.textContent = '-- V';
  }

  // Battery 2
  if (batteries[1]) {
    const b2 = batteries[1].latestData || {};
    elements.battery2Percent.textContent = `${formatNumber(b2.batteryLevel || 0, 0)}%`;
    elements.battery2Volts.textContent = `${formatNumber(b2.presentVolts || 0, 1)} V`;
  } else {
    elements.battery2Percent.textContent = '--%';
    elements.battery2Volts.textContent = '-- V';
  }

  // Combined level
  let totalLevel = 0;
  let count = 0;
  batteries.forEach(battery => {
    const data = battery.latestData || {};
    if (data.batteryLevel !== undefined) {
      totalLevel += data.batteryLevel;
      count++;
    }
  });

  const combinedLevel = count > 0 ? totalLevel / count : 0;
  updateGauge(combinedLevel);
  elements.combinedValue.textContent = `${formatNumber(combinedLevel, 0)}%`;
  elements.totalBatteryPercent.textContent = `${formatNumber(combinedLevel, 0)}%`;
  elements.totalBatteryDisplay.classList.remove('hidden');
}

// Fetch dashboard data
async function fetchDashboardData() {
  try {
    const response = await fetch(`${API_BASE}/api/dashboard`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    rawData = await response.json();

    if (!rawData || rawData.length === 0) {
      throw new Error('No devices found');
    }

    updateDisplay();
    elements.loading.classList.add('hidden');
    elements.error.style.display = 'none';

  } catch (error) {
    console.error('Error:', error);
    showError(`Failed to load: ${error.message}`);
  }
}

// Show error
function showError(message) {
  elements.loading.classList.add('hidden');
  elements.error.style.display = 'block';
  elements.errorMessage.textContent = message;
}

// Navigate
function showHouse() {
  currentLocation = 'house';
  updateDisplay();
}

function showShed() {
  currentLocation = 'shed';
  updateDisplay();
}

// Auto-refresh
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(fetchDashboardData, REFRESH_INTERVAL);
}

// Initialize
async function init() {
  initGauge();
  elements.prevDevice.addEventListener('click', showHouse);
  elements.nextDevice.addEventListener('click', showShed);
  await fetchDashboardData();
  startAutoRefresh();
}

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Visibility handling
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  } else {
    fetchDashboardData();
    startAutoRefresh();
  }
});
