import * as THREE from 'three';

export const CRASH_TIP_DURATION = 0.14;
export const CRASH_LAND_TIME = 0.92;
const CRASH_TIP_ANGLE = THREE.MathUtils.degToRad(7);
const CRASH_FALL_DRAG = 1.5;
const CRASH_SLIDE_FRICTION = 8.5;

export interface PhysicsState {
  speed: number; // m/s
  speedKmh: number; // km/h
  rpmRatio: number; // 0.0 - 1.0
  pitch: number; // radians (0 = level, Math.PI/2 = vertical standing)
  pitchDeg: number; // degrees
  pitchVelocity: number; // rad/s
  roll: number; // radians (left/right tilt)
  rollVelocity: number;
  steering: number; // steering angle
  positionZ: number; // forward distance (meters)
  positionX: number; // lateral position (meters)
  wheelieDistance: number; // Distance in the current wheelie; zero on front tire contact.
  isWheelieActive: boolean;
  isSweetSpot: boolean;
  isScrapingFender: boolean;
  isCrashed: boolean;
  crashReason: string;
}

export class PhysicsEngine {
  // State variables
  public speed: number = 0; // m/s
  public pitch: number = 0; // radians
  public pitchVelocity: number = 0;
  public roll: number = 0;
  public rollVelocity: number = 0;
  public steering: number = 0;
  public positionZ: number = 0;
  public positionX: number = 0;
  public wheelieDistance: number = 0;
  private engineRunning = true;

  // Crash State
  public isCrashed: boolean = false;
  public crashReason: string = '';
  public crashTime: number = 0;
  public bikeCrashRotation: THREE.Vector3 = new THREE.Vector3();
  public crashSide: -1 | 1 = 1;
  public crashGrounded = false;
  private crashStartPitch = 0;
  private crashStartRoll = 0;
  private crashLateralRatio = 0;
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  // Dynamic Physics Parameters (Tuned per selected bike)
  public maxSpeed: number = 25.5; // ~92 km/h (< 100 km/h)
  public accelerationPower: number = 8.5; // m/s^2 (moderate, realistic acceleration)
  public brakePower: number = 22.0; // m/s^2
  public dragCoeff: number = 0.35;

  // Wheelie Constants
  public balanceAngle: number = 0.98; // ~56 degrees (Sweet Spot balance point)
  public scrapeAngle: number = 1.36; // ~78 degrees (Fender scrapes road)
  public crashAngle: number = Math.PI / 2; // 90 degrees (Loop out overturn!)

  public throttlePitchTorque: number = 4.0;
  public leanPitchTorque: number = 3.0;
  public brakePitchTorque: number = 7.5; // Rear brake slams front wheel down
  public gravityDamping: number = 3.2;

  public applyBikeTuning(tuning: {
    maxSpeed: number;
    accelerationPower: number;
    brakePower: number;
    throttlePitchTorque: number;
    leanPitchTorque: number;
    brakePitchTorque: number;
    balanceAngle: number;
    scrapeAngle: number;
    crashAngle: number;
  }) {
    this.maxSpeed = tuning.maxSpeed;
    this.accelerationPower = tuning.accelerationPower;
    this.brakePower = tuning.brakePower;
    this.throttlePitchTorque = tuning.throttlePitchTorque;
    this.leanPitchTorque = tuning.leanPitchTorque;
    this.brakePitchTorque = tuning.brakePitchTorque;
    this.balanceAngle = tuning.balanceAngle;
    this.scrapeAngle = tuning.scrapeAngle;
    this.crashAngle = tuning.crashAngle;
  }

  public reset() {
    this.speed = 0;
    this.pitch = 0;
    this.pitchVelocity = 0;
    this.roll = 0;
    this.rollVelocity = 0;
    this.steering = 0;
    this.positionZ = 0;
    this.positionX = 0;
    this.wheelieDistance = 0;
    this.isCrashed = false;
    this.crashReason = '';
    this.crashTime = 0;
    this.bikeCrashRotation.set(0, 0, 0);
    this.crashSide = 1;
    this.crashGrounded = false;
    this.crashStartPitch = this.crashStartRoll = this.crashLateralRatio = 0;
  }

  public setEngineRunning(running: boolean) {
    this.engineRunning = running;
    if (!running && !this.isCrashed) {
      this.speed = 0;
      this.pitch = 0;
      this.pitchVelocity = 0;
      this.wheelieDistance = 0;
    }
  }

  public update(
    delta: number,
    inputs: {
      throttle: boolean;
      rearBrake: boolean;
      steerLeft: boolean;
      steerRight: boolean;
    }
  ): PhysicsState {
    if (this.isCrashed) {
      this.wheelieDistance = 0;
      this.updateCrash(delta);
      return this.getState();
    }

    if (!this.engineRunning) {
      this.speed = 0;
      this.pitch = 0;
      this.pitchVelocity = 0;
      this.wheelieDistance = 0;
      this.steering = THREE.MathUtils.lerp(this.steering, 0, 8 * delta);
      this.roll = THREE.MathUtils.lerp(this.roll, 0, 6 * delta);
      return this.getState();
    }

    const previousX = this.positionX;
    const previousZ = this.positionZ;
    // --- 1. Forward Speed Dynamics ---
    let accel = 0;
    if (inputs.throttle) {
      accel += this.accelerationPower;
    }
    if (inputs.rearBrake) {
      accel -= this.brakePower;
    }

    // Air Drag & Rolling Friction
    const drag = this.dragCoeff * (this.speed * 0.12) * (this.speed * 0.12) + 0.6;
    accel -= drag;

    this.speed = Math.max(0, Math.min(this.maxSpeed, this.speed + accel * delta));
    this.positionZ += this.speed * delta;

    // --- 2. Steering & Roll Dynamics (Free Steppe Movement) ---
    let steerInput = 0;
    if (inputs.steerLeft) steerInput += 1;
    if (inputs.steerRight) steerInput -= 1;

    // Reduced steering effectiveness when front wheel is high in the air
    const wheelieSteerFactor = Math.max(0.2, 1.0 - (this.pitch / (Math.PI / 2)) * 0.8);
    this.steering = THREE.MathUtils.lerp(this.steering, steerInput * wheelieSteerFactor, 8 * delta);
    this.positionX += this.steering * (this.speed * 0.18) * delta;
    // Open steppe terrain map - not constrained to narrow lanes
    this.positionX = THREE.MathUtils.clamp(this.positionX, -200, 200);

    // Roll tilt during steering (natural motorcycle lean into turn)
    const targetRoll = -this.steering * 0.28;
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, 6 * delta);

    // --- 3. Wheelie Pitch Physics (Requires acceleration to maintain pitch angle, > 90° loops out) ---
    let pitchTorque = 0;

    // A. Throttle Acceleration creates rotational pitch torque
    if (inputs.throttle) {
      // Once reaching ~20 km/h, the front wheel begins to lift off the ground
      const currentKmh = this.speed * 3.6;
      // Below 14 km/h: front wheel grips the ground to accelerate
      // At ~20 km/h: lift force exceeds gravity damping (3.2), front wheel starts lifting
      const liftRatio = THREE.MathUtils.clamp((currentKmh - 14) / 7.5, 0, 1.0);
      pitchTorque += this.throttlePitchTorque * (0.2 + 0.95 * liftRatio);
    }

    // B. Lean Back adds extra lifting torque
    // C. Rear Brake slams pitch down
    if (inputs.rearBrake && this.pitch > 0) {
      pitchTorque -= this.brakePitchTorque;
    }

    // D. Gravity Torque & Balance Equilibrium
    if (this.pitch < this.balanceAngle) {
      // Below balance angle: Gravity pulls front wheel down without sufficient throttle
      const gravityPull = Math.cos(this.pitch) * this.gravityDamping;
      pitchTorque -= gravityPull;
    } else {
      // ABOVE balance angle: Bike leans back far enough that gravity pulls it further back
      const overturnRatio = (this.pitch - this.balanceAngle) / (this.crashAngle - this.balanceAngle);
      const overturnForce = overturnRatio * 4.5;
      pitchTorque += overturnForce;
    }

    // E. Fender Scrape Resistance (Fender scraping road adds slight braking torque before 90°)
    if (this.pitch >= this.scrapeAngle && this.pitch < this.crashAngle) {
      pitchTorque -= 3.5;
    }

    // Update Pitch Velocity & Angle
    this.pitchVelocity += pitchTorque * delta;
    this.pitchVelocity *= Math.pow(0.08, delta); // Damping
    this.pitch += this.pitchVelocity * delta;

    // Front wheel touches down
    if (this.pitch < 0) {
      this.pitch = 0;
      this.pitchVelocity = 0;
    }

    // --- 4. Crash Detection (> 90 degrees loops out) ---
    if (this.pitch >= this.crashAngle) {
      this.pitch = this.crashAngle;
      const forwardTravel = this.positionZ - previousZ;
      const lateralRatio = forwardTravel > 0 ? (this.positionX - previousX) / forwardTravel : 0;
      this.triggerCrash('Looped Out Backwards! (Pitch angle exceeded 90°)', lateralRatio);
    }

    this.wheelieDistance = this.pitch > 0 && !this.isCrashed
      ? this.wheelieDistance + Math.hypot(this.positionX - previousX, this.positionZ - previousZ)
      : 0;
    return this.getState();
  }

  private triggerCrash(reason: string, lateralRatio: number) {
    this.isCrashed = true;
    this.crashReason = reason;
    this.crashTime = 0;
    this.crashSide = this.random() < 0.5 ? -1 : 1;
    this.crashGrounded = false;
    this.crashStartPitch = this.pitch;
    this.crashStartRoll = this.roll;
    this.crashLateralRatio = lateralRatio;
    this.pitchVelocity = this.rollVelocity = 0;
    // Start at the actual wheelie pose, never at an unrelated zero rotation.
    this.bikeCrashRotation.set(-this.pitch, 0, this.roll);
  }

  private updateCrash(delta: number) {
    const dt = Math.max(0, delta);
    // Split at impact, then integrate friction exactly, including the stop time.
    // This preserves the incoming heading and gives the same slide at any FPS.
    const fallingTime = Math.min(dt, Math.max(0, CRASH_LAND_TIME - this.crashTime));
    const advance = (duration: number, deceleration: number) => {
      const movingTime = Math.min(duration, this.speed / deceleration);
      const distance = this.speed * movingTime - 0.5 * deceleration * movingTime ** 2;
      this.positionZ += distance;
      this.positionX = THREE.MathUtils.clamp(this.positionX + distance * this.crashLateralRatio, -200, 200);
      this.speed = Math.max(0, this.speed - deceleration * duration);
    };
    advance(fallingTime, CRASH_FALL_DRAG);
    advance(dt - fallingTime, CRASH_SLIDE_FRICTION);
    this.crashTime += dt;

    const previousPitch = this.pitch, previousRoll = this.roll;
    const peakPitch = this.crashStartPitch + CRASH_TIP_ANGLE;
    if (this.crashTime <= CRASH_TIP_DURATION) {
      this.pitch = THREE.MathUtils.lerp(this.crashStartPitch, peakPitch,
        THREE.MathUtils.smoothstep(this.crashTime, 0, CRASH_TIP_DURATION));
    } else {
      this.pitch = THREE.MathUtils.lerp(peakPitch, 0,
        THREE.MathUtils.smoothstep(this.crashTime, CRASH_TIP_DURATION, CRASH_LAND_TIME));
    }
    this.roll = THREE.MathUtils.lerp(this.crashStartRoll, this.crashSide * Math.PI / 2,
      THREE.MathUtils.smoothstep(this.crashTime, 0.07, CRASH_LAND_TIME));
    this.crashGrounded = this.crashTime >= CRASH_LAND_TIME;
    this.pitchVelocity = dt > 0 && !this.crashGrounded ? (this.pitch - previousPitch) / dt : 0;
    this.rollVelocity = dt > 0 && !this.crashGrounded ? (this.roll - previousRoll) / dt : 0;
    // Bounded pose, held exactly after side impact. No free angular integration.
    this.bikeCrashRotation.set(-this.pitch, 0, this.roll);
  }

  public getState(): PhysicsState {
    const pitchDeg = (this.pitch * 180) / Math.PI;
    const isWheelieActive = this.pitch > 0.25 && !this.isCrashed; // > ~14 degrees
    const isSweetSpot = pitchDeg >= 45 && pitchDeg <= 75 && !this.isCrashed;
    const isScrapingFender = pitchDeg >= 76 && !this.isCrashed;
    const speedKmh = Math.round(this.speed * 3.6);
    const rpmRatio = Math.min(1.0, 0.15 + (speedKmh / 100) * 0.85);

    return {
      speed: this.speed,
      speedKmh,
      rpmRatio,
      pitch: this.pitch,
      pitchDeg,
      pitchVelocity: this.pitchVelocity,
      roll: this.roll,
      rollVelocity: this.rollVelocity,
      steering: this.steering,
      positionZ: this.positionZ,
      positionX: this.positionX,
      wheelieDistance: this.wheelieDistance,
      isWheelieActive,
      isSweetSpot,
      isScrapingFender,
      isCrashed: this.isCrashed,
      crashReason: this.crashReason,
    };
  }
}
