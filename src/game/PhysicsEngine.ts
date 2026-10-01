import * as THREE from 'three';

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
  }

  public setEngineRunning(running: boolean) {
    this.engineRunning = running;
    if (!running) {
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
      this.crashTime += delta;
      // Animate crash physics: bike rolls over and slides forward
      this.speed = Math.max(0, this.speed - 12 * delta);
      this.positionZ += this.speed * delta;
      this.bikeCrashRotation.x -= 6 * delta; // Overturning loop out

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
      this.triggerCrash('Looped Out Backwards! (Pitch angle exceeded 90°)');
    }

    this.wheelieDistance = this.pitch > 0 && !this.isCrashed
      ? this.wheelieDistance + Math.hypot(this.positionX - previousX, this.positionZ - previousZ)
      : 0;
    return this.getState();
  }

  private triggerCrash(reason: string) {
    this.isCrashed = true;
    this.crashReason = reason;
    this.crashTime = 0;
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
