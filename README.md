# StreamSame

Free watch-together player. Two people stream the **same original file** (no re-encoding, so identical quality) with play, pause and seek kept in sync. No server: the site is static and the two browsers talk directly (WebRTC via PeerJS's free broker).

## Prepare the video
- Upload to Drive → Share → **Anyone with the link** (Viewer).
- Best format: **MP4 (H.264 + AAC)** or WebM. MKV/HEVC often will not play in browsers.
- Google Photos videos cannot be streamed directly. Download them and upload to Drive, or use "File on this device".

## Supported Direct Links
- Internet Archive's .mp4 stream links and likewise
- Google Drive stream links (Stream movies by copying movie files into your GDrive using services like GDFlix, HubDrive, GDTot through HDHub4u, Bollyflix, Vegamovies, Ola movies)
- Currently, .mkv or .m38ua stream links are unsupported

## Notes
- Drive can show "quota exceeded" on a file after heavy repeated downloads; wait a day or use a second copy.
- Strict networks may block the peer connection (no TURN relay in the free setup). Try a different network or hotspot.
- "File on this device" mode uses zero bandwidth and gives perfect quality if you both have the same file.

**Made with love 💗 by Arpit for Shivangi**
