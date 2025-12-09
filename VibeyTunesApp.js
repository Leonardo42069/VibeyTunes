// Simple Spotify-like static demo player
const sampleTracks = [
  {
    id: 1,
    title: 'SoundHelix Song 1',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/300/300?random=1',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    popularity: 95
  },
  {
    id: 2,
    title: 'SoundHelix Song 2',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/300/300?random=2',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    popularity: 86
  },
  {
    id: 3,
    title: 'SoundHelix Song 3',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/300/300?random=3',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    popularity: 72
  },
  {
    id: 4,
    title: 'SoundHelix Song 4',
    artist: 'SoundHelix',
    cover: 'https://picsum.photos/300/300?random=4',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    popularity: 65
  },
  {
    id: 5,
    title: 'Acoustic Breeze',
    artist: 'Free Music',
    cover: 'https://picsum.photos/300/300?random=5',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    popularity: 88
  },
  {
    id: 6,
    title: 'Sunny Morning',
    artist: 'Demo Artist',
    cover: 'https://picsum.photos/300/300?random=6',
    src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    popularity: 50
  }
];

// App state
const state = {
  tracks: sampleTracks,
  queue: [],
  currentIndex: -1,
  isPlaying: false
};
// popularShuffleMode: when true, after each end we pick a random from top popular
state.popularShuffleMode = false;


const audio = new Audio();
audio.crossOrigin = "anonymous";

// track object URLs for cleanup when uploading local files
const createdObjectURLs = [];

// DOM refs
const trackGrid = document.getElementById('trackGrid');
const searchInput = document.getElementById('searchInput');
const queueList = document.getElementById('queueList');
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const playerCover = document.getElementById('playerCover');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const seek = document.getElementById('seek');
const currentTime = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volume = document.getElementById('volume');

function timeFormat(sec){
  if (isNaN(sec)) return '0:00';
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  const m = Math.floor(sec/60);
  return `${m}:${s}`;
}

function renderTracks(list){
  trackGrid.innerHTML = '';
  list.forEach((t, idx)=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="cover" src="${t.cover}" alt="cover">
      <div class="meta">
        <div class="title">${t.title}</div>
        <div class="artist">${t.artist}</div>
        ${t.license ? `<div style="font-size:12px;color:var(--muted);margin-top:6px">License: ${t.license}</div>` : ''}
      </div>
      <div style="margin-top:auto;display:flex;gap:8px;align-items:center;">
        <button data-play="${t.id}">Play</button>
        <button data-queue="${t.id}">+ Queue</button>
        ${t.src && t.canDownload ? `<button data-download="${t.src}" data-title="${encodeURIComponent(t.title)}">Download</button>` : ''}
      </div>
    `;
    trackGrid.appendChild(card);
  });
}

function setTrackByIndex(idx){
  if(idx < 0 || idx >= state.tracks.length) return;
  const t = state.tracks[idx];
  state.currentIndex = idx;
  audio.src = t.src;
  playerTitle.textContent = t.title;
  playerArtist.textContent = t.artist;
  playerCover.src = t.cover;
}

function play(){
  audio.play();
  state.isPlaying = true;
  playBtn.textContent = '⏸';
}
function pause(){
  audio.pause();
  state.isPlaying = false;
  playBtn.textContent = '▶';
}

function playTrackById(id){
  const idx = state.tracks.findIndex(t=>t.id==id);
  if(idx===-1) return;
  setTrackByIndex(idx);
  play();
}

function addToQueue(id){
  const t = state.tracks.find(x=>x.id==id);
  if(!t) return;
  state.queue.push(t);
  renderQueue();
}

function renderQueue(){
  queueList.innerHTML = '';
  state.queue.forEach((t,i)=>{
    const li = document.createElement('li');
    li.textContent = `${t.title} — ${t.artist}`;
    li.style.cursor = 'pointer';
    li.onclick = ()=>{
      // play directly from queue
      const idx = state.tracks.findIndex(tr=>tr.id===t.id);
      if(idx>=0){ setTrackByIndex(idx); play(); state.queue.splice(i,1); renderQueue(); }
    };
    queueList.appendChild(li);
  })
}

// Event bindings
document.addEventListener('click', (e)=>{
  const playId = e.target.getAttribute && e.target.getAttribute('data-play');
  const queueId = e.target.getAttribute && e.target.getAttribute('data-queue');
  const downloadUrl = e.target.getAttribute && e.target.getAttribute('data-download');
  const downloadTitle = e.target.getAttribute && e.target.getAttribute('data-title');
  if(playId) playTrackById(Number(playId));
  if(queueId) addToQueue(Number(queueId));
  if(downloadUrl){
    // confirm license / user consent before opening
    const decodedTitle = downloadTitle ? decodeURIComponent(downloadTitle) : 'file';
    const ok = confirm(`Download "${decodedTitle}"? Make sure this file's license permits downloading and reuse. Proceed to open the file in a new tab?`);
    if(ok){ window.open(downloadUrl, '_blank'); }
  }
});

playBtn.onclick = ()=>{ state.isPlaying ? pause() : play(); };
prevBtn.onclick = ()=>{
  const prev = Math.max(0, state.currentIndex-1);
  setTrackByIndex(prev); play();
};
nextBtn.onclick = ()=>{
  const next = Math.min(state.tracks.length-1, state.currentIndex+1);
  if(state.currentIndex+1 < state.tracks.length){ setTrackByIndex(next); play(); }
};

seek.oninput = (e)=>{
  const p = Number(e.target.value);
  if(!isNaN(audio.duration)) audio.currentTime = (p/100)*audio.duration;
};

audio.ontimeupdate = ()=>{
  currentTime.textContent = timeFormat(audio.currentTime);
  durationEl.textContent = timeFormat(audio.duration);
  if(audio.duration){ seek.value = (audio.currentTime/audio.duration)*100; }
};

audio.onended = ()=>{
  if(state.popularShuffleMode){
    // pick another random from top popular set
    const top = getTopPopular(3);
    if(top.length){
      const pick = top[Math.floor(Math.random()*top.length)];
      const idx = state.tracks.findIndex(t=>t.id===pick.id);
      if(idx>=0){ setTrackByIndex(idx); play(); }
      return;
    }
  }

  if(state.queue.length){
    const next = state.queue.shift();
    renderQueue();
    const idx = state.tracks.findIndex(t=>t.id===next.id);
    if(idx>=0){ setTrackByIndex(idx); play(); }
  } else if(state.currentIndex < state.tracks.length-1){
    setTrackByIndex(state.currentIndex+1); play();
  } else { pause(); audio.currentTime = 0; }
};

// get top N popular tracks (by popularity descending)
function getTopPopular(n=3){
  const copy = state.tracks.slice();
  copy.sort((a,b)=> (b.popularity||0) - (a.popularity||0));
  return copy.slice(0,n);
}

// play a random track from top N popular tracks
function playRandomFromTop(n=3){
  const top = getTopPopular(n);
  if(!top.length) return;
  const pick = top[Math.floor(Math.random()*top.length)];
  playTrackById(pick.id);
}

// toggle popular shuffle mode (plays random top-popular tracks continuously)
const shuffleBtn = document.getElementById('shufflePopularBtn');
if(shuffleBtn){
  shuffleBtn.onclick = ()=>{
    state.popularShuffleMode = !state.popularShuffleMode;
    shuffleBtn.classList.toggle('active', state.popularShuffleMode);
    if(state.popularShuffleMode){
      // start immediately by playing one random popular track
      playRandomFromTop(3);
    }
  }
}

volume.oninput = (e)=>{ audio.volume = Number(e.target.value); };

searchInput.addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase();
  if(!q) { renderTracks(state.tracks); return; }
  const filtered = state.tracks.filter(t=> (t.title + ' ' + t.artist).toLowerCase().includes(q));
  renderTracks(filtered);
});

// Initialize
renderTracks(state.tracks);
setTrackByIndex(0);
audio.volume = Number(volume.value);

// --- Load top songs from iTunes RSS + lookup ---
async function loadTopSongs(limit = 10, country = 'us'){
  const rssUrl = `https://itunes.apple.com/${country}/rss/topsongs/limit=${limit}/json`;
  const resp = await fetch(rssUrl);
  if(!resp.ok) throw new Error('Failed to fetch top songs');
  const data = await resp.json();
  const entries = (data.feed && data.feed.entry) || [];
  if(entries.length === 0) throw new Error('No top songs returned');

  // collect im:id values
  const ids = entries.map(e => {
    try { return e.id.attributes['im:id']; } catch (err) { return null; }
  }).filter(Boolean);
  if(ids.length === 0) throw new Error('No track ids found');

  // lookup to get previewUrl in batch
  const lookupUrl = `https://itunes.apple.com/lookup?id=${ids.join(',')}&country=${country}`;
  const lookupResp = await fetch(lookupUrl);
  if(!lookupResp.ok) throw new Error('Lookup failed');
  const lookup = await lookupResp.json();
  const results = lookup.results || [];

  // map to our track format; ensure previewUrl exists
  const tracks = results.map(r => ({
    id: r.trackId || r.collectionId || Math.floor(Math.random()*1e9),
    title: r.trackName || r.collectionName || r.artistName,
    artist: r.artistName || 'Unknown',
    cover: (r.artworkUrl100 || '').replace('100x100bb','300x300bb'),
    src: r.previewUrl || null,
    popularity: r.trackCount ? 50 : 60
  })).filter(t => t.src);

  if(tracks.length === 0) throw new Error('No playable previews available');
  // revoke any existing local object URLs before replacing tracks
  if(createdObjectURLs.length) {
    createdObjectURLs.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} });
    createdObjectURLs.length = 0;
  }

  state.tracks = tracks;
  state.queue = [];
  state.currentIndex = -1;
  renderTracks(state.tracks);
  setTrackByIndex(0);
  play();
}

const loadBtn = document.getElementById('loadTopBtn');
if(loadBtn){
  loadBtn.onclick = async ()=>{
    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading...';
    try{
      await loadTopSongs(10, 'us');
    }catch(err){
      alert('Could not load top songs: ' + (err.message || err));
      console.error(err);
    }finally{
      loadBtn.disabled = false;
      loadBtn.textContent = 'Load Top Songs';
    }
  }
}

// --- Load free full-length tracks from Internet Archive ---
const loadFreeBtn = document.getElementById('loadFreeBtn');
const freeSearchInput = document.getElementById('freeSearchInput');
const onlyMusicCheck = document.getElementById('onlyMusicCheck');
async function loadFreeFullTracks(query = '', limit = 10, onlyMusic = true){
  // Build advancedsearch query targeting audio and Creative Commons-licensed items
  const parts = ['mediatype:(audio)', 'licenseurl:*creativecommons*'];
  if(query && query.trim()){
    // search title/creator/subject/description for the query
    const qEsc = query.replace(/"/g, '\\"');
    parts.push(`(title:(\"${qEsc}\") OR creator:(\"${qEsc}\") OR subject:(\"${qEsc}\") OR description:(\"${qEsc}\"))`);
  }
  if(onlyMusic){
    // exclude common spoken-word tags and prefer music subjects
    parts.push('-subject:(speech OR interview OR lecture OR audiobook OR reading OR "spoken word")');
  }
  const q = encodeURIComponent(parts.join(' AND '));
  const url = `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier,title,creator&sort[]=downloads desc&rows=${limit}&page=1&output=json`;
  const resp = await fetch(url);
  if(!resp.ok) throw new Error('Failed to query Internet Archive');
  const json = await resp.json();
  const docs = (json.response && json.response.docs) || [];
  if(docs.length === 0) throw new Error('No free audio items found');

  const tracks = [];
  for(const d of docs){
    try{
      const id = d.identifier;
      const metaResp = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`);
      if(!metaResp.ok) continue;
      const meta = await metaResp.json();
      const files = meta.files || [];
      // prefer mp3 files
      const mp3 = files.find(f => f.name && f.name.toLowerCase().endsWith('.mp3')) || files.find(f=> f.format && /mp3/i.test(f.format));
      if(!mp3) continue;
      const fileName = mp3.name;
      const fileUrl = `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(fileName)}`;
      // license info (metadata may include license, rights or licenseurl)
      const md = meta.metadata || {};
      const license = md.license || md.licenseurl || md.rights || md.rights || md['creativecommons'] || '';
      // basic heuristic: skip items that have 'speech' in title/subject when onlyMusic requested
      if(onlyMusic){
        const txt = `${d.title || ''} ${(md.subject || '')}`.toLowerCase();
        if(/speech|interview|lecture|audiobook|reading|spoken word/.test(txt)) continue;
      }
      tracks.push({
        id: `${id}-${fileName}`,
        title: d.title || fileName,
        artist: d.creator || (md.creator || 'Various'),
        cover: meta.image || `https://picsum.photos/300/300?random=${Math.floor(Math.random()*1000)}`,
        src: fileUrl,
        license: license || '',
        canDownload: true,
        archiveId: id,
        popularity: mp3.size ? Math.min(100, Math.floor(mp3.size/100000)) : 10
      });
    }catch(e){ console.warn('item parse failed', e); }
  }

  if(tracks.length === 0) throw new Error('No playable MP3 files found in search results');

  // revoke any local object URLs before replacing
  if(createdObjectURLs.length){ createdObjectURLs.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); createdObjectURLs.length = 0; }

  state.tracks = tracks;
  state.queue = [];
  state.currentIndex = -1;
  renderTracks(state.tracks);
  setTrackByIndex(0);
  play();
}

if(loadFreeBtn){
  loadFreeBtn.onclick = async ()=>{
    loadFreeBtn.disabled = true;
    loadFreeBtn.textContent = 'Loading...';
    try{
      const q = freeSearchInput && freeSearchInput.value ? freeSearchInput.value.trim() : '';
      const onlyMusic = !!(onlyMusicCheck && onlyMusicCheck.checked);
      await loadFreeFullTracks(q, 10, onlyMusic);
    }catch(err){
      alert('Could not load free tracks: ' + (err.message || err));
      console.error(err);
    }finally{
      loadFreeBtn.disabled = false;
      loadFreeBtn.textContent = 'Load Free Full Tracks';
    }
  }
}

// --- Upload local full audio files and play them ---
const uploadInput = document.getElementById('uploadInput');
const uploadBtn = document.getElementById('uploadBtn');

function revokeLocalObjectURLs(){
  while(createdObjectURLs.length){
    try{ URL.revokeObjectURL(createdObjectURLs.pop()); }catch(e){ /* ignore */ }
  }
}

if(uploadBtn && uploadInput){
  uploadBtn.onclick = ()=> uploadInput.click();
  uploadInput.onchange = (e)=>{
    const files = Array.from(e.target.files || []);
    if(files.length === 0) return;

    // add each file as a track using an object URL
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      createdObjectURLs.push(url);
      const track = {
        id: Math.floor(Math.random()*1e9),
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Local file',
        cover: 'https://picsum.photos/300/300?random=' + Math.floor(Math.random()*1000),
        src: url,
        popularity: 10
      };
      state.tracks.push(track);
    });

    renderTracks(state.tracks);
    // play first newly uploaded file
    const firstIdx = state.tracks.length - files.length;
    setTrackByIndex(firstIdx);
    play();
    // clear input so same files can be uploaded again
    uploadInput.value = '';
  };
}

// revoke local object URLs when unloading the page to free memory
window.addEventListener('beforeunload', ()=>{ revokeLocalObjectURLs(); });
