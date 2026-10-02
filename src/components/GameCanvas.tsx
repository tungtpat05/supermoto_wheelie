import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createSupermotoBike, type SupermotoParts } from '../game/SupermotoMesh';
import { EnvironmentManager } from '../game/EnvironmentManager';
import { terrainHeight } from '../game/SteppeTerrain';
import { PhysicsEngine, type PhysicsState } from '../game/PhysicsEngine';
import { audioEngine } from '../audio/AudioEngine';
import { HUD } from './HUD';
import { QUALITY_PRESETS, isGraphicsQuality, type GraphicsQuality } from '../game/GraphicsQuality';
import { DEFAULT_BIKE_ID, getBikeConfig } from '../game/BikeConfigs';
import { loadBikeModel } from '../game/BikeLoader';
import { WheelieHistoryTracker, type WheelieHistoryRecord } from '../game/WheelieHistory';
import { DEFAULT_HELMET_ID } from '../game/Rider/HelmetConfig';
import { RIDER_DEBUG_ENABLED } from '../game/Rider/RiderConfig';

const QUALITY_KEY = 'supermoto_wheelie_quality';

const SELECTED_BIKE_KEY = 'supermoto_wheelie_selected_bike';

export const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Game Engine Objects
  const physicsRef = useRef<PhysicsEngine>(new PhysicsEngine());
  const wheelieHistoryTrackerRef = useRef<WheelieHistoryTracker>(new WheelieHistoryTracker());
  const environmentRef = useRef<EnvironmentManager | null>(null);
  const bikePartsRef = useRef<SupermotoParts | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Mouse Orbit Look Camera State
  const isDraggingRef = useRef<boolean>(false);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitYawRef = useRef<number>(0);
  const orbitPitchRef = useRef<number>(0.25);
  const cameraDistanceRef = useRef<number>(4.8);

  const [selectedBikeId, setSelectedBikeId] = useState<string>(() => {
    return getBikeConfig(localStorage.getItem(SELECTED_BIKE_KEY) || DEFAULT_BIKE_ID).id;
  });
  const selectedBikeIdRef = useRef<string>(selectedBikeId);
  const [quality, setQuality] = useState<GraphicsQuality>(() => {
    const saved = localStorage.getItem(QUALITY_KEY);
    return isGraphicsQuality(saved) ? saved : 'High';
  });
  const qualityRef = useRef(quality);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [fps, setFps] = useState(0);
  const [bikeError, setBikeError] = useState('');
  const bikeLoadingRef = useRef(true);
  const [engineRunning, setEngineRunning] = useState(false);
  const engineRunningRef = useRef(false);
  const [enginePrompt, setEnginePrompt] = useState(false);
  const enginePromptTimerRef = useRef<number | null>(null);
  const [isBikeLoading, setIsBikeLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [selectedHelmetId, setSelectedHelmetId] = useState(DEFAULT_HELMET_ID);
  const [helmetLoading, setHelmetLoading] = useState(false);
  const [helmetError, setHelmetError] = useState('');

  // Keyboard Inputs State
  const inputsRef = useRef({
    throttle: false,
    rearBrake: false,
    steerLeft: false,
    steerRight: false,
  });

  const [physicsState, setPhysicsState] = useState<PhysicsState>(() => new PhysicsEngine().getState());
  const [measuredPitchDeg, setMeasuredPitchDeg] = useState(0);
  const [wheelieHistory, setWheelieHistory] = useState<WheelieHistoryRecord[]>([]);
  const [bestWheelie, setBestWheelie] = useState(0);

  const changeQuality = useCallback((next: GraphicsQuality) => {
    qualityRef.current = next;
    setQuality(next);
    localStorage.setItem(QUALITY_KEY, next);
    const preset = QUALITY_PRESETS[next];
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
      renderer.shadowMap.enabled = preset.shadows;
      renderer.shadowMap.needsUpdate = true;
    }
    environmentRef.current?.setQuality(next);
  }, []);
  // Restart Handler (Fixed: reset physics, environment terrain segments, rider and bike transforms)
  const handleRestart = useCallback(() => {
    physicsRef.current.reset();
    wheelieHistoryTrackerRef.current.reset();
    environmentRef.current?.reset();
    orbitYawRef.current = 0;
    orbitPitchRef.current = 0.25;
    cameraDistanceRef.current = 4.8;
    isDraggingRef.current = false;
    engineRunningRef.current = false;
    setEngineRunning(false);
    setEnginePrompt(false);
    setMeasuredPitchDeg(0);
    audioEngine.setEngineRunning(false);
    physicsRef.current.setEngineRunning(false);

    if (bikePartsRef.current) {
      bikePartsRef.current.wheelRotationEffect?.reset();
      bikePartsRef.current.bikeGroup.position.set(0, 0, 0);
      bikePartsRef.current.bodyGroup.rotation.set(0, 0, 0);
    }


    setPhysicsState(physicsRef.current.getState());
  }, []);

  // Switch Bike Model Handler
  const switchBike = useCallback(async (bikeId: string) => {
    if (bikeLoadingRef.current || bikeId === selectedBikeIdRef.current) return;
    bikeLoadingRef.current = true;
    setBikeError('');
    const config = getBikeConfig(bikeId);
    setIsBikeLoading(true);
    setLoadProgress(15);

    try {
      const newParts = await loadBikeModel(bikeId, (progress) => {
        setLoadProgress(Math.max(15, progress));
      });

      if (!sceneRef.current) {
        newParts.wheelRotationEffect?.dispose();
        newParts.rider.dispose();
        return;
      }
      bikePartsRef.current?.wheelRotationEffect?.dispose();
      bikePartsRef.current?.rider.dispose();

      if (sceneRef.current) {
        if (bikePartsRef.current) {
          sceneRef.current.remove(bikePartsRef.current.bikeGroup);
        }
        sceneRef.current.add(newParts.bikeGroup);
      }

      bikePartsRef.current = newParts;
      physicsRef.current.applyBikeTuning(config.physics);
      audioEngine.setSoundProfile(config.soundType);

      selectedBikeIdRef.current = bikeId;
      setSelectedBikeId(bikeId);
      localStorage.setItem(SELECTED_BIKE_KEY, bikeId);

    } catch (err) {
      console.error('Failed to switch bike:', err);
      setBikeError('Failed to load bike. Please select another.');
    } finally {
      bikeLoadingRef.current = false;
      setIsBikeLoading(false);
    }
  }, []);

  // Helmet selection is independent of bike selection; reattach it after any bike load.
  useEffect(() => {
    const rider = bikePartsRef.current?.rider;
    if (!rider || isBikeLoading) return;
    let cancelled = false;
    setHelmetLoading(Boolean(selectedHelmetId));
    setHelmetError('');
    rider.setHelmet(selectedHelmetId).catch(error => {
      if (cancelled) return;
      console.warn('Helmet load failed:', error);
      setHelmetError('Failed to load helmet. Please choose another.');
    }).finally(() => {
      if (!cancelled) setHelmetLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedHelmetId, isBikeLoading]);

  useEffect(() => {
    bikePartsRef.current?.rider.debug?.setEnabled(RIDER_DEBUG_ENABLED);
  }, [isBikeLoading]);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      audioEngine.init();

      if (e.target instanceof HTMLElement && e.target.closest('select, input, textarea')) return;
      if (e.target instanceof HTMLElement && e.target.closest('button') && e.code === 'Enter') return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (e.repeat) return;
        const nextRunning = !engineRunningRef.current;
        engineRunningRef.current = nextRunning;
        setEngineRunning(nextRunning);
        setEnginePrompt(false);
        if (enginePromptTimerRef.current !== null) window.clearTimeout(enginePromptTimerRef.current);
        audioEngine.setEngineRunning(nextRunning);
        physicsRef.current.setEngineRunning(nextRunning);
        if (!nextRunning) environmentRef.current?.clearExhaust();
        return;
      }
      const movementKey = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code);
      if (movementKey && !engineRunningRef.current) {
        setEnginePrompt(true);
        if (enginePromptTimerRef.current !== null) window.clearTimeout(enginePromptTimerRef.current);
        enginePromptTimerRef.current = window.setTimeout(() => setEnginePrompt(false), 1800);
        return;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputsRef.current.throttle = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputsRef.current.rearBrake = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputsRef.current.steerLeft = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputsRef.current.steerRight = true;

      if (e.code === 'KeyR') {
        handleRestart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputsRef.current.throttle = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputsRef.current.rearBrake = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputsRef.current.steerLeft = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputsRef.current.steerRight = false;
    };

    const releaseInputs = () => {
      inputsRef.current = { throttle: false, rearBrake: false, steerLeft: false, steerRight: false };
    };
    window.addEventListener('blur', releaseInputs);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      if (enginePromptTimerRef.current !== null) window.clearTimeout(enginePromptTimerRef.current);
      window.removeEventListener('blur', releaseInputs);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRestart]);

  // Pointer / Mouse Camera Look Handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerPosRef.current.x;
    const dy = e.clientY - lastPointerPosRef.current.y;
    lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

    // Drag horizontally rotates camera 360 around rider
    orbitYawRef.current -= dx * 0.006;
    // Drag vertically elevates/lowers camera pitch around rider
    orbitPitchRef.current = THREE.MathUtils.clamp(
      orbitPitchRef.current + dy * 0.005,
      -0.15,
      1.35
    );
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement)?.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  // Mouse wheel zoom camera distance
  const onWheel = useCallback((e: React.WheelEvent) => {
    cameraDistanceRef.current = THREE.MathUtils.clamp(
      cameraDistanceRef.current + e.deltaY * 0.005,
      2.5,
      14.0
    );
  }, []);

  // --- Main Three.js Scene Setup & Loop (Runs ONLY ONCE on mount) ---
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = height > 0 ? width / height : window.innerWidth / window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera (Default rear chase view looking forward in +Z)
    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2400);
    camera.position.set(0, 2.2, -4.8);
    camera.lookAt(0, 1.0, 4.0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    const preset = QUALITY_PRESETS[qualityRef.current];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
    renderer.shadowMap.enabled = preset.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    // Environment
    const environment = new EnvironmentManager(scene);
    environmentRef.current = environment;
    environment.setQuality(qualityRef.current);

    // Initial Bike Setup
    let disposed = false;
    const initialBikeId = selectedBikeIdRef.current;
    const initialConfig = getBikeConfig(initialBikeId);
    physicsRef.current.applyBikeTuning(initialConfig.physics);
    physicsRef.current.setEngineRunning(false);
    audioEngine.setSoundProfile(initialConfig.soundType);
    audioEngine.setEngineRunning(false);

    // Load initial bike model
    loadBikeModel(initialBikeId, progress => { if (!disposed) setLoadProgress(progress); })
      .then((parts) => {
        if (disposed) {
          parts.wheelRotationEffect?.dispose();
          parts.rider.dispose();
          return;
        }
        if (sceneRef.current) {
          if (bikePartsRef.current) {
            bikePartsRef.current.wheelRotationEffect?.dispose();
            bikePartsRef.current.rider.dispose();
            sceneRef.current.remove(bikePartsRef.current.bikeGroup);
          }
          sceneRef.current.add(parts.bikeGroup);
        }
        bikePartsRef.current = parts;
      })
      .catch((err) => {
        if (disposed) return;
        console.warn('Initial bike load fallback:', err);
        const fallback = createSupermotoBike();
        bikePartsRef.current = fallback;
        scene.add(fallback.bikeGroup);
        setBikeError('Failed to load bike model. Using fallback bike.');
      })
      .finally(() => {
        if (disposed) return;
        bikeLoadingRef.current = false;
        setIsBikeLoading(false);
      });

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || window.innerHeight;
      if (newH > 0) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    };

    window.addEventListener('resize', handleResize);

    // Loop variables
    let animationFrameId: number;
    let lastTime = performance.now();
    let hudUpdateTimer = 0;
    let fpsTime = 0;
    let fpsFrames = 0;

    // Animation Game Loop
    const animate = (time: number) => {
      const frameSeconds = (time - lastTime) / 1000;
      const delta = Math.min(0.1, frameSeconds);
      if (frameSeconds < 1 && !document.hidden) {
        fpsTime += frameSeconds;
        fpsFrames++;
        if (fpsTime >= 0.5) {
          setFps(Math.round(fpsFrames / fpsTime));
          fpsTime = 0;
          fpsFrames = 0;
        }
      } else {
        fpsTime = 0;
        fpsFrames = 0;
        setFps(0);
      }
      lastTime = time;

      const physics = physicsRef.current;
      const inputs = inputsRef.current;

      // Update Physics Engine
      const state = physics.update(delta, inputs);

      const completedWheelieDistance = wheelieHistoryTrackerRef.current.update(state, engineRunningRef.current);
      if (completedWheelieDistance !== null) {
        setWheelieHistory(current => [{ timestamp: Date.now(), distance: completedWheelieDistance }, ...current]);
        setBestWheelie(current => Math.max(current, completedWheelieDistance));
      }

      // Throttle HUD state updates to ~20 FPS (every 0.05s)
      hudUpdateTimer += delta;
      if (hudUpdateTimer >= 0.05) {
        hudUpdateTimer = 0;
        setPhysicsState(state);
      }

      // --- Update Audio ---
      if (engineRunningRef.current) {
        audioEngine.updateEngine(state.rpmRatio, inputs.throttle);
      }

      const currentBikeParts = bikePartsRef.current;
      currentBikeParts?.wheelRotationEffect?.update(delta, state.speed, state.pitch <= 0, state.isCrashed);

      if (state.isScrapingFender) {
        audioEngine.setScrapeVolume(0.35);
        if (currentBikeParts) {
          const worldPos = new THREE.Vector3();
          currentBikeParts.sparksEmitter.getWorldPosition(worldPos);
          environment.emitSparks(worldPos, 6);
        }
      } else {
        audioEngine.setScrapeVolume(0);
      }

      // Tire contact follows the same continuous surface as the rendered terrain.
      const rearZ = state.positionZ - 0.85;
      const rearHeight = terrainHeight(state.positionX, rearZ);
      const frontHeight = terrainHeight(state.positionX, state.positionZ + 0.85);
      const terrainPitch = Math.atan2(frontHeight - rearHeight, 1.7);
      const groundHeight = rearHeight + 0.85 * Math.sin(terrainPitch);
      // Measure the visible wheel-axle line after terrain tilt is applied.
      // This keeps the HUD aligned with the actual bike orientation on slopes.
      // Keep the grounded state at 0°, while including the terrain tilt once
      // the front wheel is genuinely lifted and the visible axle line rotates.
      const measuredPitchDeg = THREE.MathUtils.radToDeg(
        state.pitch + (state.pitch > 0.05 ? terrainPitch : 0)
      );
      if (hudUpdateTimer === 0) setMeasuredPitchDeg(measuredPitchDeg);
      if (state.isCrashed && physics.crashTime < 0.1) {
        audioEngine.playCrashSound();
      }

      // --- Update 3D Bike Mesh Position & Rotations ---
      if (currentBikeParts) {
        // Keep rear contact patch on ground during wheelie
        const rearWheelOffset = 0.85 * Math.sin(state.pitch + terrainPitch);

        if (!state.isCrashed) {
          currentBikeParts.bikeGroup.position.set(state.positionX, rearHeight + rearWheelOffset, state.positionZ);
          // In Three.js: -pitch lifts front (+Z) up around rear axle (-Z)!
          currentBikeParts.bodyGroup.rotation.x = -state.pitch - terrainPitch;
          currentBikeParts.bodyGroup.rotation.z = state.roll;

          const wheelRotationSpeed = state.speed * delta * 2.4;
          currentBikeParts.frontWheel.rotation.x += wheelRotationSpeed;
          currentBikeParts.rearWheel.rotation.x += wheelRotationSpeed;

          // Rider inherits bodyGroup's pose, so hands/feet remain on their anchors.
        } else {
          currentBikeParts.bikeGroup.position.set(state.positionX, rearHeight + rearWheelOffset, state.positionZ);
          currentBikeParts.bodyGroup.rotation.x = physics.bikeCrashRotation.x;
        }
      }

      // Emit after applying this frame's transforms, so effects stay attached to the bike.
      if (currentBikeParts && !state.isCrashed) {
        const config = getBikeConfig(selectedBikeIdRef.current);
        const exhaustPos = new THREE.Vector3();
        currentBikeParts.exhaustEmitter.getWorldPosition(exhaustPos);
        if (engineRunningRef.current) {
          environment.emitExhaust(exhaustPos, state.rpmRatio, inputs.throttle, config.engineCategory === '2-Stroke', delta);
        }
        environment.emitRidingDust(new THREE.Vector3(state.positionX, rearHeight + 0.045, rearZ), state.speed, inputs.throttle, delta);
      }
      // --- Update Dynamic Camera with Mouse Orbit & Centered Target ---
      const targetX = state.positionX;
      const targetY = groundHeight + 1.1 + state.pitch * 0.4;
      const targetZ = state.positionZ;

      if (!state.isCrashed) {
        const currentYaw = orbitYawRef.current;
        const currentPitch = orbitPitchRef.current;
        const dist = cameraDistanceRef.current + state.pitch * 0.3;

        // Spherical orbit around character target
        const cosPitch = Math.cos(currentPitch);
        const sinPitch = Math.sin(currentPitch);
        const sinYaw = Math.sin(currentYaw);
        const cosYaw = Math.cos(currentYaw);

        const offsetX = sinYaw * cosPitch * dist;
        const offsetY = sinPitch * dist;
        const offsetZ = -cosYaw * cosPitch * dist;

        const targetCamX = targetX + offsetX;
        const targetCamY = Math.max(terrainHeight(targetCamX, targetZ + offsetZ) + 0.4, targetY + offsetY);
        const targetCamZ = targetZ + offsetZ;

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, 12 * delta);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 12 * delta);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 12 * delta);

        // Character remains strictly centered in viewport frame
        camera.lookAt(targetX, targetY, targetZ);
      } else {
        camera.lookAt(targetX, groundHeight + 0.5, targetZ);
      }

      // --- Update Terrain Environment ---
      environment.update(state.positionZ, delta, state.positionX);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      environment.dispose();
      bikePartsRef.current?.wheelRotationEffect?.dispose();
      bikePartsRef.current?.rider.dispose();
      bikePartsRef.current = null;
      sceneRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);



  return (
    <div
      className="game-screen-wrapper"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{ touchAction: 'none', cursor: 'grab' }}
    >
      <div ref={containerRef} className="three-canvas-container" />
      <HUD
        physicsState={physicsState}
        measuredPitchDeg={measuredPitchDeg}
        fps={fps}
        engineRunning={engineRunning}
        enginePrompt={enginePrompt}
        quality={quality}
        onQualityChange={changeQuality}
        selectedBikeId={selectedBikeId}
        onBikeChange={switchBike}
        isBikeLoading={isBikeLoading}
        loadProgress={loadProgress}
        bikeError={bikeError}
        onRestart={handleRestart}
        wheelieHistory={wheelieHistory}
        bestWheelie={bestWheelie}
        selectedHelmetId={selectedHelmetId}
        onHelmetChange={setSelectedHelmetId}
        helmetLoading={helmetLoading}
        helmetError={helmetError}
      />
    </div>
  );
};
