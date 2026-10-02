# Supermoto Wheelie 3D

[![Live Demo](https://img.shields.io/badge/🎮_Play_Online-wheelietime.stup.id.vn-2ea44f?style=for-the-badge)](https://wheelietime.stup.id.vn)

[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Bundler-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

A lightweight, high-performance 3D motorcycle wheelie simulator running directly in the browser with no plugins, servers, or databases required.

Built with **React 19**, **Three.js**, **TypeScript**, and **Vite**.

---

## 🎮 Features

- **Physics-Based Wheelie Dynamics**:
  - Realistic balance sweet spot (45° – 75°), acceleration lift-off, and rear fender scraping.
  - Overbalance detection (> 90°), a bounded left/right side fall and friction-based forward slide, with automatic 3-second countdown restart.
  - Live distance tracker recording your best and recent wheelie runs.
- **Dynamic Procedural Steppe Environment**:
  - Endless seamless terrain tile recycling with height-mapped slopes and worn dirt tracks.
  - World-space grass/dry soil blending, multi-scale texture sampling, subtle bump detail and tire traces.
  - Blue gradient sky, animated procedural clouds, three hazed ridgelines and warm afternoon sunlight.
  - Instanced short grass rooted to the rendered triangles, streamed in a fixed pool around the rider.
  - Low–Ultra density scaling and smooth distance fade; distant scrub leaves the central practice area open.
  - Procedural particle systems for 2-stroke/4-stroke exhaust haze, roost dust clouds, and scraping sparks.
- **Stickman Rider with Two-Bone IK**:
  - Anatomically proportioned rider whose limbs mathematically lock onto handlebars and footpegs through all wheelies and lean angles.
  - Swappable 3D helmet collection loaded on demand with GLTF caching.
- **Realistic Synthesized Audio**:
  - Pure Web Audio API engine — no external audio files.
  - Procedural sound synthesis reproducing distinct single-cylinder 4-stroke thumps and screaming 2-stroke revs.
- **Responsive Racing HUD**:
  - Real-time speedometer (km/h), wheelie distance (m), pitch meter, FPS counter, graphic quality switcher, and sound toggle.
  - Free mouse-drag 360° orbit camera with scroll zoom.

---

## ⌨️ Controls

| Key / Input | Action |
| :--- | :--- |
| <kbd>Shift</kbd> | Start / Stop Engine |
| <kbd>W</kbd> / <kbd>↑</kbd> | Throttle (Ga) |
| <kbd>S</kbd> / <kbd>↓</kbd> | Rear Brake (Phanh) |
| <kbd>A</kbd> / <kbd>D</kbd> | Steer Left / Right (Lái) |
| <kbd>R</kbd> | Restart / Retry |
| **Mouse Left Drag** | Orbit 360° Camera View |
| **Mouse Wheel** | Zoom In / Out |

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **3D Graphics Engine**: [Three.js](https://threejs.org/)
- **Audio Engine**: Web Audio API (procedural synthesis)
- **Styling**: Vanilla CSS (responsive glassmorphism design system)
- **Linter**: [Oxlint](https://oxc.rs/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ recommended)
- `npm`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tungtpat05/supermoto_wheelie.git
   cd supermoto_wheelie
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

### Production Build

```bash
npm run build
npm run preview
```

---

## 🧪 Testing & Verification

The project includes headless unit and regression test scripts validating mathematics and physics:

```bash
# Verify wheelie distance accumulation, lift-off, and touchdown resets across FPS targets
node scripts/verify-wheelie-distance.mjs

# Verify terrain continuous seams, 12 km slopes, and particle pooling
node scripts/verify-steppe.mjs

# Verify rider Two-Bone IK math, limb constraints, and helmet anchors
node scripts/verify-rider.mjs

# Verify bounded side falls, slide momentum, FPS independence and ground contact
node scripts/verify-crash.mjs
```

`/scripts/crash-visual-check.html` previews the tip, side fall, impact and slide on
each bike. It can check all three models on both sides across seven fall stages.
The crash tips back at most another 7°, settles onto its side in 0.92 seconds, and
locks rotation on impact. Incoming travel direction is retained while ground
friction brings the slide to rest. Arms tuck during the fall and return to the
grips on restart; rider and bike stay together without a ragdoll solver.

With the dev server running, `/scripts/environment-visual-check.html` checks the
rendering at 90 km/h, wheelie and side views, all quality presets, lateral riding,
and a 12 km tile-recycling jump. Its camera/pose controls exist only in that check
page. The production camera, physics, controls and HUD are unchanged.

The environment reuses the bundled grass texture and HDR lighting asset. Clouds
use a single sky material; grass uses opaque geometry and a fixed 7 × 7 chunk
pool with 44–94 m visibility. There are no added postprocessing passes or runtime
dependencies. `verify-steppe.mjs` also raycasts grass roots against the terrain and
checks deterministic restart and disposal.

---

## 📄 License

This project is licensed under the MIT License.
