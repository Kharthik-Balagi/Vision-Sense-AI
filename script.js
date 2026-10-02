"use strict";
const backgroundCanvas = document.querySelector(".ambient-canvas");
const backgroundContext = backgroundCanvas?.getContext("2d");

if (backgroundCanvas && backgroundContext) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const particles = [];
  let canvasWidth = 0;
  let canvasHeight = 0;
  let animationFrame = 0;
  let previousFrame = 0;

  function resizeBackground() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    backgroundCanvas.width = Math.round(canvasWidth * pixelRatio);
    backgroundCanvas.height = Math.round(canvasHeight * pixelRatio);
    backgroundContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const targetCount = Math.min(90, Math.max(30, Math.round((canvasWidth * canvasHeight) / 14000)));
    while (particles.length < targetCount) {
      particles.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.14,
        radius: 0.8 + Math.random() * 1.4,
        hue: Math.random() > 0.55 ? 165 : 190,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particles.length = targetCount;
    drawBackground(performance.now(), 0);
  }

  function drawBackground(time, delta) {
    const context = backgroundContext;
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const glowPoints = [
      { x: canvasWidth * (0.19 + Math.sin(time * 0.00018) * 0.08), y: canvasHeight * (0.2 + Math.cos(time * 0.00014) * 0.09), color: "37, 208, 170" },
      { x: canvasWidth * (0.81 + Math.cos(time * 0.00012) * 0.1), y: canvasHeight * (0.37 + Math.sin(time * 0.00016) * 0.12), color: "63, 151, 255" },
      { x: canvasWidth * (0.49 + Math.sin(time * 0.0001) * 0.12), y: canvasHeight * (0.86 + Math.cos(time * 0.00013) * 0.08), color: "133, 229, 102" },
    ];

    glowPoints.forEach((point) => {
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, canvasWidth * 0.42);
      glow.addColorStop(0, `rgba(${point.color}, 0.11)`);
      glow.addColorStop(0.4, `rgba(${point.color}, 0.035)`);
      glow.addColorStop(1, `rgba(${point.color}, 0)`);
      context.fillStyle = glow;
      context.fillRect(0, 0, canvasWidth, canvasHeight);
    });

    const gridSize = 76;
    context.beginPath();
    context.strokeStyle = "rgba(135, 193, 198, 0.035)";
    context.lineWidth = 1;
    for (let x = (time * 0.008) % gridSize; x < canvasWidth; x += gridSize) {
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
    }
    for (let y = (time * 0.005) % gridSize; y < canvasHeight; y += gridSize) {
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
    }
    context.stroke();

    particles.forEach((particle, index) => {
      if (delta > 0) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta + Math.sin(time * 0.00055 + particle.phase) * 0.035 * delta;
        if (particle.x < -12) particle.x = canvasWidth + 12;
        if (particle.x > canvasWidth + 12) particle.x = -12;
        if (particle.y < -12) particle.y = canvasHeight + 12;
        if (particle.y > canvasHeight + 12) particle.y = -12;
      }

      for (let neighborIndex = index + 1; neighborIndex < particles.length; neighborIndex += 1) {
        const neighbor = particles[neighborIndex];
        const dx = neighbor.x - particle.x;
        const dy = neighbor.y - particle.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= 124) continue;

        const opacity = (1 - distance / 124) * 0.16;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(neighbor.x, neighbor.y);
        context.strokeStyle = `rgba(101, 206, 201, ${opacity})`;
        context.lineWidth = 0.7;
        context.stroke();
      }

      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fillStyle = `hsla(${particle.hue}, 88%, 77%, ${0.36 + Math.sin(time * 0.001 + particle.phase) * 0.19})`;
      context.fill();

      if (index % 12 === 0) {
        const pulse = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, 18);
        pulse.addColorStop(0, "rgba(107, 239, 213, 0.18)");
        pulse.addColorStop(1, "rgba(107, 239, 213, 0)");
        context.fillStyle = pulse;
        context.fillRect(particle.x - 18, particle.y - 18, 36, 36);
      }
    });

    glowPoints.slice(0, 2).forEach((point, index) => {
      const progress = (time * (index === 0 ? 0.00012 : 0.00009) + index * 0.47) % 1;
      const startX = -20;
      const endX = canvasWidth + 20;
      const startY = canvasHeight * (index === 0 ? 0.27 : 0.69);
      const curveY = canvasHeight * (index === 0 ? 0.68 : 0.29);
      const eased = progress * progress * (3 - 2 * progress);
      const x = startX + (endX - startX) * eased;
      const y = (1 - eased) * startY + eased * curveY
        + Math.sin(eased * Math.PI) * canvasHeight * (index === 0 ? 0.2 : -0.19);

      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(canvasWidth * 0.28, startY + 50, canvasWidth * 0.68, curveY - 50, endX, curveY);
      context.strokeStyle = "rgba(83, 217, 191, 0.055)";
      context.lineWidth = 1;
      context.stroke();

      context.beginPath();
      context.arc(x, y, 2.1, 0, Math.PI * 2);
      context.fillStyle = index === 0 ? "rgba(149, 255, 211, 0.9)" : "rgba(117, 194, 255, 0.84)";
      context.shadowColor = index === 0 ? "#65f1bb" : "#6bbdff";
      context.shadowBlur = 15;
      context.fill();
      context.shadowBlur = 0;
    });
  }

  function animateBackground(time) {
    const delta = previousFrame ? Math.min(time - previousFrame, 32) : 0;
    previousFrame = time;
    drawBackground(time, delta);
    if (!motionPreference.matches && !document.hidden) {
      animationFrame = window.requestAnimationFrame(animateBackground);
    }
  }

  function updateBackgroundMotion() {
    window.cancelAnimationFrame(animationFrame);
    previousFrame = 0;
    window.requestAnimationFrame(animateBackground);
  }

  window.addEventListener("resize", resizeBackground);
  document.addEventListener("visibilitychange", updateBackgroundMotion);
  motionPreference.addEventListener("change", updateBackgroundMotion);
  resizeBackground();
  updateBackgroundMotion();
}


const startSystemButton = document.getElementById("start-system");
const stopSystemButton = document.getElementById("stop-system");
const systemControlStatus = document.getElementById("system-control-status");

async function controlVisionSense(action) {
  if (!startSystemButton || !stopSystemButton || !systemControlStatus) return;

  const isStarting = action === "start";
  startSystemButton.disabled = true;
  stopSystemButton.disabled = true;
  systemControlStatus.innerHTML = '<span class="pulse-dot"></span> ' + (isStarting
    ? "Starting Vision Sense AI..."
    : "Stopping Vision Sense AI...");

  try {
    const response = await fetch(`http://127.0.0.1:8766/${action}`, {
      method: "POST",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) {
      throw new Error(result.message || "Local controller rejected the request.");
    }

    if (isStarting) { startMeasurementSession(null); } else { stopMeasurementSession(latestLiveStatus); }

    systemControlStatus.innerHTML = '<span class="pulse-dot"></span> ' + (
      isStarting
        ? "Vision Sense AI starting — camera and YOLO will appear on the laptop."
        : "Vision Sense AI stopped safely."
    );
    startSystemButton.disabled = isStarting;
    stopSystemButton.disabled = !isStarting;
  } catch (error) {
    systemControlStatus.innerHTML = '<span class="pulse-dot"></span> ' + (
      "Local controller not running. Start vision_sense_launcher.py on this laptop."
    );
    startSystemButton.disabled = false;
    stopSystemButton.disabled = true;
  }
}

startSystemButton?.addEventListener("click", () => controlVisionSense("start"));
stopSystemButton?.addEventListener("click", () => controlVisionSense("stop"));

let websiteCloseHandled = false;

function resetRuntimeDisplay() {
  for (const { runtimeId, statusId } of Object.values(runtimeDevices)) {
    const runtimeElement = document.getElementById(runtimeId);
    const statusElement = document.getElementById(statusId);
    if (runtimeElement) runtimeElement.textContent = "00:00:00";
    if (statusElement) statusElement.textContent = "OFF";
  }
  const connectionElement = document.getElementById("system-connection-status");
  if (connectionElement) {
    connectionElement.textContent = "WEBSITE CLOSED — SYSTEM STOPPED";
  }
}

function resetEnergyCalculatorDisplay() {
  const blankEnergyIds = [
    "prototype-conventional-energy",
    "prototype-smart-energy",
    "prototype-energy-saved",
    "conventional-fan-energy",
    "conventional-light-energy",
    "conventional-daily",
    "smart-fan-energy",
    "smart-light-energy",
    "smart-daily",
    "daily-difference",
    "monthly-difference",
  ];

  for (const id of blankEnergyIds) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = "— <small>kWh</small>";
  }

  const prototypePercent = document.getElementById("prototype-saving-percent");
  if (prototypePercent) prototypePercent.textContent = "Waiting for a fresh measurement session";

  const energyPercent = document.getElementById("energy-saving-percent");
  if (energyPercent) energyPercent.textContent = "— % net energy difference";

  const monthlyCost = document.getElementById("monthly-cost");
  if (monthlyCost) monthlyCost.textContent = "—";

  const smartFanTime = document.getElementById("smart-fan-time");
  if (smartFanTime) smartFanTime.textContent = "Projected run time: -- h/device/day";

  const smartLightTime = document.getElementById("smart-light-time");
  if (smartLightTime) smartLightTime.textContent = "Projected run time: -- h/device/day";

  // Reset to the default 7-hour school day until a fresh calculation is made.
  // Vision Sense AI = 30 W, so 30 × 7 / 1000 = 0.21 kWh/day.
  const smartAiEnergy = document.getElementById("smart-ai-energy");
  if (smartAiEnergy) smartAiEnergy.innerHTML = formatEnergy(0.21);

  const smartAiTime = document.getElementById("smart-ai-time");
  if (smartAiTime) smartAiTime.textContent = "AI system power: 30.0 W × 7.00 h/day";

  latestMeasurement = null;
  measurementState = {
    activeSeconds: 0,
    inactiveSeconds: 0,
    lastTimestamp: 0,
    lastAiActive: false,
    lastPersonDetected: false,
    lastCameraOff: false,
    initialized: false,
    running: false,
    liveStarted: false,
    runtimeBaseline: null,
  };
  saveMeasurementState();
}

function requestWebsiteCloseShutdown() {
  if (websiteCloseHandled) return;
  websiteCloseHandled = true;

  resetRuntimeDisplay();
  latestMeasurement = null;

  const url = "http://127.0.0.1:8765/shutdown_and_reset";
  const payload = new Blob(["website-close"], { type: "text/plain" });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, payload);
      return;
    }
  } catch {
    // Fall through to keepalive fetch.
  }

  try {
    fetch(url, {
      method: "POST",
      body: payload,
      cache: "no-store",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // The page may already be unloading; there is nothing else to do here.
  }
}

// Closing, refreshing, or navigating away from the website requests a clean
// AI shutdown and clears the device runtime dashboard for the next session.
window.addEventListener("pagehide", requestWebsiteCloseShutdown);

const runtimeDevices = {
  "z1-fan": { runtimeId: "z1-fan-runtime", statusId: "z1-fan-status" },
  "z1-light": { runtimeId: "z1-light-runtime", statusId: "z1-light-status" },
  "z2-fan": { runtimeId: "z2-fan-runtime", statusId: "z2-fan-status" },
  "z2-light": { runtimeId: "z2-light-runtime", statusId: "z2-light-status" },
};

// Update a device only when the local status endpoint supplies real runtime data.
function updateRuntime(device, seconds, isOn) {
  const elements = runtimeDevices[device];
  if (!elements) {
    throw new RangeError(`Unknown runtime device: ${device}`);
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError("Runtime seconds must be a finite, non-negative number.");
  }
  if (typeof isOn !== "boolean") {
    throw new TypeError("Device status must be a boolean.");
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  document.getElementById(elements.runtimeId).textContent = [
    hours,
    minutes,
    remainingSeconds,
  ].map((part) => String(part).padStart(2, "0")).join(":");
  document.getElementById(elements.statusId).textContent = isOn ? "ON" : "OFF";
}

function updateTemperatureStatus(status) {
  const readout = document.getElementById("live-temperature");
  const sensorStatus = document.getElementById("temperature-sensor-status");
  const fanCondition = document.getElementById("temperature-fan-condition");
  const sensorNote = document.getElementById("temperature-sensor-note");

  if (!readout || !sensorStatus || !fanCondition || !sensorNote) return;

  const hasTemperature = status.temperature_valid === true
    && Number.isFinite(status.temperature);

  if (!hasTemperature) {
    readout.textContent = "--";
    sensorStatus.textContent = "AWAITING DATA";
    fanCondition.textContent = "Waiting for sensor data";
    sensorNote.textContent = "Waiting for live DHT22 temperature data from Arduino.";
    return;
  }

  readout.textContent = status.temperature.toFixed(1);
  sensorStatus.textContent = "LIVE";
  fanCondition.textContent = status.cooling_allowed ? "FAN ALLOWED" : "FAN OFF";
  sensorNote.textContent = status.cooling_allowed
    ? "Temperature is above the 29°C cooling threshold."
    : "Temperature is at or below the 29°C cooling threshold.";
}

function updateSystemConnection(isConnected) {
  if (typeof isConnected !== "boolean") {
    throw new TypeError("Connection status must be a boolean.");
  }

  document.getElementById("system-connection-status").textContent = isConnected
    ? "ARDUINO CONNECTED"
    : "ARDUINO DISCONNECTED — CHECK USB CABLE";
}

const liveRuntimeDevices = [
  { key: "zone1_fan", device: "z1-fan" },
  { key: "zone1_light", device: "z1-light" },
  { key: "zone2_fan", device: "z2-fan" },
  { key: "zone2_light", device: "z2-light" },
];
let latestLiveStatus = null;
let latestMeasurement = null;

async function refreshLiveStatus() {
  try {
    const status = await fetchCurrentStatus(); latestLiveStatus = status; updateEnergyRuntime(status); if (measurementState.running) { latestMeasurement = updateAutomaticMeasurement(status); } else if (measurementState.initialized) { latestMeasurement = getMeasurementSnapshot(status); } updateTemperatureStatus(status);
  } catch {
    latestLiveStatus = null; updateTemperatureStatus({temperature_valid:false, temperature:null, cooling_allowed:false});
  } finally {
    window.setTimeout(refreshLiveStatus, 1000);
  }
}

async function fetchCurrentStatus() {
  const response = await fetch("http://127.0.0.1:8765/status", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Status server returned HTTP ${response.status}.`);
  }

  const status = await response.json();
  if (typeof status.connected !== "boolean" || typeof status.ai_active !== "boolean") {
    throw new TypeError("Status response has no valid connection state.");
  }
  if (status.temperature !== null && !Number.isFinite(status.temperature)) {
    throw new TypeError("Status response has invalid temperature data.");
  }
  if (typeof status.temperature_valid !== "boolean"
    || typeof status.cooling_allowed !== "boolean") {
    throw new TypeError("Status response has invalid temperature state.");
  }

  for (const { key } of liveRuntimeDevices) {
    if (typeof status[key] !== "boolean"
      || !Number.isFinite(status[`${key}_runtime`])
      || status[`${key}_runtime`] < 0) {
      throw new TypeError(`Status response has invalid data for ${key}.`);
    }
  }
  return status;
}

const measurementStorageKey = "visionSensePrototypeMeasurementV2";
let measurementState = {
  activeSeconds: 0,
  inactiveSeconds: 0,
  lastTimestamp: 0,
  lastAiActive: false,
  lastPersonDetected: false,
  lastCameraOff: false,
  initialized: false,
  running: false,
  liveStarted: false,
  runtimeBaseline: null,
};

function saveMeasurementState() {
  try {
    localStorage.setItem(measurementStorageKey, JSON.stringify(measurementState));
  } catch {
    // The live calculation continues even when browser storage is unavailable.
  }
}

function loadMeasurementState() {
  // A measurement session must never start just because the page was opened.
  // Only the START SYSTEM control can create a fresh session.
  measurementState = {
    activeSeconds: 0,
    inactiveSeconds: 0,
    lastTimestamp: 0,
    lastAiActive: false,
    lastPersonDetected: false,
    lastCameraOff: false,
    initialized: false,
    running: false,
    liveStarted: false,
    runtimeBaseline: null,
  };
}

function startMeasurementSession(status = null) {
  measurementState = {
    activeSeconds: 0,
    inactiveSeconds: 0,
    lastTimestamp: 0,
    lastAiActive: false,
    lastPersonDetected: false,
    lastCameraOff: false,
    initialized: false,
    running: true,
    liveStarted: false,
    runtimeBaseline: null,
  };
  latestMeasurement = null;
}

function stopMeasurementSession(status = null) {
  if (!measurementState.running) return;
  if (status) updateAutomaticMeasurement(status);
  measurementState.running = false;
  latestMeasurement = getMeasurementSnapshot(status || latestLiveStatus);
  saveMeasurementState();
}

function updateAutomaticMeasurement(status) {
  if (!measurementState.running) return getMeasurementSnapshot(status);
  if (!status) return getMeasurementSnapshot(status);

  // The measurement clock follows the AI state, not the Arduino connection flag.
  // Arduino may reconnect independently while the camera/AI session continues.

  const now = Date.now();

  if (!measurementState.liveStarted) {
    // Do not count Python startup as camera-off time. The measurement clock
    // begins only when the live AI actually reports active.
    if (status.ai_active !== true) {
      return getMeasurementSnapshot(status);
    }
    measurementState.liveStarted = true;
    measurementState.initialized = true;
    measurementState.lastTimestamp = now;
    measurementState.lastAiActive = true;
    measurementState.lastPersonDetected = status.zone1 === true || status.zone2 === true;
    measurementState.lastCameraOff = false;
    measurementState.runtimeBaseline = {
      zone1_fan: Number(status.zone1_fan_runtime) || 0,
      zone2_fan: Number(status.zone2_fan_runtime) || 0,
      zone1_light: Number(status.zone1_light_runtime) || 0,
      zone2_light: Number(status.zone2_light_runtime) || 0,
    };
  } else {
    const elapsed = Math.max(0, (now - measurementState.lastTimestamp) / 1000);

    // Measure only the two periods that belong in the energy test:
    // 1) a person is actually detected in Zone 1 or Zone 2
    // 2) the camera/AI is in standby after no person is detected
    //
    // Do not count the startup/transition period while AI is active but no
    // person is occupying either zone. This prevents extra waiting time from
    // inflating the observation total.
    const personDetected = status.zone1 === true || status.zone2 === true;
    const cameraOff = status.ai_active !== true;

    if (measurementState.lastPersonDetected === true) {
      measurementState.activeSeconds += elapsed;
    } else if (measurementState.lastCameraOff === true) {
      measurementState.inactiveSeconds += elapsed;
    }

    measurementState.lastTimestamp = now;
    measurementState.lastPersonDetected = personDetected;
    measurementState.lastCameraOff = cameraOff;
    measurementState.lastAiActive = status.ai_active === true;
  }

  saveMeasurementState();
  return getMeasurementSnapshot(status);
}

function getMeasurementSnapshot(status) {
  const baseline = measurementState.runtimeBaseline || {
    zone1_fan: Number(status?.zone1_fan_runtime) || 0,
    zone2_fan: Number(status?.zone2_fan_runtime) || 0,
    zone1_light: Number(status?.zone1_light_runtime) || 0,
    zone2_light: Number(status?.zone2_light_runtime) || 0,
  };
  return {
    activeSeconds: Math.max(0, measurementState.activeSeconds),
    inactiveSeconds: Math.max(0, measurementState.inactiveSeconds),
    observationSeconds: Math.max(0, measurementState.activeSeconds + measurementState.inactiveSeconds),
    zone1FanSeconds: Math.max(0, (Number(status?.zone1_fan_runtime) || 0) - baseline.zone1_fan),
    zone2FanSeconds: Math.max(0, (Number(status?.zone2_fan_runtime) || 0) - baseline.zone2_fan),
    zone1LightSeconds: Math.max(0, (Number(status?.zone1_light_runtime) || 0) - baseline.zone1_light),
    zone2LightSeconds: Math.max(0, (Number(status?.zone2_light_runtime) || 0) - baseline.zone2_light),
  };
}

function renderAutomaticMeasurement(status, measurement) {
  showMeasurementReadings({
    active: measurement.activeSeconds,
    inactive: measurement.inactiveSeconds,
    observation: measurement.observationSeconds,
    zone1Fan: measurement.zone1FanSeconds,
    zone2Fan: measurement.zone2FanSeconds,
    zone1Light: measurement.zone1LightSeconds,
    zone2Light: measurement.zone2LightSeconds,
  });

  const systemState = measurementState.running
    ? (status.ai_active === true ? "Camera / AI active" : "Camera / AI off")
    : "Measurement stopped";
  document.getElementById("measurement-status").textContent =
    `${systemState} · Active ${formatRuntime(measurement.activeSeconds)} · Camera off ${formatRuntime(measurement.inactiveSeconds)}`;
  liveMeasurementSummary.textContent =
    `Active ${formatRuntime(measurement.activeSeconds)} · Camera off ${formatRuntime(measurement.inactiveSeconds)} · Total ${formatRuntime(measurement.observationSeconds)}`;
}

loadMeasurementState();
refreshLiveStatus();

// PWA registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .catch(() => {
        // The website remains fully usable when service-worker registration is unavailable.
      });
  });
}



/* Energy impact calculator: measured prototype runtime -> classroom/school projection */
const energyForm = document.getElementById("energy-calculator-form");
const energyValidation = document.getElementById("energy-validation");
const energyRuntimeSource = document.getElementById("energy-runtime-source");

const energyRuntimeFields = {
  zone1_fan: document.getElementById("calc-z1-fan"),
  zone1_light: document.getElementById("calc-z1-light"),
  zone2_fan: document.getElementById("calc-z2-fan"),
  zone2_light: document.getElementById("calc-z2-light"),
};

const energyInputs = {
  fanWatts: document.getElementById("energy-fan-watts"),
  lightWatts: document.getElementById("energy-light-watts"),
  fansPerZone: document.getElementById("energy-fans-per-zone"),
  lightsPerZone: document.getElementById("energy-lights-per-zone"),
  hours: document.getElementById("energy-hours"),
  days: document.getElementById("energy-days"),
  classrooms: document.getElementById("energy-classrooms"),
  tariff: document.getElementById("energy-tariff"),
};

let latestEnergyRuntime = {
  zone1_fan_runtime: 0,
  zone1_light_runtime: 0,
  zone2_fan_runtime: 0,
  zone2_light_runtime: 0,
};

function formatEnergyRuntime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
}

function updateEnergyRuntime(status) {
  if (!status) return;

  const measured = latestMeasurement && Number(latestMeasurement.observationSeconds) > 0
    ? {
        zone1_fan_runtime: Number(latestMeasurement.zone1FanSeconds) || 0,
        zone1_light_runtime: Number(latestMeasurement.zone1LightSeconds) || 0,
        zone2_fan_runtime: Number(latestMeasurement.zone2FanSeconds) || 0,
        zone2_light_runtime: Number(latestMeasurement.zone2LightSeconds) || 0,
      }
    : null;

  const source = measured || {
    zone1_fan_runtime: Number(status.zone1_fan_runtime) || 0,
    zone1_light_runtime: Number(status.zone1_light_runtime) || 0,
    zone2_fan_runtime: Number(status.zone2_fan_runtime) || 0,
    zone2_light_runtime: Number(status.zone2_light_runtime) || 0,
  };

  Object.keys(energyRuntimeFields).forEach((field) => {
    latestEnergyRuntime[field] = Math.max(0, source[field] || 0);
    const element = energyRuntimeFields[field];
    if (element) element.textContent = formatEnergyRuntime(latestEnergyRuntime[field]);
  });

  const measuredTotal = Object.values(latestEnergyRuntime).reduce((sum, value) => sum + value, 0);
  if (energyRuntimeSource) {
    energyRuntimeSource.textContent = measured
      ? "Latest measured session runtime"
      : measuredTotal > 0
        ? "Live system runtime"
        : "No measured runtime yet";
  }
}
function readPositiveInput(input, label, allowZero = false) {
  const value = Number(input?.value);
  const minimum = allowZero ? 0 : Number.EPSILON;
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be ${allowZero ? "zero or greater" : "greater than zero"}.`);
  }
  return value;
}

function formatKwh(value) {
  if (!Number.isFinite(value)) return "—";
  return value < 10 ? value.toFixed(3) : value.toFixed(2);
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function calculateEnergyImpact() {
  const fanWatts = readPositiveInput(energyInputs.fanWatts, "Fan power");
  const lightWatts = readPositiveInput(energyInputs.lightWatts, "Light power");
  const fansPerZone = readPositiveInput(energyInputs.fansPerZone, "Fans per zone", true);
  const lightsPerZone = readPositiveInput(energyInputs.lightsPerZone, "Lights per zone", true);
  const hours = readPositiveInput(energyInputs.hours, "Classroom hours");
  const days = readPositiveInput(energyInputs.days, "School days");
  const classrooms = readPositiveInput(energyInputs.classrooms, "Classrooms");
  const tariff = readPositiveInput(energyInputs.tariff, "Electricity tariff", true);

  const zoneCount = 2;
  const conventionalDailyKwh =
    (((fanWatts * fansPerZone) + (lightWatts * lightsPerZone)) * zoneCount * hours) / 1000;

  const observationSeconds = Number(latestMeasurement?.observationSeconds) || 0;
  if (observationSeconds <= 0) {
    throw new Error("No completed measurement session is available. Start the system, observe a representative period, then stop it before calculating.");
  }

  const measuredSmartWh =
    fanWatts * fansPerZone *
      ((Number(latestMeasurement.zone1FanSeconds) + Number(latestMeasurement.zone2FanSeconds)) / 3600)
    + lightWatts * lightsPerZone *
      ((Number(latestMeasurement.zone1LightSeconds) + Number(latestMeasurement.zone2LightSeconds)) / 3600);

  const observationHours = observationSeconds / 3600;
  if (observationHours <= 0) {
    throw new Error("The measurement observation time is zero. Run the prototype for a measurable period.");
  }

  // Convert the measured prototype energy into an average smart-system power
  // over the observation, then project that average behaviour across the
  // classroom's stated daily operating hours.
  const averageSmartWatts = (measuredSmartWh / observationHours);
  const smartDailyKwh = Math.min(
    (averageSmartWatts * hours) / 1000,
    conventionalDailyKwh
  );

  const savedDailyKwh = Math.max(0, conventionalDailyKwh - smartDailyKwh);
  const savingPercent = conventionalDailyKwh > 0
    ? (savedDailyKwh / conventionalDailyKwh) * 100
    : 0;

  const annualSavedKwh = savedDailyKwh * days * 12 * classrooms;
  const annualCostSaved = annualSavedKwh * tariff;

  document.getElementById("energy-conventional").textContent = formatKwh(conventionalDailyKwh);
  document.getElementById("energy-smart").textContent = formatKwh(smartDailyKwh);
  document.getElementById("energy-saved").textContent = `${formatKwh(savedDailyKwh)} kWh`;
  document.getElementById("energy-saved-period").textContent =
    `${formatKwh(savedDailyKwh)} kWh saved per classroom per school day`;
  document.getElementById("energy-percent").textContent = `${savingPercent.toFixed(1)}%`;
  document.getElementById("energy-annual").textContent = formatKwh(annualSavedKwh);
  document.getElementById("energy-cost").textContent = formatMoney(annualCostSaved);
  document.getElementById("energy-scale").textContent = String(Math.round(classrooms));

  return { conventionalDailyKwh, smartDailyKwh, savedDailyKwh, savingPercent, annualSavedKwh, annualCostSaved };
}

energyForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (energyValidation) energyValidation.textContent = "";

  try {
    calculateEnergyImpact();
  } catch (error) {
    if (energyValidation) energyValidation.textContent = error instanceof Error ? error.message : "Please check the calculator inputs.";
  }
});
