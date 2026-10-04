(() => {
const $ = s => document.querySelector(s);
const v = $('#video'), PREFIX = 'couchsync-';
const C = window.CONFIG || {};
const KEY = C.DRIVE_API_KEY || '';
let peer, conn, source = null, isHost = false, hasRelay = false, turnStatus = '', waitTimer = null, blocked = false;
let wantPlay = false, waitSelf = false, waitPeer = false, dragging = false;

/* ---------- helpers ---------- */
const say = (t, err) => { const m = $('#msg'); m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); };
const fmt = s => { s = Math.max(0, s | 0); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
const send = m => { if (conn && conn.open) conn.send(m); };
const driveId = s => (s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/) || s.match(/^([\w-]{20,})$/) || [])[1];
const hasSrc = () => !!(v.currentSrc || v.getAttribute('src'));
const setTime = t => { if (Math.abs(v.currentTime - t) > 0.4) v.currentTime = t; };
const ahead = () => { const b = v.buffered;
  for (let i = 0; i < b.length; i++) if (v.currentTime >= b.start(i) - 0.1 && v.currentTime <= b.end(i)) return b.end(i) - v.currentTime;
  return 0; };

/* ---------- network (STUN + TURN relay so it works across different networks) ---------- */
async function iceServers() {
  const list = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }];
  if (Array.isArray(C.ICE_SERVERS)) list.push(...C.ICE_SERVERS);
  turnStatus = '';
  const app = String(C.METERED_APP || '').trim().replace(/^https?:\/\//, '').replace(/\.metered\.live.*$/, '').replace(/\/.*$/, '');
  if (app && C.METERED_KEY) {
    try {
      const r = await fetch(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${String(C.METERED_KEY).trim()}`);
      const j = r.ok ? await r.json() : null;
      if (Array.isArray(j)) list.push(...j);
      else turnStatus = 'Metered answered HTTP ' + r.status + (r.status === 401 || r.status === 400 ? ' (API key looks wrong)' : r.status === 404 ? ' (app name looks wrong)' : '');
    } catch (e) { turnStatus = 'could not reach Metered (app name wrong, or blocked by a network/ad-blocker)'; }
  } else turnStatus = 'METERED_APP / METERED_KEY are empty in the config.js that is deployed (redeploy and hard refresh)';
  hasRelay = list.some(s => String(s.urls).startsWith('turn'));
  return list;
}
function show(code) { $('#source').hidden = !isHost; $('#lobby').hidden = true; $('#room').hidden = false; $('#roomCode').textContent = code; }
function setPill(ok, t) { const p = $('#pill'); p.textContent = t; p.className = 'pill' + (ok ? ' ok' : ''); }
const noRelayHint = () => hasRelay ? '' : ' No TURN relay: ' + turnStatus + '.';

async function host() {
  isHost = true;
  const code = newCode(), ice = await iceServers();
  peer = new Peer(PREFIX + code, { config: { iceServers: ice } });
  peer.on('open', () => { show(code); setPill(false, 'Waiting for partner…'); if (!hasRelay) say(noRelayHint().trim(), true); });
  peer.on('connection', c => { if (conn && conn.open) return c.close(); attach(c); });
  peer.on('error', e => e.type === 'unavailable-id' ? (peer.destroy(), host()) : say('Connection error: ' + e.type, true));
}
async function join(code) {
  code = code.trim().toUpperCase(); if (code.length < 6) return;
  const ice = await iceServers();
  peer = new Peer(undefined, { config: { iceServers: ice } });
  peer.on('open', () => {
    show(code); setPill(false, 'Connecting…');
    attach(peer.connect(PREFIX + code, { reliable: true }));
    setTimeout(() => { if (!(conn && conn.open)) { setPill(false, 'Not connected'); say('Still not connected.' + noRelayHint() + ' Check the code and that your partner has the room open.', true); } }, 20000);
  });
  peer.on('error', e => say(e.type === 'peer-unavailable' ? 'No room with that code.' : 'Connection error: ' + e.type, true));
}
function attach(c) {
  conn = c;
  c.on('open', () => {
    setPill(true, 'Connected'); say('Connected.');
    if (source) { send({ t: 'src', ...source }); send({ t: 'sync', time: v.currentTime, playing: wantPlay }); }
  });
  c.on('data', onMsg);
  c.on('close', () => { setPill(false, 'Partner left'); waitPeer = false; conn = null; apply(); });
  c.on('error', e => say('Connection error: ' + (e.type || e), true));
}

/* ---------- playback core ---------- */
function apply() {
  const go = wantPlay && !waitSelf && !waitPeer;
  $('#shield').classList.toggle('on', wantPlay && waitPeer);
  if (go) {
    if (hasSrc()) {
      const p = v.play();
      if (p) p.then(() => { blocked = false; }).catch(e => {
        if (e.name === 'NotAllowedError') { blocked = true; say('Your browser blocked autoplay. Press Play once to start.', true); }
        // AbortError just means a pause/seek interrupted play(); safe to ignore
      });
    }
  } else { v.pause(); v.playbackRate = 1; }
  $('#btnPlay').textContent = wantPlay ? 'Pause' : 'Play';
}
function setPlay(p) { wantPlay = p; send({ t: p ? 'play' : 'pause', time: v.currentTime }); apply(); }
function seekTo(t) { v.currentTime = t; send({ t: 'seek', time: t }); }
function toggle() {
  if (!hasSrc()) return;
  if (blocked) { blocked = false; return apply(); }
  setPlay(!wantPlay);
}

function onMsg(m) {
  switch (m.t) {
    case 'src': loadSource(m, false); break;
    case 'play': wantPlay = true; setTime(m.time); apply(); break;
    case 'pause': wantPlay = false; setTime(m.time); apply(); break;
    case 'seek': setTime(m.time); break;
    case 'sync': wantPlay = m.playing; setTime(m.time); apply(); break;
    case 'wait': waitPeer = true; apply(); break;
    case 'ready': waitPeer = false; apply(); break;
    case 'hb': {
      if (waitSelf || waitPeer || v.paused) break;
      const d = v.currentTime - m.time;
      if (Math.abs(d) > 0.8) v.currentTime = m.time;
      else v.playbackRate = Math.abs(d) > 0.12 ? (d > 0 ? 0.97 : 1.03) : 1;
      break;
    }
  }
}
setInterval(() => { if (isHost && conn && conn.open && wantPlay && !v.paused) send({ t: 'hb', time: v.currentTime }); }, 2000);

/* buffering: if either side stalls, both pause; resume together once ~3s is buffered */
v.addEventListener('waiting', () => {
  clearTimeout(waitTimer);
  waitTimer = setTimeout(() => {
    if (wantPlay && !waitSelf && ahead() < 1) { waitSelf = true; send({ t: 'wait' }); apply(); }
  }, 600);
});
const tryResume = () => {
  if (!waitSelf) return;
  if (ahead() >= 3 || (v.duration && v.duration - v.currentTime < 3 && v.readyState >= 3)) {
    clearTimeout(waitTimer); waitSelf = false; send({ t: 'ready' }); apply();
  }
};
['progress', 'canplay', 'canplaythrough', 'seeked'].forEach(e => v.addEventListener(e, tryResume));
v.addEventListener('ended', () => { wantPlay = false; apply(); });
v.addEventListener('error', () => {
  const c = v.error && v.error.code;
  if (c === 4 && source && source.kind === 'drive') { say('Could not play this file. Checking why…', true); return diagnose(); }
  say(c === 4 ? 'Could not play this file. Check the link is public and the format is MP4 (H.264/AAC).' : 'Playback error (code ' + c + ').', true);
});
async function diagnose() {
  try {
    const base = `https://www.googleapis.com/drive/v3/files/${source.value}`;
    const j = await (await fetch(`${base}?fields=name,mimeType,size&supportsAllDrives=true&key=${KEY}`)).json();
    if (j.error) {
      const why = (j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '';
      return say('Google says: ' + j.error.message + (why ? ' [' + why + ']' : ''), true);
    }
    const mb = Math.round(j.size / 1048576);
    // does Drive actually hand over the video bytes? (headers only, then abort)
    const ac = new AbortController();
    const t = await fetch(`${base}?alt=media&supportsAllDrives=true&key=${KEY}`, { signal: ac.signal });
    if (!t.ok) {
      let m = ''; try { const e = await t.json(); m = e.error.message + ' [' + ((e.error.errors || [{}])[0].reason || '') + ']'; } catch (x) {}
      return say(`Drive refused to send the video (HTTP ${t.status}). ${m} If this mentions download quota, wait about 24 hours, or give each person a separate copy of the file (tick “own copy”) or use “File on this device”.`, true);
    }
    ac.abort();
    if (/matroska/.test(j.mimeType))
      return say(`Drive is serving “${j.name}” fine (${mb} MB), so the problem is playback. It is an MKV: use Chrome or Edge on a computer (Firefox and Safari can't play MKV). If it still fails or has no sound, the audio is probably Dolby (AC3/E-AC3) or the video is HEVC. Convert to MP4 (H.264 + AAC).`, true);
    say(`Drive is serving “${j.name}” fine (${mb} MB, ${j.mimeType}), but the browser can't decode it. Likely HEVC/H.265 or unusual audio: re-encode to MP4 (H.264 + AAC).`, true);
  } catch (e) { if (e.name !== 'AbortError') say('Could not reach the Drive API: ' + e.message, true); }
}

/* ---------- sources ---------- */
function loadSource(s, announce) {
  let url;
  if (s.kind === 'drive') {
    if (!KEY) return say('Add your Drive API key to config.js first (see README).', true);
    url = `https://www.googleapis.com/drive/v3/files/${s.value}?alt=media&key=${KEY}`;
  } else if (s.kind === 'url') url = s.value;
  else return;
  source = s; wantPlay = false; waitSelf = waitPeer = false; blocked = false;
  v.src = url; v.load(); $('#empty').hidden = true; apply();
  say(announce ? 'Loaded. Press Play when you are both ready.' : 'Your partner loaded a video.');
  if (announce) send({ t: 'src', ...s });
}
function tab(k) {
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  $('#srcDrive').hidden = k !== 'drive'; $('#srcUrl').hidden = k !== 'url';
}

/* ---------- UI wiring ---------- */
$('#btnHost').onclick = host;
$('#btnJoin').onclick = () => join($('#joinCode').value);
$('#joinCode').onkeydown = e => e.key === 'Enter' && join(e.target.value);
$('#btnCopy').onclick = () => { navigator.clipboard.writeText(location.origin + location.pathname + '#' + $('#roomCode').textContent); say('Invite link copied.'); };
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => tab(b.dataset.k));
$('#loadDrive').onclick = () => { const id = driveId($('#driveLink').value.trim()); id ? loadSource({ kind: 'drive', value: id }, true) : say('That does not look like a Drive link.', true); };
$('#loadUrl').onclick = () => { const u = $('#directLink').value.trim(); /^https?:\/\//.test(u) ? loadSource({ kind: 'url', value: u }, true) : say('Enter a full https:// link.', true); };
$('#btnPlay').onclick = toggle;
v.onclick = toggle;
$('#vol').oninput = e => v.volume = e.target.value;
$('#btnFs').onclick = () => document.fullscreenElement ? document.exitFullscreen() : $('#stage').requestFullscreen();
const seek = $('#seek');
seek.oninput = () => { dragging = true; $('#time').textContent = fmt(seek.value / 1000 * v.duration) + ' / ' + fmt(v.duration); };
seek.onchange = () => { dragging = false; if (v.duration) seekTo(seek.value / 1000 * v.duration); };
v.ontimeupdate = () => { if (dragging || !v.duration) return; seek.value = v.currentTime / v.duration * 1000; $('#time').textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration); };
document.onkeydown = e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  if (e.code === 'ArrowRight') seekTo(v.currentTime + 5);
  if (e.code === 'ArrowLeft') seekTo(Math.max(0, v.currentTime - 5));
};

if (location.hash.length === 7) { $('#joinCode').value = location.hash.slice(1); }
})();
