# Supermoto Wheelie 3D

A lightweight, high-performance 3D motorcycle wheelie simulator running directly in the browser with no plugins, servers, or databases required.

Built with **React 19**, **Three.js**, **TypeScript**, and **Vite**.

---

## 🎮 Features

- **Physics-Based Wheelie Dynamics**:
  - Realistic balance sweet spot (45° – 75°), acceleration lift-off, and rear fender scraping.
  - Backwards loop-out crash detection (> 90°) with automatic 3-second countdown restart.
  - Live distance tracker recording your best and recent wheelie runs.
- **Dynamic Procedural Steppe Environment**:
  - Endless seamless terrain tile recycling with height-mapped slopes and worn dirt tracks.
  - High-performance instanced grass with LOD scaling (Low to Ultra quality presets).
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
```

---

## 📄 License

This project is licensed under the MIT License.
