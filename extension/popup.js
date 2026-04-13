const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const serverStatusEl = document.getElementById("serverStatus");
const modeToggle = document.getElementById("modeToggle");
const modeBtns = modeToggle.querySelectorAll(".mode-btn");
const resolutionPicker = document.getElementById("resolutionPicker");
const resolutionSelect = document.getElementById("resolutionSelect");

let timerInterval = null;
let startTime = null;
let recordMode = "audio";

// Mode toggle
modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    recordMode = btn.dataset.mode;
    resolutionPicker.classList.toggle("visible", recordMode === "video");
  });
});

// Restore state from background
chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
  if (response?.recording) {
    startTime = response.startTime;
    recordMode = response.mode || "audio";
    modeBtns.forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === recordMode);
    });
    showRecordingState();
    startTimer();
  }
});

// No server needed anymore
serverStatusEl.textContent = "Ready — no server required";
serverStatusEl.className = "server-status connected";

startBtn.addEventListener("click", async () => {
  clearMessage();
  startBtn.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.runtime.sendMessage(
    { action: "startRecording", tabId: tab.id, mode: recordMode, resolution: resolutionSelect.value },
    (response) => {
      if (response?.success) {
        startTime = Date.now();
        showRecordingState();
        startTimer();
      } else {
        showMessage("error", response?.error || "Failed to start recording");
        startBtn.disabled = false;
      }
    }
  );
});

stopBtn.addEventListener("click", () => {
  stopBtn.disabled = true;
  stopBtn.textContent = recordMode === "video" ? "Saving video..." : "Converting to MP3...";
  stopTimer();

  chrome.runtime.sendMessage({ action: "stopRecording" }, (response) => {
    if (response?.success) {
      const fmt = recordMode === "video" ? "WebM video" : "MP3";
      showMessage("success", `${fmt} saved to Downloads/TabAudioRecordings/`);
    } else {
      showMessage("error", response?.error || "Failed to save recording");
    }

    showIdleState();
  });
});

function showRecordingState() {
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  stopBtn.disabled = false;
  stopBtn.textContent = recordMode === "video" ? "Stop & Save Video" : "Stop & Save MP3";
  statusDot.className = "status-dot recording";
  statusText.textContent = recordMode === "video" ? "Recording video..." : "Recording...";
  modeToggle.style.pointerEvents = "none";
  modeToggle.style.opacity = "0.5";
  resolutionPicker.style.pointerEvents = "none";
  resolutionPicker.style.opacity = "0.5";
}

function showIdleState() {
  startBtn.style.display = "block";
  startBtn.disabled = false;
  stopBtn.style.display = "none";
  statusDot.className = "status-dot ready";
  statusText.textContent = "Ready";
  timerEl.textContent = "00:00:00";
  modeToggle.style.pointerEvents = "";
  modeToggle.style.opacity = "";
  resolutionPicker.style.pointerEvents = "";
  resolutionPicker.style.opacity = "";
}

function startTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const h = String(Math.floor(elapsed / 3600000)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
    timerEl.textContent = `${h}:${m}:${s}`;
  }, 500);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function showMessage(type, text) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function clearMessage() {
  messageEl.className = "message";
  messageEl.textContent = "";
}
