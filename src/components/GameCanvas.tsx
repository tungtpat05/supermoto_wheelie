import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createSupermotoBike, type SupermotoParts } from '../game/SupermotoMesh';
import { EnvironmentManager } from '../game/EnvironmentManager';
import { terrainHeight } from '../game/SteppeTerrain';
import { PhysicsEngine, type PhysicsState } from '../game/PhysicsEngine';
import { audioEngine } from '../audio/AudioEngine';
import { HUD } from './HUD';
import { GarageModal } from './GarageModal';
import { DEFAULT_BIKE_ID, getBikeConfig } from '../game/BikeConfigs';
import { loadBikeModel } from '../game/BikeLoader';

const BEST_SCORE_KEY = 'supermoto_wheelie_best_score';
const BEST_DIST_KEY = 'supermoto_wheelie_best_dist';
const SELECTED_BIKE_KEY = 'supermoto_wheelie_selected_bike';

export const GameCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Game Engine Objects
  const physicsRef = useRef<PhysicsEngine>(new PhysicsEngine());
  const environmentRef = useRef<EnvironmentManager | null>(null);
  const bikePartsRef = useRef<SupermotoParts | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const initialRiderPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.88, -0.15));

  // Mouse Orbit Look Camera State
  const isDraggingRef = useRef<boolean>(false);
  const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitYawRef = useRef<number>(0);
  const orbitPitchRef = useRef<number>(0.25);
  const cameraDistanceRef = useRef<number>(4.8);

  const [selectedBikeId, setSelectedBikeId] = useState<string>(() => {
    return localStorage.getItem(SELECTED_BIKE_KEY) || DEFAULT_BIKE_ID;
  });
  const selectedBikeIdRef = useRef<string>(selectedBikeId);
  const [isGarageOpen, setIsGarageOpen] = useState<boolean>(false);
  const [isBikeLoading, setIsBikeLoading] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<number>(0);

  // Keyboard Inputs State
  const inputsRef = useRef({
    throttle: false,
    rearBrake: false,
    leanBack: false,
    steerLeft: false,
    steerRight: false,
  });

  // Gameplay Scoring State
  const [score, setScore] = useState<number>(0);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [bestScore, setBestScore] = useState<number>(0);
  const [bestDistance, setBestDistance] = useState<number>(0);
  const [physicsState, setPhysicsState] = useState<PhysicsState>(() => physicsRef.current.getState());

  const checkHighScoresRef = useRef<(s: number, d: number) => void>(() => { });

  // Load High Scores from Local Storage
  useEffect(() => {
    const savedScore = localStorage.getItem(BEST_SCORE_KEY);
    const savedDist = localStorage.getItem(BEST_DIST_KEY);
    if (savedScore) setBestScore(parseFloat(savedScore));
    if (savedDist) setBestDistance(parseInt(savedDist, 10));
  }, []);

  // Update & Save High Score
  const checkNewHighScores = useCallback((finalScore: number, finalDist: number) => {
    setBestScore((prevBest) => {
      if (finalScore > prevBest) {
        localStorage.setItem(BEST_SCORE_KEY, finalScore.toString());
        return finalScore;
      }
      return prevBest;
    });

    setBestDistance((prevDist) => {
      if (finalDist > prevDist) {
        localStorage.setItem(BEST_DIST_KEY, finalDist.toString());
        return finalDist;
      }
      return prevDist;
    });
  }, []);

  useEffect(() => {
    checkHighScoresRef.current = checkNewHighScores;
  }, [checkNewHighScores]);

  // Restart Handler (Fixed: reset physics, environment terrain segments, rider and bike transforms)
  const handleRestart = useCallback(() => {
    physicsRef.current.reset();
    environmentRef.current?.reset();
    orbitYawRef.current = 0;
    orbitPitchRef.current = 0.25;
    cameraDistanceRef.current = 4.8;
    isDraggingRef.current = false;

    if (bikePartsRef.current) {
      bikePartsRef.current.bikeGroup.position.set(0, 0, 0);
      bikePartsRef.current.bodyGroup.rotation.set(0, 0, 0);
      bikePartsRef.current.riderGroup.position.copy(initialRiderPosRef.current);
      bikePartsRef.current.riderGroup.rotation.set(0, 0, 0);
    }

    setScore(0);
    setMultiplier(1);
    setPhysicsState(physicsRef.current.getState());
  }, []);

  // Switch Bike Model Handler
  const switchBike = useCallback(async (bikeId: string) => {
    const config = getBikeConfig(bikeId);
    setIsBikeLoading(true);
    setLoadProgress(15);

    try {
      const newParts = await loadBikeModel(bikeId, (progress) => {
        setLoadProgress(Math.max(15, progress));
      });

      if (newParts.riderGroup) {
        initialRiderPosRef.current.copy(newParts.riderGroup.position);
      }

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
      setIsGarageOpen(false);
    } catch (err) {
      console.error('Failed to switch bike:', err);
    } finally {
      setIsBikeLoading(false);
    }
  }, []);

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      audioEngine.init();

      if (e.code === 'KeyG') {
        setIsGarageOpen((prev) => !prev);
        inputsRef.current.throttle = false;
        inputsRef.current.leanBack = false;
        return;
      }

      if (isGarageOpen) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputsRef.current.throttle = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputsRef.current.rearBrake = true;
      if (e.code === 'Space' || e.shiftKey) inputsRef.current.leanBack = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputsRef.current.steerLeft = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputsRef.current.steerRight = true;

      if (e.code === 'KeyR') {
        handleRestart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') inputsRef.current.throttle = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') inputsRef.current.rearBrake = false;
      if (e.code === 'Space' || !e.shiftKey) inputsRef.current.leanBack = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputsRef.current.steerLeft = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') inputsRef.current.steerRight = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleRestart, isGarageOpen]);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.appendChild(renderer.domElement);

    // Environment
    const environment = new EnvironmentManager(scene);
    environmentRef.current = environment;

    // Initial Bike Setup
    const initialBikeId = localStorage.getItem(SELECTED_BIKE_KEY) || DEFAULT_BIKE_ID;
    const initialConfig = getBikeConfig(initialBikeId);
    physicsRef.current.applyBikeTuning(initialConfig.physics);
    audioEngine.setSoundProfile(initialConfig.soundType);

    // Load initial bike model
    loadBikeModel(initialBikeId)
      .then((parts) => {
        if (parts.riderGroup) {
          initialRiderPosRef.current.copy(parts.riderGroup.position);
        }
        if (sceneRef.current) {
          if (bikePartsRef.current) {
            sceneRef.current.remove(bikePartsRef.current.bikeGroup);
          }
          sceneRef.current.add(parts.bikeGroup);
        }
        bikePartsRef.current = parts;
      })
      .catch((err) => {
        console.warn('Initial bike load fallback:', err);
        const fallback = createSupermotoBike();
        if (fallback.riderGroup) {
          initialRiderPosRef.current.copy(fallback.riderGroup.position);
        }
        bikePartsRef.current = fallback;
        scene.add(fallback.bikeGroup);
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
    let currentScore = 0;
    let currentMult = 1;
    let sweetSpotTimer = 0;

    // Animation Game Loop
    const animate = (time: number) => {
      const delta = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const physics = physicsRef.current;
      const inputs = inputsRef.current;

      // Update Physics Engine
      const state = physics.update(delta, inputs);

      // Throttle HUD state updates to ~20 FPS (every 0.05s)
      hudUpdateTimer += delta;
      if (hudUpdateTimer >= 0.05) {
        hudUpdateTimer = 0;
        setPhysicsState(state);
      }

      // --- Update Audio ---
      audioEngine.updateEngine(state.rpmRatio, inputs.throttle);

      const currentBikeParts = bikePartsRef.current;

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

          // Stickman rider leans slightly into handlebar
          currentBikeParts.riderGroup.position.copy(initialRiderPosRef.current);
          currentBikeParts.riderGroup.rotation.x = state.pitch * 0.35;
        } else {
          currentBikeParts.bikeGroup.position.set(state.positionX, rearHeight + rearWheelOffset, state.positionZ);
          currentBikeParts.bodyGroup.rotation.x = physics.bikeCrashRotation.x;
          // Restore from initial position plus non-accumulating crash offset
          currentBikeParts.riderGroup.position
            .copy(initialRiderPosRef.current)
            .add(physics.riderCrashOffset);
        }
      }

      // Emit after applying this frame's transforms, so effects stay attached to the bike.
      if (currentBikeParts && !state.isCrashed) {
        const config = getBikeConfig(selectedBikeIdRef.current);
        const exhaustPos = new THREE.Vector3();
        currentBikeParts.exhaustEmitter.getWorldPosition(exhaustPos);
        environment.emitExhaust(exhaustPos, state.rpmRatio, inputs.throttle, config.engineCategory === '2-Stroke', delta);
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

      // --- Scoring System Logic ---
      if (state.isWheelieActive && !state.isCrashed) {
        if (state.isSweetSpot) {
          sweetSpotTimer += delta;
          if (sweetSpotTimer > 1.2) currentMult = 2;
          if (sweetSpotTimer > 3.0) currentMult = 4;
          if (sweetSpotTimer > 5.5) currentMult = 8;
          if (sweetSpotTimer > 9.0) currentMult = 10;
        } else {
          sweetSpotTimer = Math.max(0, sweetSpotTimer - delta * 2);
          currentMult = 1;
        }

        const pointGain = state.speed * state.pitch * currentMult * delta * 45;
        currentScore += pointGain;

        setScore(Math.floor(currentScore));
        setMultiplier(currentMult);
      } else if (state.isCrashed) {
        checkHighScoresRef.current(currentScore, Math.floor(state.positionZ));
      } else {
        sweetSpotTimer = 0;
        currentMult = 1;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      environment.dispose();
      renderer.dispose();
    };
  }, []);

  const currentConfig = getBikeConfig(selectedBikeId);

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
        score={score}
        multiplier={multiplier}
        bestScore={bestScore}
        bestDistance={bestDistance}
        currentBikeName={currentConfig.name}
        currentBikeColor={currentConfig.color}
        onRestart={handleRestart}
        onOpenGarage={() => setIsGarageOpen(true)}
      />
      {isGarageOpen && (
        <GarageModal
          currentBikeId={selectedBikeId}
          onSelectBike={switchBike}
          onClose={() => setIsGarageOpen(false)}
          isLoading={isBikeLoading}
          loadProgress={loadProgress}
        />
      )}
    </div>
  );
};
