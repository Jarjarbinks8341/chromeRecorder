# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (Manifest V3) that captures audio from browser tabs and saves it as MP3. Built for English learning use cases. No build step or server required — the extension runs entirely client-side.

## Development

### Loading the Extension
1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` directory

After code changes, click the reload button on the extension card in `chrome://extensions/`.

### Dependencies
```bash
cd extension && npm install
```
Only dependency is `lamejs` (MP3 encoding). The `lame.min.js` file is a pre-built copy used directly via `<script>` tag — it is not bundled or transpiled.

### No Build/Lint/Test Pipeline
There is no build system, bundler, linter, or test framework configured. All JS is vanilla ES6+ loaded directly by Chrome.

## Architecture

The extension uses three cooperating contexts that communicate via `chrome.runtime.sendMessage`:

- **popup.js / popup.html** — UI layer. Start/stop buttons, timer display, status messages. Sends `startRecording`/`stopRecording`/`getStatus` messages to background.
- **background.js** — Service worker (Manifest V3). Orchestrates recording: obtains a `tabCapture` stream ID, creates the offscreen document, relays start/stop commands, and triggers `chrome.downloads` to save the final MP3.
- **offscreen.js / offscreen.html** — Offscreen document that does the actual audio work. Captures the media stream, records to WebM/Opus via `MediaRecorder`, decodes to PCM via `AudioContext.decodeAudioData`, then encodes to MP3 using lamejs. Passes the result back as base64.

### Message Flow
```
popup → background (startRecording) → offscreen (offscreen-start)
popup → background (stopRecording) → offscreen (offscreen-stop)
offscreen → background (offscreen-stopped with base64 MP3) → chrome.downloads
```

### Recording State
Recording state is persisted in `chrome.storage.local` (`recording`, `recordingStartTime`) so the popup and service worker can recover state after being suspended/reopened.

### MP3 Encoding
WebM/Opus → PCM float32 → int16 → lamejs `Mp3Encoder` at 192 kbps. Files are saved to `Downloads/TabAudioRecordings/`.
