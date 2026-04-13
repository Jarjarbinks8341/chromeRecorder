let recording = false;
let recordMode = "audio";

// Restore state on service worker wake-up
chrome.storage.local.get(["recording", "recordMode"], (data) => {
  recording = !!data.recording;
  recordMode = data.recordMode || "audio";
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getStatus") {
    chrome.storage.local.get(["recording", "recordingStartTime", "recordMode"], (data) => {
      sendResponse({
        recording: !!data.recording,
        startTime: data.recordingStartTime || null,
        mode: data.recordMode || "audio",
      });
    });
    return true;
  }

  if (message.action === "startRecording") {
    if (recording) {
      sendResponse({ success: false, error: "Already recording. Stop the current recording first." });
      return true;
    }
    recordMode = message.mode || "audio";
    startRecording(message.tabId, recordMode, message.resolution || "720")
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === "stopRecording") {
    if (!recording) {
      sendResponse({ success: false, error: "No active recording" });
      return true;
    }
    stopRecording()
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Progress updates from offscreen (for popup to pick up)
  if (message.action === "offscreen-progress") {
    chrome.storage.local.set({ recordingStatus: message.status });
  }
});

async function startRecording(tabId, mode, resolution) {
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  });

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Recording tab audio/video",
    });
  }

  chrome.runtime.sendMessage({
    action: "offscreen-start",
    streamId,
    mode,
    resolution,
  });

  recording = true;
  const startTime = Date.now();
  chrome.storage.local.set({ recording: true, recordingStartTime: startTime, recordMode: mode });
}

async function stopRecording() {
  return new Promise((resolve) => {
    const listener = (message) => {
      if (message.action === "offscreen-stopped") {
        chrome.runtime.onMessage.removeListener(listener);
        recording = false;
        chrome.storage.local.set({ recording: false });
        chrome.storage.local.remove(["recordingStartTime", "recordingStatus", "recordMode"]);

        if (message.result.success) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const isVideo = message.result.mode === "video";
          const mimeType = isVideo ? "video/webm" : "audio/mp3";
          const ext = isVideo ? "webm" : "mp3";
          const dataUrl = `data:${mimeType};base64,` + message.result.base64;

          chrome.downloads.download(
            {
              url: dataUrl,
              filename: `TabAudioRecordings/recording-${timestamp}.${ext}`,
              saveAs: true,
            },
            (downloadId) => {
              if (chrome.runtime.lastError) {
                resolve({ success: false, error: chrome.runtime.lastError.message });
              } else {
                resolve({ success: true, downloadId });
              }
            }
          );
        } else {
          resolve(message.result);
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    chrome.runtime.sendMessage({ action: "offscreen-stop" });
  });
}
