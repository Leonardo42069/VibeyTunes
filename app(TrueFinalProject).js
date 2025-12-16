// UI-enhanced demo: generate sample tracks, covers, and support load-more
const SAMPLE_TITLES = ['Morning Breeze','Night Drive','Sunset Hop','Lofty','Runaway','A New Day','Neon Street','Paper Plane','Slow Waves','Warm Coffee','Crosswalk','Wistful','Skyline','Homebound','Distant Lights'];
const SAMPLE_ARTISTS = ['Ava Lane','Juno','Lofi Dreams','Kaito','Nova','Echoa','Miro','Velvet','Sora'];
// Use a CORS-friendly sample audio so playback works in the browser
const SAMPLE_AUDIO_URL = 'https://interactive-examples.mdn.mozilla.net/media/examples/t-rex-roar.mp3';
function makeWavBlob(freq = 440, duration = 3, sampleRate = 44100){
  // generate a short WAV blob (mono, 16-bit PCM)
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  function writeString(view, offset, string){ for(let i=0;i<string.length;i++){ view.setUint8(offset + i, string.charCodeAt(i)); } }
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples * 2, true);
  // write samples
  for(let i=0;i<samples;i++){
    const t = i / sampleRate;
    // simple musical-ish waveform (sum of sines)
    const s = 0.6 * Math.sin(2*Math.PI*freq*t) + 0.2 * Math.sin(2*Math.PI*(freq*2)*t) + 0.1 * Math.sin(2*Math.PI*(freq*3.01)*t);
    // apply quick fade out near end
    const fade = Math.min(1, (samples - i) / (sampleRate * 0.4));
    const sample = Math.max(-1, Math.min(1, s * fade));
    view.setInt16(44 + i*2, sample * 0x7fff, true);
  }
  return new Blob([view], {type:'audio/wav'});
}

function generateTracks(n, startId=1){ const out=[]; for(let i=0;i<n;i++){ const id = startId + i; const title = SAMPLE_TITLES[Math.floor(Math.random()*SAMPLE_TITLES.length)] + (Math.random()>0.7?` ${Math.floor(Math.random()*100)}`:''); const artist = SAMPLE_ARTISTS[Math.floor(Math.random()*SAMPLE_ARTISTS.length)]; const freq = 220 + ((id*31) % 880); const blob = makeWavBlob(freq, 4); const url = URL.createObjectURL(blob); out.push({id, title, artist, url, cover:`https://picsum.photos/seed/vt-${id}/400/400`, _blobUrl:true}); } return out; }

// Generate a fallback cover as a data URL using Canvas with title/artist text.
function generateTextCover(title = 'VibeyTunes', artist = '', seed = 0){
  try{
    const size = 400; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d');
    // deterministic color from seed/title
    const hash = (String(seed) + title + artist).split('').reduce((s,c)=>((s<<5)-s)+c.charCodeAt(0), 0);
    const hue = Math.abs(hash) % 360;
    // gradient background
    const g = ctx.createLinearGradient(0,0,size,size);
    g.addColorStop(0, `hsl(${hue} 70% 45%)`);
    g.addColorStop(1, `hsl(${(hue+40)%360} 70% 30%)`);
    ctx.fillStyle = g; ctx.fillRect(0,0,size,size);
    // overlay pattern
    ctx.globalAlpha = 0.06; for(let i=0;i<6;i++){ ctx.fillStyle = `rgba(255,255,255,${0.02+i*0.02})`; ctx.fillRect(i*40,0,20,size); } ctx.globalAlpha = 1;
    // draw title
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 28px system-ui,Segoe UI,Roboto,Arial';
    const titleText = String(title).slice(0,28);
    ctx.fillText(titleText, size/2, size/2 - 10);
    ctx.font = '400 16px system-ui,Segoe UI,Roboto,Arial'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const artistText = String(artist).slice(0,32);
    ctx.fillText(artistText, size/2, size/2 + 28);
    return canvas.toDataURL('image/png');
  }catch(e){ return 'https://picsum.photos/seed/placeholder/400/400'; }
}

const TRACKS = []; // start empty — we'll populate with iTunes Top Hits previews on load
let nextGeneratedId = 1000;

const state = {
  tracks: TRACKS,
  filtered: TRACKS,
  selectedId: null,
  playlist: JSON.parse(localStorage.getItem('vt_playlist')||'[]'),
  playlists: JSON.parse(localStorage.getItem('vt_playlists')||'[]'), // {id,name,items:[]}
  audio: new Audio(),
  audioContext: null,
  oscillator: null,
  currentPlayingId: null,
  currentView: {type:'discover', id:null}
};

// persistent discover catalog (used by Random to ignore search/filter state)
state.discoverCatalog = state.discoverCatalog || [];
// track ids we've shown via Random to avoid repeats during this session
state.seenRandomIds = state.seenRandomIds || new Set();

const $ = id => document.getElementById(id);

function renderTrackGrid(list){
  const grid = $('trackGrid'); grid.innerHTML='';
  list.forEach(t=>{
    const el = document.createElement('div'); el.className='track'; el.dataset.id=t.id;
    const fullNote = t.fullUrl ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">${t.fullType==='youtube'?'Full track (YouTube)':'Full track available'}</div>` : '';
    const playFullBtn = t.fullUrl ? `<button class="icon-btn playfull-small" title="Play Full">🔊</button>` : '';
    // Build inner structure and preload cover image to avoid broken icons
    const coverSrc = t.cover || 'https://picsum.photos/seed/placeholder/400/400';
    const placeholder = 'https://picsum.photos/seed/placeholder/400/400';

    const coverWrap = document.createElement('div'); coverWrap.className = 'cover';
    const img = document.createElement('img'); img.alt = 'cover'; img.src = placeholder; img.style.opacity = '0'; img.style.transition = 'opacity .18s ease';
    // If image element errors, use a stable placeholder
    img.onerror = function(){ this.onerror = null; this.src = placeholder; this.style.opacity = '1'; };
    coverWrap.appendChild(img);

    const meta = document.createElement('div'); meta.className = 'meta'; meta.innerHTML = `<strong>${t.title}</strong><small>${t.artist}</small>${t.remote?'<span class="preview-badge">Preview</span>':''}${fullNote}`;

    const actions = document.createElement('div'); actions.className = 'track-actions'; actions.innerHTML = `<button class="icon-btn play-small" title="Play">▶</button><button class="icon-btn save-small" title="Save">💾</button>${playFullBtn}`;

    el.appendChild(coverWrap); el.appendChild(meta); el.appendChild(actions);

    // Click handling with button detection
    el.addEventListener('click', (e)=>{
      if(e.target.closest('.play-small')){ selectTrack(t.id); e.stopPropagation(); return; }
      if(e.target.closest('.save-small')){ saveTrack(t.id); e.stopPropagation(); return; }
      if(e.target.closest('.playfull-small')){ selectTrack(t.id); playTrack(t.id, {preferFull:true}); e.stopPropagation(); return; }
      selectTrack(t.id);
    });
    el.addEventListener('dblclick', (e)=>{ e.stopPropagation(); onTrackDoubleClick(t.id); });

    // Preload the actual cover and swap in when ready (prevents showing broken icon)
    const pre = new Image();
    pre.onload = function(){ img.src = coverSrc; img.style.opacity = '1'; };
    pre.onerror = function(){ img.src = generateTextCover(t.title, t.artist, t.id); img.style.opacity = '1'; };
    pre.src = coverSrc;

    grid.appendChild(el);
    if(state.selectedId===t.id) el.classList.add('selected');
  })
}

function selectTrack(id){
  state.selectedId = id;
  document.querySelectorAll('.track').forEach(el=>el.classList.toggle('selected', el.dataset.id === String(id)));
  playTrack(id);
}

function playTrack(id, opts={}){
  const preferFull = opts.preferFull||false;
  const t = state.tracks.find(x=>x.id===id); if(!t) return;
  let src = t.url;
  if(preferFull && t.fullUrl){
    if(t.fullType === 'youtube'){
      playYouTubeInModal(t.fullUrl, t); // open embed modal
      return;
    } else {
      src = t.fullUrl;
    }
  }
  console.log('Attempting to play', src);
  // Pause current audio and switch source
  try{
    state.audio.pause();
    state.audio.src = src;
    state.audio.preload = 'auto';
    state.audio.crossOrigin = 'anonymous';
    state.audio.load();
    const playPromise = state.audio.play();
    if(playPromise && playPromise.then){
      playPromise.then(()=>{
        $('playBtn').textContent = '⏸';
      }).catch(err=>{
        console.error('Playback promise rejected:', err);
        const m = state.audio.error;
        const code = m ? m.code : 'no_media_error';
        const msg = `Playback failed: ${err.name || err.message || err} (mediaError:${code})`;
        alert(msg);
      });
    }
  }catch(err){ console.error('playTrack error', err); alert('Playback error: '+(err.message||err)); }
  state.currentPlayingId = id;
  $('playerTitle').textContent = t.title; $('playerArtist').textContent = t.artist;
  // show cover with fallback: try t.cover then generate a canvas-based cover if it fails
  const coverEl = $('playerCover'); if(coverEl){
    coverEl.src = t.cover || generateTextCover(t.title, t.artist, t.id);
    coverEl.onerror = function(){ this.onerror=null; this.src = generateTextCover(t.title, t.artist, t.id); };
  }
} 

// update player UI from audio events
state.audio.addEventListener('ended', ()=>{ $('playBtn').textContent = '▶'; });
state.audio.addEventListener('play', ()=>{ $('playBtn').textContent = '⏸'; });
state.audio.addEventListener('pause', ()=>{ $('playBtn').textContent = '▶'; });
state.audio.addEventListener('timeupdate', ()=>{
  const cur = Math.floor(state.audio.currentTime);
  const dur = Math.floor(state.audio.duration) || 0;
  const format = (s)=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  if($('currentTime')) $('currentTime').textContent = format(cur);
  if($('duration') && dur) $('duration').textContent = format(dur);
});

state.audio.addEventListener('error', ()=>{
  const m = state.audio.error;
  const codes = {1:'MEDIA_ERR_ABORTED',2:'MEDIA_ERR_NETWORK',3:'MEDIA_ERR_DECODE',4:'MEDIA_ERR_SRC_NOT_SUPPORTED'};
  const label = m ? (codes[m.code] || m.code) : 'unknown';
  console.error('Audio element error', m, label, state.audio.src);
  // If the browser reports unsupported source, fallback to a generated tone so user hears something
  if(m && m.code===4){ flash('Source not supported — playing a demo tone instead'); fallbackPlayTone(state.currentPlayingId); }
  else { alert('Audio failed to load: ' + label); }
});

function fallbackPlayTone(id){
  // stop any existing oscillator
  if(state.oscillator){ try{ state.oscillator.stop(); }catch(e){} state.oscillator=null; }
  try{
    if(!state.audioContext){ state.audioContext = new (window.AudioContext||window.webkitAudioContext)(); }
    const ctx = state.audioContext;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    // choose frequency from id so different tracks sound different
    const freq = 220 + ((id||1) * 37) % 800;
    osc.type = 'sine'; osc.frequency.value = freq; gain.gain.value = 0.06;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); state.oscillator = osc;
    // stop after 8 seconds
    setTimeout(()=>{ try{ osc.stop(); }catch(e){} state.oscillator=null; $('playBtn').textContent='▶'; },8000);
    $('playBtn').textContent='⏸';
    $('playerTitle').textContent = 'Preview tone'; $('playerArtist').textContent = 'Demo';
  }catch(err){ console.error('fallback error', err); alert('Could not play demo tone'); }
}

// Helpers for playing YouTube links inline
function getYouTubeId(url){ try{ const u = new URL(url); if(u.hostname.includes('youtu.be')) return u.pathname.slice(1); if(u.searchParams.get('v')) return u.searchParams.get('v'); // try path segments
    const m = url.match(/\/embed\/([A-Za-z0-9_-]{11})/); if(m) return m[1]; const m2 = url.match(/([A-Za-z0-9_-]{11})/); return m2 ? m2[1] : null; }catch(e){ const m = url.match(/([A-Za-z0-9_-]{11})/); return m?m[1]:null; } }

function playYouTubeInModal(url, track){ const id = getYouTubeId(url); if(!id){ alert('Could not determine YouTube video id'); return; }
  // create modal overlay
  const overlay = document.createElement('div'); overlay.className='yt-overlay'; overlay.style.position='fixed'; overlay.style.top='0'; overlay.style.left='0'; overlay.style.width='100%'; overlay.style.height='100%'; overlay.style.background='rgba(0,0,0,0.85)'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.zIndex='9999';
  const container = document.createElement('div'); container.style.width='80%'; container.style.maxWidth='900px'; container.style.aspectRatio='16/9'; container.style.position='relative'; container.style.background='#000'; container.style.borderRadius='8px'; container.style.overflow='hidden';
  const iframe = document.createElement('iframe'); iframe.width='100%'; iframe.height='100%'; iframe.frameBorder='0'; iframe.allow = 'autoplay; encrypted-media'; iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  const close = document.createElement('button'); close.textContent='✖'; close.title='Close'; close.style.position='absolute'; close.style.right='8px'; close.style.top='8px'; close.style.zIndex='10000'; close.style.background='rgba(255,255,255,0.06)'; close.style.border='none'; close.style.color='white'; close.style.padding='6px 8px'; close.style.borderRadius='6px'; close.style.cursor='pointer';
  close.addEventListener('click', ()=>{ document.body.removeChild(overlay); document.body.style.overflow=''; });
  container.appendChild(iframe); container.appendChild(close); overlay.appendChild(container); document.body.appendChild(overlay); document.body.style.overflow='hidden';
}

function saveTrack(id, opts={quick:true}){
  const t = state.tracks.find(x=>x.id===id); if(!t) return;
  // if no playlists or quick flag, show a small inline menu to choose destination
  const trackEl = document.querySelector(`.track[data-id="${id}"]`);
  // remove existing menus
  document.querySelectorAll('.save-menu').forEach(n=>n.remove());

  // Create a structured, accessible save menu popup
  const menu = document.createElement('div'); menu.className='save-menu'; menu.tabIndex = -1;
  // content: title, quick actions, playlists
  const safeTitle = (t.title||'Untitled').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safeArtist = (t.artist||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  menu.innerHTML = `
    <div class="menu-title"><div class="menu-title-main">${safeTitle}</div><div class="menu-title-sub">${safeArtist}</div></div>
    <div class="menu-actions">
      <button class="menu-btn upnext">➕ Up Next</button>
      <button class="menu-btn add-url">🔗 Add full URL</button>
    </div>
    <div class="menu-playlists">
      ${state.playlists.length===0 ? '<div class="menu-empty">No playlists yet — create one on the left</div>' : state.playlists.map(pl=>`<button class="menu-btn playlist-item" data-pl="${pl.id}">${pl.name}${pl.items.length?`<span class="pl-count">${pl.items.length}</span>`:''}</button>`).join('')}
    </div>
  `;

  // Append and position (inside track element so it's anchored)
  trackEl.appendChild(menu);
  // calculate space: prefer right side alignment centered vertically
  menu.style.position = 'absolute'; menu.style.right = '8px'; menu.style.top = '50%'; menu.style.transform = 'translateY(-50%)';

  // event handlers
  const up = menu.querySelector('.upnext'); if(up){ up.addEventListener('click', ()=>{ if(state.playlist.some(x=>x.id===t.id)){ flash('Already in Up Next'); } else { state.playlist.push(t); persistPlaylist(); renderQueue(); flash(`${t.title} added to Up Next`); } menu.remove(); removeDocListener(); }); }
  const addUrl = menu.querySelector('.add-url'); if(addUrl){ addUrl.addEventListener('click', ()=>{ menu.remove(); removeDocListener(); addFullUrlToTrack(id); }); }
  // Updated: playlists store full track objects so they display regardless of current catalog
  menu.querySelectorAll('.playlist-item').forEach(b=>{ b.addEventListener('click', (e)=>{ const plId = Number(b.dataset.pl); const pl = state.playlists.find(p=>p.id===plId); if(!pl) return; if(pl.items.some(x=>x.id===t.id)){ flash(`${t.title} already in ${pl.name}`); } else { const copy = { id: t.id, title: t.title, artist: t.artist, url: t.url, cover: t.cover, remote: !!t.remote, fullUrl: t.fullUrl, fullType: t.fullType, _blobUrl: t._blobUrl || false }; pl.items.push(copy); persistPlaylists(); renderPlaylists(); flash(`${t.title} added to ${pl.name}`); } menu.remove(); removeDocListener(); e.stopPropagation(); }); });

  // click-away: close menu when clicking outside
  function onDocClick(e){ if(!menu.contains(e.target)){ menu.remove(); removeDocListener(); } }
  function removeDocListener(){ document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKeyDown); }
  function onKeyDown(e){ if(e.key==='Escape'){ menu.remove(); removeDocListener(); } }
  // attach with slight delay so the immediate click that opened the menu doesn't close it
  setTimeout(()=>{ document.addEventListener('click', onDocClick); document.addEventListener('keydown', onKeyDown); }, 0);
}

function persistPlaylist(){ localStorage.setItem('vt_playlist', JSON.stringify(state.playlist)); updatePlaylistCount(); }

function persistPlaylists(){ localStorage.setItem('vt_playlists', JSON.stringify(state.playlists)); }

// fullUrl persistence
function persistFullUrls(){ localStorage.setItem('vt_fullUrls', JSON.stringify(state.fullUrls||{})); }
function loadFullUrls(){ state.fullUrls = JSON.parse(localStorage.getItem('vt_fullUrls')||'{}'); if(state.fullUrls){ state.tracks.forEach(t=>{ const v = state.fullUrls[t.id]; if(v){ if(typeof v === 'string'){ t.fullUrl = v; t.fullType = 'audio'; state.fullUrls[t.id] = {url:v, type:'audio'}; } else { t.fullUrl = v.url; t.fullType = v.type || 'audio'; } } }); } }

function renderQueue(){
  const q = $('queueList'); q.innerHTML='';
  state.playlist.forEach((t,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<span>${t.title} — ${t.artist}</span><span><button class="play-queue">▶</button><button class="remove-queue">✖</button></span>`;
    li.querySelector('.play-queue').addEventListener('click', ()=>selectTrack(t.id));
    li.querySelector('.remove-queue').addEventListener('click', ()=>{ state.playlist = state.playlist.filter(x=>x.id!==t.id); persistPlaylist(); renderQueue(); });
    q.appendChild(li);
  })
  updatePlaylistCount();
}

function renderPlaylists(){
  const ul = $('playlists'); ul.innerHTML='';
  // Discover anchor
  const disco = document.createElement('li'); disco.textContent = 'Discover'; disco.className = (state.currentView.type==='discover')? 'active':'';
  disco.addEventListener('click', ()=>{ document.querySelectorAll('#playlists li').forEach(n=>n.classList.toggle('active', n===disco)); state.currentView={type:'discover',id:null}; $('sectionTitle').textContent='Discover'; renderTrackGrid(state.tracks); });
  ul.appendChild(disco);

  if(state.playlists.length===0){
    const li = document.createElement('li'); li.textContent = 'No playlists yet'; li.style.color = 'var(--muted)'; ul.appendChild(li); return;
  }
  state.playlists.forEach(pl=>{
    const li = document.createElement('li'); li.dataset.id = pl.id;
    li.innerHTML = `<span class="pl-name">${pl.name}</span><span class="pl-controls">${pl.items.length?`<span class="pl-badge">${pl.items.length}</span>`:''}<button class="pl-remove" title="Remove">✖</button></span>`;
    li.addEventListener('click',(e)=>{
      if(e.target.closest('.pl-remove')) return; // ignore remove click
      document.querySelectorAll('#playlists li').forEach(n=>n.classList.toggle('active', n===li));
      state.currentView = {type:'playlist', id:pl.id};
      $('sectionTitle').textContent = pl.name;
      if(pl.items.length===0){ $('trackGrid').innerHTML = '<div class="empty">This playlist is empty. Save songs to it.</div>'; }
      else { /* pl.items now stores full track objects */ renderTrackGrid(pl.items); }
    });
    li.querySelector('.pl-remove').addEventListener('click',(e)=>{
      e.stopPropagation(); if(!confirm(`Delete playlist "${pl.name}"?`)) return;
      state.playlists = state.playlists.filter(x=>x.id!==pl.id); persistPlaylists(); renderPlaylists();
      if(state.currentView.type==='playlist' && state.currentView.id===pl.id){ state.currentView={type:'discover',id:null}; $('sectionTitle').textContent='Discover'; renderTrackGrid(state.tracks); }
    });
    ul.appendChild(li);
  });
}

function updatePlaylistCount(){ const el = $('playlistCount'); if(el) el.textContent = state.playlist.length; }

function flash(msg){ console.log(msg); /* lightweight feedback; replace with toast if desired */ }

// Add full track URL to a track (in-app playback if CORS-enabled)
function addFullUrlToTrack(id){ const t = state.tracks.find(x=>x.id===id); if(!t) return; const url = prompt('Paste a direct URL to the full audio file (must allow cross-origin requests) or a YouTube watch URL (will be embedded for in-app playback):',''); if(!url) return; let type = 'audio'; if(url.includes('youtube.com')||url.includes('youtu.be')){ type = 'youtube'; }
  // Save fullUrl and persist with type
  t.fullUrl = url; t.fullType = type; state.fullUrls = state.fullUrls||{}; state.fullUrls[t.id] = {url, type}; persistFullUrls(); renderTrackGrid(state.tracks); alert('Full track saved — click the 🔊 button or double-click the track to play it in-app.'); }

function onTrackDoubleClick(id){ const t = state.tracks.find(x=>x.id===id); if(!t) return; if(t.fullUrl){ // play full (prefer in-app)
    selectTrack(id); playTrack(id, {preferFull:true});
  } else if(t._blobUrl && t.url){ // local file blob — play normally
    selectTrack(id); playTrack(id);
  } else if(t.remote){ // iTunes preview only
    if(confirm('Full track not available in-app. Would you like to search YouTube for the full song?')){
      const q = encodeURIComponent(`${t.artist} ${t.title}`); window.open(`https://www.youtube.com/results?search_query=${q}`,'_blank');
    }
  } else {
    alert('No full track available — use the link icon to add a full track URL (CORS required) or upload a local file.');
  }}

// iTunes Search integration
async function fetchItunes(query, limit=25){
  state.itunesQuery = query; state.itunesLimit = limit;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&media=music&country=US`;
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('Network response not ok');
    const data = await res.json();
    const results = (data.results||[]).filter(r=>r.previewUrl).map(r=>({ id: `it_${r.trackId}`, title: r.trackName, artist: r.artistName, url: r.previewUrl, cover: (r.artworkUrl100||'').replace(/100x100bb.jpg$/,'400x400bb.jpg'), remote:true }));
    // attach any persisted full URLs for these results
    results.forEach(res=>{ const f = state.fullUrls && state.fullUrls[res.id]; if(f){ res.fullUrl = f.url; res.fullType = f.type || 'audio'; } });
    state.currentView = {type:'itunes', id:query};
    state.tracks = results;
    state.filtered = results;
    $('sectionTitle').textContent = `Search: ${query}`;
    renderTrackGrid(results);
    flash(`Found ${results.length} preview(s)`);
  }catch(err){ console.error('iTunes fetch error', err); alert('iTunes search failed: '+(err.message||err)); }
}

// Fetch iTunes search results without mutating app state — returns mapped tracks array
async function fetchItunesResults(query, limit=25){
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&media=music&country=US`;
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('Network response not ok');
    const data = await res.json();
    const results = (data.results||[]).filter(r=>r.previewUrl).map(r=>({ id: `it_${r.trackId}`, title: r.trackName, artist: r.artistName, url: r.previewUrl, cover: (r.artworkUrl100||'').replace(/100x100bb.jpg$/,'400x400bb.jpg'), remote:true }));
    // attach any persisted full URLs
    results.forEach(res=>{ const f = state.fullUrls && state.fullUrls[res.id]; if(f){ res.fullUrl = f.url; res.fullType = f.type || 'audio'; } });
    return results;
  }catch(err){ console.error('iTunes fetch error (helper)', err); return []; }
}

// Buttons
$('searchPersonBtn').addEventListener('click', ()=>{
  const q = (document.getElementById('searchInput')?.value||'').trim();
  if(!q){ state.filtered = state.tracks; renderTrackGrid(state.tracks); state.currentView={type:'discover',id:null}; $('sectionTitle').textContent='Discover'; return; }
  fetchItunes(q, 25);
});
// allow Enter key in search input to run search
const searchInput = document.getElementById('searchInput'); if(searchInput){ searchInput.addEventListener('keypress', (e)=>{ if(e.key==='Enter') $('searchPersonBtn').click(); }); }

$('randomBtn').addEventListener('click', async ()=>{
  // Fetch real tracks from iTunes and avoid repeats within this session.
  const desired = 10;
  const candidates = [];
  const triedQueries = new Set();
  const queryPool = SAMPLE_ARTISTS.concat(['top','hits','pop','indie','rock','jazz','beats','ambient','chill','retro']);

  // Try up to N queries to gather enough unique results
  for(let attempt=0; attempt<8 && candidates.length < desired; attempt++){
    // pick a random query term not tried yet
    let q = queryPool[Math.floor(Math.random()*queryPool.length)];
    // sometimes mix two words
    if(Math.random() < 0.35) q = q + ' ' + (queryPool[Math.floor(Math.random()*queryPool.length)]);
    if(triedQueries.has(q)) continue;
    triedQueries.add(q);
    try{
      const results = await fetchItunesResults(q, 25);
      for(const r of results){
        if(candidates.length >= desired) break;
        if(state.seenRandomIds.has(r.id)) continue;
        // minor normalization: ensure cover and url exist
        if(!r.url) continue;
        candidates.push(r);
      }
    }catch(e){ console.warn('random fetch failed for', q, e); }
  }

  // If still not enough, allow previously unseen from state.tracks or generate
  if(candidates.length < desired){
    const fallbackPool = (state.tracks||[]).concat(state.discoverCatalog||[]);
    for(const t of fallbackPool){ if(candidates.length>=desired) break; if(state.seenRandomIds.has(t.id)) continue; candidates.push(t); }
  }
  if(candidates.length === 0){ flash('Could not fetch random tracks right now'); return; }

  // choose up to desired and mark them seen
  const selection = candidates.sort(()=>Math.random()-0.5).slice(0, Math.min(desired, candidates.length));
  selection.forEach(s=> state.seenRandomIds.add(s.id));

  state.filtered = selection;
  state.currentView = {type:'discover', id:null};
  $('sectionTitle').textContent = 'Random';
  renderTrackGrid(selection);
});

$('saveBtn').addEventListener('click', ()=>{
  if(!state.selectedId){ alert('Select a track first (click it)'); return; }
  saveTrack(state.selectedId);
});

// Add playlist
const addBtn = $('addPlaylistBtn'); if(addBtn){ addBtn.addEventListener('click', ()=>{
  const name = ($('newPlaylistInput')?.value||'').trim(); if(!name){ alert('Enter a playlist name'); $('newPlaylistInput').focus(); return; }
  const pl = {id: Date.now(), name, items: []}; state.playlists.push(pl); persistPlaylists(); renderPlaylists(); $('newPlaylistInput').value = '';
});
  const input = $('newPlaylistInput'); if(input){ input.addEventListener('keypress', (e)=>{ if(e.key==='Enter') addBtn.click(); }); }
}

// Upload local audio files and play them
const uploadLocalBtn = $('uploadLocalBtn'); const uploadInput = $('uploadInput');
if(uploadLocalBtn && uploadInput){
  uploadLocalBtn.addEventListener('click', ()=>uploadInput.click());
  uploadInput.addEventListener('change', (e)=>{
    const files = Array.from(e.target.files||[]); if(!files.length) return; const newTracks = [];
    files.forEach(f=>{
      const url = URL.createObjectURL(f);
      const id = nextGeneratedId++;
      const track = {id, title: f.name.replace(/\.[^.]+$/, ''), artist: 'Local file', url, cover:`https://picsum.photos/seed/vt-${id}/400/400`, _blobUrl:true, fileName: f.name};
      state.tracks.unshift(track); newTracks.push(track);
    });
    state.filtered = state.tracks; renderTrackGrid(state.tracks);
    // auto-select and play the first uploaded file
    if(newTracks.length){ selectTrack(newTracks[0].id); }
    // reset input so same file can be picked again later
    uploadInput.value = '';
  });
}

// revoke blob urls on unload to free memory
window.addEventListener('beforeunload', ()=>{ revokeBlobUrls(state.tracks); });

// Player controls
$('playBtn').addEventListener('click', ()=>{ if(state.audio.paused) state.audio.play(); else state.audio.pause(); });
$('nextBtn').addEventListener('click', ()=>{ const idx = state.tracks.findIndex(t=>t.id===state.currentPlayingId); const next = state.tracks[(idx+1)%state.tracks.length]; if(next) selectTrack(next.id); });
$('prevBtn').addEventListener('click', ()=>{ const idx = state.tracks.findIndex(t=>t.id===state.currentPlayingId); const prev = state.tracks[(idx-1+state.tracks.length)%state.tracks.length]; if(prev) selectTrack(prev.id); });

// Discover: load more, refresh, and infinite scroll
let loadingMore = false;
function revokeBlobUrls(list){ if(!list || !list.length) return; list.forEach(t=>{ if(t && t._blobUrl && t.url && t.url.startsWith('blob:')){ try{ URL.revokeObjectURL(t.url); }catch(e){} } }); }

function loadMoreDiscover(count=10){
  if(loadingMore) return;
  loadingMore = true;
  const newTracks = generateTracks(count, nextGeneratedId);
  nextGeneratedId += count;
  // keep a persistent discover catalog independent of current view
  state.discoverCatalog = (state.discoverCatalog || []).concat(newTracks);
  // if we're currently viewing Discover, append to live tracks and render
  if(state.currentView.type === 'discover'){
    state.tracks = (state.tracks || []).concat(newTracks);
    state.filtered = state.tracks;
    renderTrackGrid(state.tracks);
  }
  loadingMore = false;
  flash(`${count} more loaded`);
}


function refreshDiscover(){ // replace discover catalog with fresh sample (15 items)
  // revoke old blob URLs to free memory
  revokeBlobUrls(state.tracks);
  const fresh = generateTracks(15, nextGeneratedId);
  nextGeneratedId += 15;
  // replace persistent discover catalog and current visible tracks
  state.discoverCatalog = fresh.slice();
  state.tracks = fresh;
  state.filtered = state.tracks;
  state.currentView = {type:'discover', id:null};
  $('sectionTitle').textContent = 'Discover';
  renderTrackGrid(state.tracks);
  flash('Discover refreshed');
}

let scrollTimer = null; window.addEventListener('scroll', ()=>{ if(state.currentView.type!=='discover') return; if(scrollTimer) return; scrollTimer = setTimeout(()=>{ scrollTimer = null; const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400; if(nearBottom){ loadMoreDiscover(10); } }, 200); });

// Load More and Refresh buttons
const loadMoreBtn = $('loadMoreBtn'); if(loadMoreBtn) loadMoreBtn.addEventListener('click', ()=>{
  if(state.currentView.type==='itunes' && state.itunesQuery){ state.itunesLimit = (state.itunesLimit||25) + 25; fetchItunes(state.itunesQuery, state.itunesLimit); }
  else { loadMoreDiscover(12); }
});
const refreshBtn = $('refreshBtn'); if(refreshBtn) refreshBtn.addEventListener('click', async ()=>{
  // Try to fetch fresh real-world tracks (iTunes) similar to Random.
  const desired = 10;
  const candidates = [];
  const tried = new Set();
  const queryPool = SAMPLE_ARTISTS.concat(['top','hits','pop','indie','rock','jazz','beats','ambient','chill','retro']);

  for(let attempt=0; attempt<8 && candidates.length < desired; attempt++){
    let q = queryPool[Math.floor(Math.random()*queryPool.length)];
    if(Math.random() < 0.35) q = q + ' ' + (queryPool[Math.floor(Math.random()*queryPool.length)]);
    if(tried.has(q)) continue;
    tried.add(q);
    try{
      const results = await fetchItunesResults(q, 25);
      for(const r of results){
        if(candidates.length >= desired) break;
        if(state.seenRandomIds.has(r.id)) continue;
        if(!r.url) continue;
        candidates.push(r);
      }
    }catch(e){ console.warn('refresh fetch failed for', q, e); }
  }

  // Fallback to local generate if no remote results
  if(candidates.length < desired){
    // refresh local discover catalog and use those
    refreshDiscover();
    const pool = state.discoverCatalog && state.discoverCatalog.length ? state.discoverCatalog.slice() : state.tracks.slice();
    for(const t of pool){ if(candidates.length>=desired) break; if(state.seenRandomIds.has(t.id)) continue; candidates.push(t); }
  }

  if(candidates.length === 0){
    // last resort: ensure discover is refreshed
    refreshDiscover();
    return;
  }

  const selection = candidates.sort(()=>Math.random()-0.5).slice(0, Math.min(desired, candidates.length));
  selection.forEach(s=> state.seenRandomIds.add(s.id));
  state.filtered = selection; state.currentView = {type:'discover', id:null};
  $('sectionTitle').textContent = 'Discover'; renderTrackGrid(selection);
  try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(e){}
});

// Init
loadFullUrls();
try{ migratePlaylists(); }catch(e){ console.warn('playlist migration failed', e); }
renderQueue(); renderPlaylists(); updatePlaylistCount();

// Migrate old playlists that stored only ids into object-based items
function migratePlaylists(){
  if(!Array.isArray(state.playlists)) return;
  state.playlists.forEach(pl=>{
    if(!pl.items || !pl.items.length) return;
    if(typeof pl.items[0] === 'object') return; // already objects
    const newItems = pl.items.map(id => {
      // try to find the track in current catalogs
      let found = (state.tracks||[]).find(t=>String(t.id)===String(id));
      if(!found && state.discoverCatalog) found = (state.discoverCatalog||[]).find(t=>String(t.id)===String(id));
      if(!found){
        // create a minimal placeholder object
        const title = String(id).slice(0,24);
        found = { id, title: `Saved: ${title}`, artist: 'Unknown', url: null, cover: generateTextCover(`Saved`, 'Unknown', id) };
      }
      return found;
    });
    pl.items = newItems;
  });
  persistPlaylists();
}

// Load initial popular previews from iTunes
fetchItunes('top hits', 25).then(()=>{ try{ $('sectionTitle').textContent = 'Top Hits'; }catch(e){} }).catch(()=>{});

// Expose for debugging
window.VT = {state};