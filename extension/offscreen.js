let mediaRecorder = null;
let recordedChunks = [];
let audioContext = null;
let sourceNode = null;
let currentMode = "audio";

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "offscreen-start") {
    startRecording(message.streamId, message.mode || "audio", message.resolution || "720");
  }

  if (message.action === "offscreen-stop") {
    stopRecording();
  }
});

const RESOLUTIONS = {
  "1080": { width: 1920, height: 1080 },
  "720":  { width: 1280, height: 720 },
  "480":  { width: 854,  height: 480 },
  "360":  { width: 640,  height: 360 },
};

async function startRecording(streamId, mode, resolution) {
  currentMode = mode;
  const isVideo = mode === "video";

  const constraints = {
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  };

  if (isVideo) {
    const videoConstraint = {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    };
    const res = RESOLUTIONS[resolution];
    if (res) {
      videoConstraint.mandatory.maxWidth = res.width;
      videoConstraint.mandatory.maxHeight = res.height;
    }
    constraints.video = videoConstraint;
  } else {
    constraints.video = false;
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  // Play audio back so the user can still hear it
  audioContext = new AudioContext();
  const audioStream = new MediaStream(stream.getAudioTracks());
  sourceNode = audioContext.createMediaStreamSource(audioStream);
  sourceNode.connect(audioContext.destination);

  recordedChunks = [];

  const mimeType = isVideo
    ? "video/webm;codecs=vp8,opus"
    : "audio/webm;codecs=opus";

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const blobType = isVideo ? "video/webm" : "audio/webm";
    const webmBlob = new Blob(recordedChunks, { type: blobType });
    recordedChunks = [];

    // Clean up
    if (sourceNode) { sourceNode.disconnect(); sourceNode = null; }
    if (audioContext) { audioContext.close(); audioContext = null; }
    stream.getTracks().forEach((track) => track.stop());

    let result;
    try {
      if (isVideo) {
        // Video: save WebM directly, no conversion needed
        chrome.runtime.sendMessage({
          action: "offscreen-progress",
          status: "Saving video...",
        });
        const base64 = await blobToBase64(webmBlob);
        result = { success: true, base64, size: webmBlob.size, mode: "video" };
      } else {
        // Audio: convert to MP3
        chrome.runtime.sendMessage({
          action: "offscreen-progress",
          status: "Converting to MP3...",
        });
        const mp3Blob = await convertToMp3(webmBlob);
        const base64 = await blobToBase64(mp3Blob);
        result = { success: true, base64, size: mp3Blob.size, mode: "audio" };
      }
    } catch (err) {
      result = { success: false, error: err.message };
    }

    chrome.runtime.sendMessage({ action: "offscreen-stopped", result });
  };

  mediaRecorder.start(1000);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  } else {
    chrome.runtime.sendMessage({
      action: "offscreen-stopped",
      result: { success: false, error: "No active recording" },
    });
  }
}

async function convertToMp3(webmBlob) {
  // Decode WebM to PCM using AudioContext
  const arrayBuffer = await webmBlob.arrayBuffer();
  const decodeCtx = new AudioContext();
  const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  decodeCtx.close();

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.length;

  // Get channel data
  const left = audioBuffer.getChannelData(0);
  const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

  // Convert float32 to int16
  const leftInt16 = floatTo16Bit(left);
  const rightInt16 = floatTo16Bit(right);

  // Encode with lamejs
  const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 192);
  const mp3Chunks = [];
  const blockSize = 1152;

  for (let i = 0; i < samples; i += blockSize) {
    const leftChunk = leftInt16.subarray(i, i + blockSize);
    const rightChunk = rightInt16.subarray(i, i + blockSize);

    let mp3buf;
    if (numChannels === 1) {
      mp3buf = mp3Encoder.encodeBuffer(leftChunk);
    } else {
      mp3buf = mp3Encoder.encodeBuffer(leftChunk, rightChunk);
    }

    if (mp3buf.length > 0) {
      mp3Chunks.push(mp3buf);
    }
  }

  const end = mp3Encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(end);
  }

  return new Blob(mp3Chunks, { type: "audio/mp3" });
}

function floatTo16Bit(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Strip data URL prefix to get raw base64
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}
