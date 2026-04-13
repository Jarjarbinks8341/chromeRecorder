# Tab Audio/Video Recorder

A Chrome extension that captures audio or video from browser tabs. Record tab audio as MP3 or tab video as WebM — great for saving lectures, podcasts, or any browser-based media for offline use.

## Features

- **Audio recording** — captures tab audio and converts to MP3 (192 kbps)
- **Video recording** — captures tab audio + video and saves as WebM
- **Resolution picker** — choose from Original, 1080p, 720p, 480p, or 360p for video
- **Live timer** — shows elapsed recording time
- **No server required** — everything runs locally in the browser

## Installation

### From source (Developer mode)

1. **Clone the repo**
   ```bash
   git clone https://github.com/Jarjarbinks8341/chromeRecorder.git
   cd chromeRecorder
   ```

2. **Install dependencies**
   ```bash
   cd extension
   npm install
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/` in Chrome
   - Enable **Developer mode** (toggle in the top-right corner)
   - Click **Load unpacked**
   - Select the `extension/` folder from this repo

4. The extension icon will appear in your Chrome toolbar — click it to start recording.

### Updating

After pulling new changes, go to `chrome://extensions/` and click the reload button on the extension card.

## Usage

1. Navigate to the tab you want to record
2. Click the extension icon in the toolbar
3. Select **Audio (MP3)** or **Video (WebM)**
4. If video, choose a resolution from the dropdown
5. Click **Start Recording**
6. Click **Stop & Save** when done — the file saves to your `Downloads/TabAudioRecordings/` folder

## Permissions

- `tabCapture` — capture audio/video from the active tab
- `activeTab` — access the currently active tab
- `offscreen` — run audio/video processing in a background document
- `storage` — persist recording state across popup open/close
- `downloads` — save recorded files to the Downloads folder
