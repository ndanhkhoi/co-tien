// Synthesised instruments and table sounds; no audio assets.
const PENTATONIC = [130.81, 146.83, 164.81, 196, 220]; // Cung, thương, giốc, chuỷ, vũ.

class Sound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private plucks = new Map<number, AudioBuffer>();
  private voices = new Map<AudioScheduledSourceNode, { gain: GainNode; bus: GainNode }>();
  private musicTimer = 0;
  private nextNote = 0;
  private musicStep = 0;
  private lastClick = -1;
  private lastCushion = -1;
  private lastTick = -1;
  private hidden = false;
  sfxVolume = 0.9;
  musicVolume = 0.35;

  /** Must run inside a user gesture (iOS). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC({ latencyHint: 'interactive' });
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 6;
      comp.ratio.value = 20;
      comp.attack.value = 0.002;
      comp.release.value = 0.18;
      const master = c.createGain();
      master.gain.value = 0.65;
      comp.connect(master).connect(c.destination);
      this.sfx = c.createGain();
      this.music = c.createGain();
      this.sfx.gain.value = this.sfxVolume;
      this.music.gain.value = this.musicVolume;
      this.sfx.connect(comp);
      this.music.connect(comp);
      this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Cache the finite zither register once, outside the music scheduler.
      for (const f of PENTATONIC) for (const octave of [1, 2, 4]) this.makePluck(f * octave);
      const silent = c.createBufferSource();
      silent.buffer = c.createBuffer(1, 1, c.sampleRate);
      silent.connect(c.destination);
      silent.onended = () => silent.disconnect();
      silent.start();
    }
    if (!this.hidden && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = this.unit(sfx);
    this.musicVolume = this.unit(music);
    if (this.ctx) {
      this.sfx!.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.02);
      this.music!.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.02);
    }
  }

  suspend() {
    this.hidden = true;
    void this.ctx?.suspend().catch(() => {});
  }

  resume() {
    this.hidden = false;
    void this.ctx?.resume().catch(() => {});
  }

  private get ready() { return !!this.ctx && this.ctx.state === 'running' && !this.hidden; }
  private unit(v: number) { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0; }

  private voice(src: AudioScheduledSourceNode, input: AudioNode, gain: number, decay: number, bus: GainNode, t: number, attack = 0.002) {
    const c = this.ctx!;
    // Reserve room for physical impacts even while a musical phrase is ringing.
    if (this.voices.size >= 32 || (bus === this.music && this.voices.size >= 20)) {
      src.disconnect();
      if (input !== src) input.disconnect();
      return;
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.00001, t + decay);
    input.connect(g).connect(bus);
    this.voices.set(src, { gain: g, bus });
    src.onended = () => {
      src.disconnect();
      if (input !== src) input.disconnect();
      g.disconnect();
      this.voices.delete(src);
    };
    src.start(t);
    src.stop(t + decay + 0.02);
  }

  private burst(freq: number, q: number, gain: number, decay: number, type: BiquadFilterType = 'bandpass', when = 0, attack = 0.001) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    this.voice(src, f, gain, decay, this.sfx!, c.currentTime + when, attack);
  }

  private tone(freq: number, gain: number, decay: number, when = 0, bus = this.sfx!, slide = 1, attack = 0.003) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(freq * slide, t + decay);
    this.voice(o, o, gain, decay, bus, t, attack);
  }

  private makePluck(freq: number) {
    const c = this.ctx!;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 2.8), c.sampleRate);
    const d = buffer.getChannelData(0);
    const period = Math.round(c.sampleRate / freq);
    for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1;
    for (let i = period; i < d.length; i++) d[i] = 0.496 * (d[i - period] + d[i - period + 1]);
    this.plucks.set(freq, buffer);
  }

  private pluck(freq: number, gain: number, when = 0, bus = this.sfx!) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.plucks.get(freq)!;
    this.voice(src, src, gain, 2.8, bus, this.ctx!.currentTime + when);
  }

  private bell(freq: number, gain: number, when = 0, bus = this.sfx!, decay = 2.4) {
    for (const [ratio, level, length] of [[1, 1, 1], [2.71, 0.3, 0.6], [4.08, 0.12, 0.3]]) {
      this.tone(freq * ratio, gain * level, decay * length, when, bus);
    }
  }

  ballHit(speed: number) {
    if (!this.ready || speed < 0.05) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastClick < 0.012) return;
    this.lastClick = now;
    const v = this.unit(speed / 5);
    this.burst(3200 + v * 2200, 2, 0.08 + v * 0.48, 0.018 + v * 0.015);
    this.tone(2100 + v * 900, 0.04 + v * 0.16, 0.025);
    this.tone(480, v * 0.015 + 0.001, 0.055);
  }

  cushion(speed: number) {
    if (!this.ready || speed < 0.15) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastCushion < 0.02) return;
    this.lastCushion = now;
    const v = this.unit(speed / 4);
    this.burst(380 + v * 180, 0.7, 0.08 + v * 0.35, 0.07, 'lowpass');
    this.tone(140, 0.02 + v * 0.09, 0.065, 0, this.sfx!, 0.8);
  }

  pocket(speed: number) {
    if (!this.ready) return;
    const v = this.unit(speed / 3);
    this.burst(1900, 2, 0.08 + v * 0.2, 0.025);
    this.burst(1100, 2, 0.04 + v * 0.1, 0.035, 'bandpass', 0.045);
    this.burst(260, 0.7, 0.12 + v * 0.18, 0.12, 'lowpass', 0.12);
    this.tone(105, 0.05 + v * 0.08, 0.12, 0.12, this.sfx!, 0.7);
  }

  cueStrike(power: number) {
    if (!this.ready) return;
    const v = this.unit(power);
    this.burst(1500 + v * 1000, 1, 0.1 + v * 0.35, 0.025);
    this.tone(650, 0.025 + v * 0.1, 0.028);
  }

  miscue() {
    if (!this.ready) return;
    this.burst(3600, 5, 0.25, 0.055);
    this.burst(1800, 1, 0.12, 0.08, 'highpass');
  }

  tap() {
    if (!this.ready) return;
    this.tone(740, 0.09, 0.055);
    this.tone(1190, 0.025, 0.025);
    this.burst(2200, 1, 0.035, 0.012);
  }

  tick(level: number) {
    if (!this.ready || this.ctx!.currentTime - this.lastTick < 0.045) return;
    this.lastTick = this.ctx!.currentTime;
    this.tone(PENTATONIC[Math.round(this.unit(level) * 4)] * 4, 0.035, 0.035);
    this.burst(2400, 1, 0.02, 0.01);
  }

  explode() {
    if (!this.ready) return;
    this.burst(180, 0.7, 0.28, 0.35, 'lowpass');
    this.bell(65.405, 0.18, 0, this.sfx!, 2);
  }

  skill() {
    if (!this.ready) return;
    this.burst(1200, 0.5, 0.1, 0.45, 'bandpass', 0, 0.12);
    this.pluck(PENTATONIC[1] * 2, 0.15);
    this.pluck(PENTATONIC[3] * 2, 0.12, 0.1);
  }

  ultimate() {
    if (!this.ready) return;
    this.burst(700, 0.5, 0.15, 0.65, 'bandpass', 0, 0.15);
    this.bell(65.405, 0.23, 0.08, this.sfx!, 3.8);
    this.pluck(PENTATONIC[0] * 2, 0.14, 0.2);
  }

  /** The rack-winning strike: a low blow, a deep bell, then a rising phrase. */
  finisher() {
    if (!this.ready) return;
    this.burst(160, 0.7, 0.32, 0.4, 'lowpass');
    this.burst(900, 0.5, 0.12, 0.5, 'bandpass', 0.05, 0.1);
    this.bell(65.405, 0.24, 0.05, this.sfx!, 4.5);
    for (let i = 0; i < 3; i++) this.pluck(PENTATONIC[i + 2] * 2, 0.13, 0.35 + i * 0.12);
  }

  omen() {
    if (!this.ready) return;
    this.bell(196, 0.09, 0, this.sfx!, 3);
    this.burst(800, 0.5, 0.055, 0.8, 'bandpass', 0, 0.22);
  }

  page() {
    if (!this.ready) return;
    this.burst(1700, 0.5, 0.055, 0.24, 'bandpass', 0, 0.055);
  }

  foul() {
    if (!this.ready) return;
    this.pluck(PENTATONIC[2], 0.13);
    this.pluck(PENTATONIC[1], 0.1, 0.17);
    this.pluck(PENTATONIC[0], 0.08, 0.34);
  }

  good() {
    if (!this.ready) return;
    this.bell(392, 0.075, 0, this.sfx!, 1.5);
  }

  win() {
    if (!this.ready) return;
    this.bell(130.81, 0.18, 0, this.sfx!, 4);
    for (let i = 0; i < 5; i++) this.pluck(PENTATONIC[i] * 2, 0.15, 0.18 + i * 0.22);
  }

  lose() {
    if (!this.ready) return;
    for (let i = 0; i < 4; i++) this.pluck(PENTATONIC[3 - i], 0.11, i * 0.25);
    this.tone(65.405, 0.1, 0.5, 0.8, this.sfx!, 0.8);
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + 0.05;
    this.musicStep = 0;
    const schedule = () => {
      if (!this.ready) return;
      const now = this.ctx!.currentTime;
      if (this.nextNote < now) this.nextNote = now + 0.05;
      while (this.nextNote < now + 0.45) {
        const delay = this.nextNote - now;
        const step = this.musicStep++;
        if (step % 8 === 0) {
          this.tone(65.405, 0.045, 12, delay, this.music!, 1, 1.5);
          this.tone(98, 0.018, 12, delay, this.music!, 1, 1.8);
        }
        if (Math.random() > 0.2) {
          const degree = (step + Math.floor(Math.random() * 3)) % 5;
          this.pluck(PENTATONIC[degree] * (Math.random() < 0.25 ? 2 : 1), 0.13, delay, this.music!);
        }
        if (step % 16 === 12 && Math.random() < 0.65) this.bell(392, 0.025, delay, this.music!, 4);
        this.nextNote += 1.3 + Math.random() * 0.65;
      }
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, 150);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = 0;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [src, voice] of this.voices) {
      if (voice.bus !== this.music) continue;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.00001, now, 0.025);
      src.stop(now + 0.15);
    }
  }
}

export const sound = new Sound();
