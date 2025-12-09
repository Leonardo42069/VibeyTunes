# VibeyTunes — Static Spotify-like Demo

This is a small static demo of a Spotify-like UI (searchable track grid, player bar, simple queue) built with plain HTML/CSS/JS.

Getting started

- Open `index.html` in your browser (modern browsers recommended). For full audio behavior it's best to serve files over HTTP rather than `file://`.

Quick local server (PowerShell):

```powershell
# From the project folder
python -m http.server 8000; # or
powershell -c "Start-Process 'index.html'"
```

Usage

- Click `Play` on any card to start playback.
- Use `+ Queue` to add tracks to the up-next list.
- Use the search box to filter tracks.
- Click `Upload Full Tracks` to add local full-length audio files (MP3/AAC) to the app. Uploaded files play full-length using object URLs and are not uploaded anywhere.

- Use `Load Free Full Tracks` with the search box to find free full-length songs on Internet Archive. Check `Only music` to filter out spoken-word results (lectures, interviews, audiobooks).
- For each free track the app shows a license field when available and a `Download` button that opens the file on archive.org. Only download files when the license indicates Creative Commons/public domain or you have the right to download the file.

Notes

- Audio files in the demo use public sample MP3s from SoundHelix or preview clips from iTunes when using `Load Top Songs`.
- Uploaded local files play their full duration via browser object URLs. To free memory, object URLs are revoked on page unload. If you upload many large files consider refreshing the page periodically.
- For true streaming of full commercial tracks (Spotify, Apple Music) you'll need to integrate each service's SDK/API and meet their licensing/auth requirements (e.g., Spotify Web Playback requires Premium + OAuth).
