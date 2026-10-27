// Synthesised sound: no audio files, everything shaped from noise and oscillators.

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicNodes: AudioScheduledSourceNode[] = [];
  private musicTimer = 0;
  private lastClick = 0;
  sfxVolume = 0.9;
  musicVolume = 0.35;

  /** Must run inside a user gesture (iOS). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(this.master);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxVolume;
      this.sfx.connect(comp);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.musicVolume;
      this.music.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    if (this.sfx) this.sfx.gain.value = sfx;
    if (this.music) this.music.gain.value = music;
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  private get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  private burst(freq: number, q: number, gain: number, decay: number, type: BiquadFilterType = 'bandpass', when = 0) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.sfx!);
    src.start(t, Math.random() * 0.5, decay + 0.05);
  }

  private tone(freq: number, gain: number, decay: number, type: OscillatorType = 'sine', when = 0, slide = 1) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.sfx!);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  /** Phenolic ball-on-ball click: bright, very short, pitch rises with impact speed. */
  ballHit(speed: number) {
    if (!this.ready) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastClick < 0.012) return;
    this.lastClick = now;
    const v = Math.min(1, speed / 5);
    const gain = 0.08 + v * 0.9;
    this.burst(3400 + v * 2200, 4, gain, 0.035 + v * 0.03);
    this.tone(2600 + v * 1500, gain * 0.35, 0.05, 'sine');
  }

  private lastCushion = 0;

  cushion(speed: number) {
    if (!this.ready || speed < 0.15) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastCushion < 0.02) return;
    this.lastCushion = now;
    const v = Math.min(1, speed / 4);
    this.burst(260 + v * 200, 1.2, 0.12 + v * 0.5, 0.12, 'lowpass');
    this.tone(120 + v * 40, 0.1 + v * 0.25, 0.1, 'sine', 0, 0.7);
  }

  /** Drop into the pocket: lip rattle, then a soft thud as it lands in the leather. */
  pocket(speed: number) {
    if (!this.ready) return;
    const v = Math.min(1, speed / 3);
    this.burst(1800, 3, 0.25 + v * 0.3, 0.05);
    this.burst(900, 2, 0.2, 0.06, 'bandpass', 0.05);
    this.burst(220, 1, 0.5, 0.18, 'lowpass', 0.12);
    this.tone(95, 0.35, 0.18, 'sine', 0.12, 0.6);
  }

  /** Leather tip on the cue ball. */
  cueStrike(power: number) {
    if (!this.ready) return;
    this.burst(1400 + power * 900, 1.5, 0.25 + power * 0.6, 0.05);
    this.tone(700 + power * 300, 0.12 + power * 0.2, 0.04, 'triangle');
  }

  miscue() {
    if (!this.ready) return;
    this.burst(2500, 6, 0.5, 0.04);
    this.tone(420, 0.25, 0.12, 'square', 0, 0.5);
  }

  tap() {
    if (!this.ready) return;
    this.tone(880, 0.07, 0.05, 'triangle');
  }

  tick(level: number) {
    if (!this.ready) return;
    this.tone(500 + level * 700, 0.035, 0.03, 'square');
  }

  explode() {
    if (!this.ready) return;
    this.burst(180, 0.8, 1.2, 0.6, 'lowpass');
    this.burst(1200, 1, 0.5, 0.25);
    this.tone(60, 0.8, 0.5, 'sine', 0, 0.4);
  }

  skill() {
    if (!this.ready) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 0.25, 'triangle', i * 0.05));
  }

  foul() {
    if (!this.ready) return;
    this.tone(220, 0.18, 0.28, 'sawtooth', 0, 0.7);
    this.tone(165, 0.14, 0.32, 'sawtooth', 0.12, 0.7);
  }

  good() {
    if (!this.ready) return;
    this.tone(784, 0.1, 0.15, 'triangle');
    this.tone(1175, 0.08, 0.2, 'triangle', 0.06);
  }

  win() {
    if (!this.ready) return;
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.16, 0.5, 'triangle', i * 0.09));
    [261, 329, 392].forEach((f) => this.tone(f, 0.1, 1.2, 'sine', 0.45));
  }

  lose() {
    if (!this.ready) return;
    [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.13, 0.4, 'triangle', i * 0.14));
  }

  /** Slow lounge pad: a jazzy ii–V–I loop on soft triangles. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const chords = [
      [146.8, 174.6, 220, 261.6],
      [196, 246.9, 293.7, 349.2],
      [130.8, 164.8, 196, 246.9],
      [110, 130.8, 164.8, 196],
    ];
    let i = 0;
    const play = () => {
      const c = this.ctx!;
      const t = c.currentTime;
      for (const f of chords[i % chords.length]) {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.05, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.9);
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        o.connect(lp).connect(g).connect(this.music!);
        o.start(t);
        o.stop(t + 4);
        this.musicNodes.push(o);
      }
      this.musicNodes = this.musicNodes.slice(-16);
      i++;
    };
    play();
    this.musicTimer = window.setInterval(play, 3600);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = 0;
    for (const n of this.musicNodes) {
      try {
        n.stop();
      } catch {
        // already stopped
      }
    }
    this.musicNodes = [];
  }
}

export const sound = new Sound();
