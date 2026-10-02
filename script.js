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

function updateSystemConnection(isConnected) {
  if (typeof isConnected !== "boolean") {
    throw new TypeError("Connection status must be a boolean.");
  }

  document.getElementById("system-connection-status").textContent = isConnected
    ? "CONNECTED"
    : "DISCONNECTED";
}

const liveRuntimeDevices = [
  { key: "zone1_fan", device: "z1-fan" },
  { key: "zone1_light", device: "z1-light" },
  { key: "zone2_fan", device: "z2-fan" },
  { key: "zone2_light", device: "z2-light" },
];
let latestLiveStatus = null;

async function refreshLiveStatus() {
  try {
    const status = await fetchCurrentStatus();
    for (const { key, device } of liveRuntimeDevices) {
      updateRuntime(device, status[`${key}_runtime`], status[key]);
    }

    latestLiveStatus = status;
    updateSystemConnection(status.connected);
  } catch {
    latestLiveStatus = null;
    document.getElementById("system-connection-status").textContent = "WAITING FOR CONNECTION";
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
  if (typeof status.connected !== "boolean") {
    throw new TypeError("Status response has no valid connection state.");
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
const measurementStatus = document.querySelector("#measurement-status");
const liveMeasurementSummary = document.querySelector("#prototype-measured-basis");
const startMeasurementButton = document.querySelector("#start-measurement");
const stopMeasurementButton = document.querySelector("#stop-measurement");
const measurementReadoutIds = {
  duration: "prototype-duration",
  zone1Fan: "prototype-z1-fan-time",
  zone2Fan: "prototype-z2-fan-time",
  zone1Light: "prototype-z1-light-time",
  zone2Light: "prototype-z2-light-time",
  fanUtilization: "prototype-fan-utilization",
  lightUtilization: "prototype-light-utilization",
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

let activeMeasurement = null;
let completedMeasurement = null;

function formatEnergy(value, unit = "kWh/day") {
  return `${value.toFixed(3)} <small>${unit}</small>`;
}

function formatRuntime(seconds) {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatHours(value) {
  return `${value.toFixed(2)} h`;
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
    fanTypeInput,
    fanOptions,
    customFanField,
    customFanPowerInput,
    document.querySelector("#fan-range"),
    document.querySelector("#selected-fan-power")
  );
  updateEquipmentSelection(
    lightTypeInput,
    lightOptions,
    customLightField,
    customLightPowerInput,
    document.querySelector("#light-range"),
    document.querySelector("#selected-light-power")
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
    if (!readings) {
      element.textContent = key.toLowerCase().includes("utilization") ? "--%" : "--:--:--";
    } else if (key.toLowerCase().includes("utilization")) {
      element.textContent = `${(readings[key] * 100).toFixed(1)}%`;
    } else {
      element.textContent = formatRuntime(readings[key]);
    }
  }
}

async function startPrototypeMeasurement() {
  startMeasurementButton.disabled = true;
  measurementStatus.textContent = "Capturing start counters from the local system...";
  try {
    const status = await fetchCurrentStatus();
    if (!status.connected) {
      throw new Error("The local system is not connected. Connect it before starting a measurement.");
    }

    activeMeasurement = {
      counters: Object.fromEntries(
        liveRuntimeDevices.map(({ key }) => [key, status[`${key}_runtime`]])
      ),
      startedAt: Date.now(),
      startedMonotonic: performance.now(),
    };
    completedMeasurement = null;
    showMeasurementReadings();
    liveMeasurementSummary.textContent = "Requires a completed prototype measurement";
    measurementStatus.textContent = `Measurement started at ${new Date(activeMeasurement.startedAt).toLocaleTimeString()}. Keep the system running, then stop to capture the results.`;
    stopMeasurementButton.disabled = false;
  } catch (error) {
    startMeasurementButton.disabled = false;
    measurementStatus.textContent = error.message || "Could not capture live start counters.";
  }
}

async function stopPrototypeMeasurement() {
  stopMeasurementButton.disabled = true;
  measurementStatus.textContent = "Capturing stop counters from the local system...";
  try {
    const status = await fetchCurrentStatus();
    if (!status.connected) {
      throw new Error("The local system is not connected. Reconnect it and try stopping again.");
    }
    if (!activeMeasurement) {
      throw new Error("Start a new measurement before stopping.");
    }

    const stoppedAt = Date.now();
    const stoppedMonotonic = performance.now();
    const durationSeconds = (stoppedMonotonic - activeMeasurement.startedMonotonic) / 1000;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new Error("Measurement duration must be greater than zero.");
    }

    const differences = {};
    for (const { key } of liveRuntimeDevices) {
      const runtime = status[`${key}_runtime`];
      const difference = runtime - activeMeasurement.counters[key];
      if (!Number.isFinite(difference) || difference < 0 || difference > durationSeconds + 1) {
        throw new Error("Runtime counters changed unexpectedly during measurement. Start a new measurement and try again.");
      }
      // Allow one-second counter rounding, but no zone can run longer than the measured interval.
      differences[key] = Math.min(difference, durationSeconds);
    }

    const fanUtilization = (differences.zone1_fan + differences.zone2_fan) / (2 * durationSeconds);
    const lightUtilization = (differences.zone1_light + differences.zone2_light) / (2 * durationSeconds);
    completedMeasurement = {
      durationSeconds,
      differences,
      fanUtilization: Math.min(1, fanUtilization),
      lightUtilization: Math.min(1, lightUtilization),
      startedAt: activeMeasurement.startedAt,
      stoppedAt,
    };
    activeMeasurement = null;
    showMeasurementReadings({
      duration: durationSeconds,
      zone1Fan: differences.zone1_fan,
      zone2Fan: differences.zone2_fan,
      zone1Light: differences.zone1_light,
      zone2Light: differences.zone2_light,
      fanUtilization: completedMeasurement.fanUtilization,
      lightUtilization: completedMeasurement.lightUtilization,
    });
    liveMeasurementSummary.textContent =
      `Measured over ${formatRuntime(durationSeconds)} · ${new Date(stoppedAt).toLocaleTimeString()}`;
    measurementStatus.textContent = `Measurement complete (${new Date(completedMeasurement.startedAt).toLocaleTimeString()}–${new Date(stoppedAt).toLocaleTimeString()}). Valid for this page session.`;
    startMeasurementButton.disabled = false;
  } catch (error) {
    measurementStatus.textContent = error.message || "Could not capture live stop counters.";
    stopMeasurementButton.disabled = false;
    startMeasurementButton.disabled = false;
  }
}

startMeasurementButton.addEventListener("click", startPrototypeMeasurement);
stopMeasurementButton.addEventListener("click", stopPrototypeMeasurement);

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

function getPrototypeUtilization() {
  if (!completedMeasurement) {
    displayError(
      "Complete a live Prototype Measurement with Start Measurement and Stop Measurement before projecting energy.",
      startMeasurementButton
    );
    return null;
  }

  return {
    fan: completedMeasurement.fanUtilization,
    light: completedMeasurement.lightUtilization,
    measuredFanHours: (
      completedMeasurement.differences.zone1_fan + completedMeasurement.differences.zone2_fan
    ) / 2 / 3600,
    measuredLightHours: (
      completedMeasurement.differences.zone1_light + completedMeasurement.differences.zone2_light
    ) / 2 / 3600,
    periodHours: completedMeasurement.durationSeconds / 3600,
  };
}

function updatePrototypeResults(utilization, fanPower, lightPower) {
  const conventional = (fanPower * 7 + lightPower * 7) / 1000;
  const smart = (fanPower * utilization.fan * 7 + lightPower * utilization.light * 7) / 1000;
  const saved = Math.max(0, conventional - smart);
  const savingPercent = conventional > 0 ? (saved / conventional) * 100 : null;

  document.querySelector("#prototype-conventional-energy").innerHTML = formatEnergy(conventional);
  document.querySelector("#prototype-smart-energy").innerHTML = formatEnergy(smart);
  document.querySelector("#prototype-energy-saved").innerHTML = formatEnergy(saved);
  document.querySelector("#prototype-saving-percent").textContent = savingPercent === null
    ? "— %"
    : `${savingPercent.toFixed(2)}% energy saving`;
  document.querySelector("#prototype-measured-basis").textContent =
    `Measured fan ${formatHours(utilization.measuredFanHours)} · light ${formatHours(utilization.measuredLightHours)} / ${formatHours(utilization.periodHours)}`;
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

  const utilization = getPrototypeUtilization();
  if (!utilization) return;

  const fanPower = fanTypeInput.value === "custom"
    ? Number(customFanPowerInput.value)
    : fanOptions[fanTypeInput.value]?.watts;
  if (!Number.isFinite(fanPower) || fanPower < 0 || customFanPowerInput.value.trim() === "" && fanTypeInput.value === "custom") {
    displayError("Enter a valid custom fan wattage.", customFanPowerInput);
    return;
  }

  const lightPower = lightTypeInput.value === "custom"
    ? Number(customLightPowerInput.value)
    : lightOptions[lightTypeInput.value]?.watts;
  if (!Number.isFinite(lightPower) || lightPower < 0 || customLightPowerInput.value.trim() === "" && lightTypeInput.value === "custom") {
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

  updatePrototypeResults(utilization, fanPower, lightPower);
  updateProjectionResults(values, utilization, fanPower, lightPower);
});

refreshLiveStatus();
