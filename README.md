# Couchsync

Free watch-together player. Two people stream the **same original file** (no re-encoding, so identical quality) with play, pause and seek kept in sync. No server: the site is static and the two browsers talk directly (WebRTC via PeerJS's free broker).

## 1. Get a free Google Drive API key (once)
1. Go to https://console.cloud.google.com, create a project.
2. APIs & Services → Library → enable **Google Drive API**.
3. Credentials → Create credentials → **API key**.
4. Edit the key → *Application restrictions*: HTTP referrers → `https://YOUR_USERNAME.github.io/*`. *API restrictions*: Drive API only.
5. Paste the key into `config.js`.

## 2. Prepare the video
- Upload to Drive → Share → **Anyone with the link** (Viewer).
- Best format: **MP4 (H.264 + AAC)** or WebM. MKV/HEVC often will not play in browsers.
- Google Photos videos cannot be streamed directly. Download them and upload to Drive, or use "File on this device".

## 3. Deploy on GitHub Pages
1. Create a repo, upload these 5 files (`index.html`, `style.css`, `app.js`, `config.js`, `README.md`).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / root.
3. Open `https://YOUR_USERNAME.github.io/REPO/`.

## Use
One person clicks **Start a room**, shares the code or invite link. Either person can paste the Drive link and control playback. If one side buffers, both pause and resume together.

## Notes
- Drive can show "quota exceeded" on a file after heavy repeated downloads; wait a day or use a second copy.
- Strict networks may block the peer connection (no TURN relay in the free setup). Try a different network or hotspot.
- "File on this device" mode uses zero bandwidth and gives perfect quality if you both have the same file.
