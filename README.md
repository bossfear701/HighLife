# Micro City — GTA‑style Web Game (HTML/JS)

A lightweight, single‑page top‑down "GTA‑like" built with vanilla HTML5 Canvas + JavaScript. No external libraries, no CDNs — it runs locally or on any static web host.

## Features
- Driveable cars with basic physics (WASD/Arrow keys + Space for handbrake)
- Enter/exit vehicles (E)
- Simple AI traffic + police that chase you when your Wanted level rises
- Missions with rewards and a basic progression loop
- Mini‑map toggle (M)
- Day/night cycle & dynamic weather (Clear, Rain, Fog)
- Clean UI HUD, responsive canvas, optional on‑screen mobile buttons

## How to run
1. **Download the ZIP** and extract it.
2. Open `index.html` in a browser (Chrome/Edge/Firefox). No server required.
3. Optional: host the folder on any static host (GitHub Pages, Netlify, Vercel).

## Controls
- **W/A/S/D** or **Arrow Keys** — Drive / Walk
- **Space** — Handbrake (in car)
- **E** — Enter/Exit car
- **M** — Toggle mini‑map
- **N** — Next mission

## Folder structure
```
/ (root)
  index.html
  style.css
  game.js
  README.md
```

## Notes
- This is a prototype for learning and showcasing; it’s intentionally simple so you can extend it.
- Ideas to extend: weapons, shops, garages, NPC dialogs, save system, better car handling, sound effects, or a 3D version with WebGL/Three.js.
