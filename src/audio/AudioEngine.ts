// Web Audio API Procedural Sound Engine for Supermoto Wheelie Game

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private engineRunning: boolean = false;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private idleSubOsc: OscillatorNode | null = null;

  // Scrape / Spark sound nodes
  private scrapeGain: GainNode | null = null;
  private scrapeFilter: BiquadFilterNode | null = null;


  // Engine sound profile
  private soundProfile: '4stroke_deep' | '2stroke_heavy' | '2stroke_screamer' = '4stroke_deep';

  public setSoundProfile(profile: '4stroke_deep' | '2stroke_heavy' | '2stroke_screamer') {
    this.soundProfile = profile;
    if (this.ctx && this.engineOsc && this.idleSubOsc) {
      const now = this.ctx.currentTime;
      let baseFreq = 45;
      if (profile === '2stroke_heavy') baseFreq = 58;
      if (profile === '2stroke_screamer') baseFreq = 72;
      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.idleSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    }
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Main Engine Sound setup (Sawtooth wave filtered to sound like a single-cylinder 450cc 4-stroke supermoto)
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      let baseFreq = 45;
      if (this.soundProfile === '2stroke_heavy') baseFreq = 58;
      if (this.soundProfile === '2stroke_screamer') baseFreq = 72;
      this.engineOsc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime); // ~1500 RPM idle

      // Sub harmonic for thumping bass
      this.idleSubOsc = this.ctx.createOscillator();
      this.idleSubOsc.type = 'square';
      this.idleSubOsc.frequency.setValueAtTime(baseFreq * 0.5, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.engineFilter.Q.setValueAtTime(3, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.15, this.ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.idleSubOsc.connect(subGain);
      subGain.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.idleSubOsc.start();

      // Scrape Fender Noise
      this.setupScrapeSound();

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext failed to initialize:', e);
    }
  }

  private setupScrapeSound() {
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.scrapeFilter = this.ctx.createBiquadFilter();
    this.scrapeFilter.type = 'bandpass';
    this.scrapeFilter.frequency.setValueAtTime(3200, this.ctx.currentTime);
    this.scrapeFilter.Q.setValueAtTime(4, this.ctx.currentTime);

    this.scrapeGain = this.ctx.createGain();
    this.scrapeGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.scrapeFilter);
    this.scrapeFilter.connect(this.scrapeGain);
    this.scrapeGain.connect(this.ctx.destination);
    whiteNoise.start();
  }

  public updateEngine(rpmRatio: number, isAccelerating: boolean) {
    if (!this.isInitialized || !this.ctx || this.isMuted || !this.engineRunning) return;

    const now = this.ctx.currentTime;
    const targetFreq = 45 + rpmRatio * 195;
    const filterCutoff = 350 + rpmRatio * 2200;

    if (this.engineOsc) {
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);
    }
    if (this.idleSubOsc) {
      this.idleSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.05);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.05);
    }
    if (this.engineGain) {
      const gainVal = isAccelerating ? 0.35 : 0.18 + rpmRatio * 0.12;
      this.engineGain.gain.setTargetAtTime(gainVal, now, 0.08);
    }
  }

  public setScrapeVolume(volume: number) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (this.scrapeGain) {
      this.scrapeGain.gain.setTargetAtTime(Math.min(0.4, Math.max(0, volume)), this.ctx.currentTime, 0.05);
    }
  }

  public playCrashSound() {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.5);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {
      console.warn('Crash sound error:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.engineGain.gain.setValueAtTime(!this.isMuted && this.engineRunning ? 0.2 : 0, this.ctx.currentTime);
      this.scrapeGain?.gain.cancelScheduledValues(this.ctx.currentTime);
      this.scrapeGain?.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public setEngineRunning(running: boolean) {
    this.engineRunning = running;
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.setTargetAtTime(running && !this.isMuted ? 0.2 : 0, now, 0.035);
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const audioEngine = new AudioEngine();
