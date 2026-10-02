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

    if (isStarting) {
      startMeasurementSession(null);
    } else {
      stopMeasurementSession(latestLiveStatus);
      if (latestLiveStatus) renderAutomaticMeasurement(latestLiveStatus, latestMeasurement);
    }

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
    const status = await fetchCurrentStatus();
    for (const { key, device } of liveRuntimeDevices) {
      updateRuntime(device, status[`${key}_runtime`], status[key]);
    }

    latestLiveStatus = status;
    if (measurementState.running) {
      latestMeasurement = updateAutomaticMeasurement(status);
    } else if (measurementState.initialized) {
      latestMeasurement = getMeasurementSnapshot(status);
    }
    if (latestMeasurement) {
      renderAutomaticMeasurement(status, latestMeasurement);
    }
    updateSystemConnection(status.connected);
    updateTemperatureStatus(status);
  } catch {
    latestLiveStatus = null;
    document.getElementById("system-connection-status").textContent = "WAITING FOR ARDUINO CONNECTION";
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

const energyForm = document.querySelector("#energy-form");
const formError = document.querySelector("#form-error");
const liveMeasurementSummary = document.querySelector("#prototype-measured-basis");
const measurementReadoutIds = {
  active: "prototype-active-time",
  inactive: "prototype-camera-off-time",
  observation: "prototype-observation-time",
  zone1Fan: "prototype-z1-fan-time",
  zone2Fan: "prototype-z2-fan-time",
  zone1Light: "prototype-z1-light-time",
  zone2Light: "prototype-z2-light-time",
};

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fanOptions = {
  induction: { watts: 70, range: "Typical range: 65–75 W · calculation value: 70 W" },
  bldc: { watts: 32, range: "Typical range: 28–35 W · calculation value: 32 W" },
};
const lightOptions = {
  "led-tube": { watts: 20, range: "Typical range: 18–22 W · calculation value: 20 W" },
  "led-bulb": { watts: 10, range: "Typical range: 7–12 W · calculation value: 10 W" },
  fluorescent: { watts: 38, range: "Typical range: 36–40 W · calculation value: 38 W" },
  incandescent: { watts: 80, range: "Typical range: 60–100 W · calculation value: 80 W" },
};

function formatEnergy(value, unit = "kWh") {
  if (!Number.isFinite(value)) return `-- <small>${unit}</small>`;
  const decimals = Math.abs(value) < 0.001 && value !== 0 ? 6 : 3;
  return `${value.toFixed(decimals)} <small>${unit}</small>`;
}

function formatRuntime(seconds) {
  const wholeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min ${remainingSeconds} sec`;
  if (minutes > 0) return `${minutes} min ${remainingSeconds} sec`;
  return `${remainingSeconds} sec`;
}

function formatHours(value) {
  return `${value.toFixed(4)} h`;
}

function displayError(message, field) {
  formError.textContent = message;
  formError.hidden = false;
  if (field) field.focus();
}

const fanTypeInput = document.querySelector("#fan-type");
const lightTypeInput = document.querySelector("#light-type");
const customFanField = document.querySelector("#custom-fan-field");
const customLightField = document.querySelector("#custom-light-field");
const customFanPowerInput = document.querySelector("#custom-fan-power");
const customLightPowerInput = document.querySelector("#custom-light-power");

function updateEquipmentSelection(typeSelect, options, customField, customInput, range, selectedPower) {
  const isCustom = typeSelect.value === "custom";
  customField.hidden = !isCustom;
  customInput.required = isCustom;

  if (isCustom) {
    range.textContent = "Enter the exact rated power shown on the device.";
    selectedPower.textContent = customInput.value ? `${customInput.value} W` : "Enter custom rating";
    return;
  }

  const option = options[typeSelect.value];
  range.textContent = option.range;
  selectedPower.textContent = `${option.watts} W`;
}

function updateEquipmentLabels() {
  updateEquipmentSelection(
    fanTypeInput, fanOptions, customFanField, customFanPowerInput,
    document.querySelector("#fan-range"), document.querySelector("#selected-fan-power")
  );
  updateEquipmentSelection(
    lightTypeInput, lightOptions, customLightField, customLightPowerInput,
    document.querySelector("#light-range"), document.querySelector("#selected-light-power")
  );
}

fanTypeInput.addEventListener("change", updateEquipmentLabels);
lightTypeInput.addEventListener("change", updateEquipmentLabels);
customFanPowerInput.addEventListener("input", updateEquipmentLabels);
customLightPowerInput.addEventListener("input", updateEquipmentLabels);
updateEquipmentLabels();

function showMeasurementReadings(readings = null) {
  for (const [key, id] of Object.entries(measurementReadoutIds)) {
    const element = document.getElementById(id);
    if (!element) continue;
    if (!readings) {
      element.textContent = key.includes("Utilization") ? "--%" : "--";
    } else {
      element.textContent = formatRuntime(readings[key]);
    }
  }
}

const measurementStorageKey = "visionSensePrototypeMeasurementV2";
let measurementState = {
  activeSeconds: 0,
  inactiveSeconds: 0,
  lastTimestamp: 0,
  lastAiActive: false,
  initialized: false,
  running: false,
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
    measurementState.runtimeBaseline = {
      zone1_fan: Number(status.zone1_fan_runtime) || 0,
      zone2_fan: Number(status.zone2_fan_runtime) || 0,
      zone1_light: Number(status.zone1_light_runtime) || 0,
      zone2_light: Number(status.zone2_light_runtime) || 0,
    };
  } else {
    const elapsed = Math.max(0, (now - measurementState.lastTimestamp) / 1000);
    if (measurementState.lastAiActive) {
      measurementState.activeSeconds += elapsed;
    } else {
      measurementState.inactiveSeconds += elapsed;
    }
    measurementState.lastTimestamp = now;
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

  updatePrototypeResults(
    measurement,
    getSelectedPower(fanTypeInput, fanOptions, customFanPowerInput),
    getSelectedPower(lightTypeInput, lightOptions, customLightPowerInput),
    Number(document.querySelector("#vision-sense-ai-power")?.value)
  );
}

function getSelectedPower(typeSelect, options, customInput) {
  if (typeSelect.value === "custom") {
    const value = Number(customInput.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  return options[typeSelect.value]?.watts ?? null;
}

function updatePrototypeResults(measurement, fanPower, lightPower, aiPower) {
  const basisElement = document.querySelector("#prototype-measured-basis");
  if (!Number.isFinite(fanPower) || !Number.isFinite(lightPower) || !Number.isFinite(aiPower) || aiPower < 0) {
    document.querySelector("#prototype-conventional-energy").innerHTML = "— <small>kWh/day</small>";
    document.querySelector("#prototype-smart-energy").innerHTML = "— <small>kWh/day</small>";
    document.querySelector("#prototype-energy-saved").innerHTML = "— <small>kWh/day</small>";
    document.querySelector("#prototype-saving-percent").textContent = "Enter valid equipment + AI power";
    basisElement.textContent = "Waiting for valid power ratings and a fresh measurement session";
    return;
  }

  const observationHours = measurement.observationSeconds / 3600;
  const measuredFanHours = (measurement.zone1FanSeconds + measurement.zone2FanSeconds) / 2 / 3600;
  const measuredLightHours = (measurement.zone1LightSeconds + measurement.zone2LightSeconds) / 2 / 3600;

  // Conventional: both identical fans/lights are assumed to run for the entire
  // measured camera-on + camera-off observation period, then scaled to 7 hours.
  const conventionalFanMeasured = observationHours * fanPower;
  const conventionalLightMeasured = observationHours * lightPower;
  const conventionalFan7h = conventionalFanMeasured * (7 / Math.max(observationHours, 1 / 3600));
  const conventionalLight7h = conventionalLightMeasured * (7 / Math.max(observationHours, 1 / 3600));
  const conventional = (conventionalFan7h + conventionalLight7h) / 1000;

  // Smart: average the two zone runtimes, then scale the measured device energy
  // to the same 7-hour day. Add the Vision Sense AI system power for 7 hours.
  const smartFanMeasured = measuredFanHours * fanPower;
  const smartLightMeasured = measuredLightHours * lightPower;
  const smartDeviceEnergy7h = (smartFanMeasured + smartLightMeasured) * (observationHours > 0 ? 7 / observationHours : 0) / 1000;
  const smartAiEnergy7h = aiPower * 7 / 1000;
  const smart = smartDeviceEnergy7h + smartAiEnergy7h;

  const saved = conventional - smart;
  const savingPercent = conventional > 0 ? (saved / conventional) * 100 : null;

  document.querySelector("#prototype-conventional-energy").innerHTML = formatEnergy(conventional);
  document.querySelector("#prototype-smart-energy").innerHTML = formatEnergy(smart);
  document.querySelector("#prototype-energy-saved").innerHTML = formatEnergy(saved);
  document.querySelector("#prototype-saving-percent").textContent = savingPercent === null
    ? "—"
    : `${savingPercent.toFixed(2)}% difference`;
  basisElement.textContent =
    `7 h/day · fan/light energy from fresh session · Vision Sense AI: ${aiPower.toFixed(1)} W`;
}

function readRequiredNumber(name, label, options = {}) {
  const input = document.querySelector(`[name="${name}"]`);
  const value = Number(input.value);
  if (input.value.trim() === "" || !Number.isFinite(value) || value < (options.min ?? 0)) {
    displayError(`${label} must be a valid number of ${options.min === undefined ? "zero or greater" : "greater than zero"}.`, input);
    return null;
  }
  if (options.max !== undefined && value > options.max) {
    displayError(`${label} cannot be greater than ${options.max}.`, input);
    return null;
  }
  if (options.integer && !Number.isInteger(value)) {
    displayError(`${label} must be a whole number.`, input);
    return null;
  }
  return value;
}

function updateProjectionResults(values, utilization, fanPower, lightPower) {
  const conventionalFan = values.fans * fanPower * values.hours / 1000;
  const conventionalLight = values.lights * lightPower * values.hours / 1000;
  const conventionalTotal = conventionalFan + conventionalLight;
  const smartFanHours = values.hours * utilization.fan;
  const smartLightHours = values.hours * utilization.light;
  const smartFan = values.fans * fanPower * smartFanHours / 1000;
  const smartLight = values.lights * lightPower * smartLightHours / 1000;
  const smartTotal = smartFan + smartLight;
  const savedDaily = Math.max(0, conventionalTotal - smartTotal);
  const savedMonthly = savedDaily * values.days;
  const savedCost = savedMonthly * values.rate;
  const savingPercent = conventionalTotal > 0 ? savedDaily / conventionalTotal * 100 : null;

  document.querySelector("#conventional-fan-energy").innerHTML = formatEnergy(conventionalFan);
  document.querySelector("#conventional-light-energy").innerHTML = formatEnergy(conventionalLight);
  document.querySelector("#conventional-daily").innerHTML = formatEnergy(conventionalTotal);
  document.querySelector("#smart-fan-energy").innerHTML = formatEnergy(smartFan);
  document.querySelector("#smart-light-energy").innerHTML = formatEnergy(smartLight);
  document.querySelector("#smart-daily").innerHTML = formatEnergy(smartTotal);
  document.querySelector("#smart-fan-time").textContent = `Projected run time: ${smartFanHours.toFixed(2)} h/device/day`;
  document.querySelector("#smart-light-time").textContent = `Projected run time: ${smartLightHours.toFixed(2)} h/device/day`;
  document.querySelector("#daily-difference").innerHTML = formatEnergy(savedDaily);
  document.querySelector("#energy-saving-percent").textContent = savingPercent === null
    ? "— % energy saving"
    : `${savingPercent.toFixed(2)}% estimated energy saving`;
  document.querySelector("#monthly-difference").innerHTML = formatEnergy(savedMonthly, "kWh/month");
  document.querySelector("#monthly-cost").textContent = rupeeFormatter.format(savedCost);
}

energyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.hidden = true;

  const fanPower = getSelectedPower(fanTypeInput, fanOptions, customFanPowerInput);
  if (!Number.isFinite(fanPower) || fanPower < 0) {
    displayError("Enter a valid custom fan wattage.", customFanPowerInput);
    return;
  }

  const lightPower = getSelectedPower(lightTypeInput, lightOptions, customLightPowerInput);
  if (!Number.isFinite(lightPower) || lightPower < 0) {
    displayError("Enter a valid custom light wattage.", customLightPowerInput);
    return;
  }

  const values = {
    fans: readRequiredNumber("fans", "Number of fans", { integer: true }),
    lights: readRequiredNumber("lights", "Number of lights", { integer: true }),
    hours: readRequiredNumber("hours", "School operating hours per day", { max: 24 }),
    days: readRequiredNumber("days", "Working days per month", { integer: true, max: 31 }),
    rate: readRequiredNumber("rate", "Electricity tariff"),
  };
  if (Object.values(values).some((value) => value === null)) return;

  if (!latestLiveStatus) {
    displayError("Connect the live system first so the automatic prototype measurement can be used.");
    return;
  }

  if (!latestMeasurement) {
    displayError("The measurement session has not started yet. Start the system and wait for live data.");
    return;
  }

  const aiPower = Number(document.querySelector("#vision-sense-ai-power")?.value);
  if (!Number.isFinite(aiPower) || aiPower < 0) {
    displayError("Enter the total Vision Sense AI system power in watts.", document.querySelector("#vision-sense-ai-power"));
    return;
  }

  const utilization = {
    fan: latestMeasurement.activeSeconds > 0
      ? Math.min(1, (latestMeasurement.zone1FanSeconds + latestMeasurement.zone2FanSeconds) / (2 * latestMeasurement.activeSeconds))
      : 0,
    light: latestMeasurement.activeSeconds > 0
      ? Math.min(1, (latestMeasurement.zone1LightSeconds + latestMeasurement.zone2LightSeconds) / (2 * latestMeasurement.activeSeconds))
      : 0,
  };

  updateProjectionResults(values, utilization, fanPower, lightPower);
});

loadMeasurementState();
refreshLiveStatus();
