// Synthesised instruments and table sounds; no audio assets.
const PENTATONIC = [130.81, 146.83, 164.81, 196, 220]; // Cung, thương, giốc, chuỷ, vũ.

interface VoiceOptions {
  src: AudioScheduledSourceNode;
  input: AudioNode;
  gain: number;
  decay: number;
  bus: GainNode;
  t: number;
  attack?: number;
}

interface BurstOptions {
  freq: number;
  q: number;
  gain: number;
  decay: number;
  type?: BiquadFilterType;
  when?: number;
  attack?: number;
}

interface ToneOptions {
  freq: number;
  gain: number;
  decay: number;
  when?: number;
  bus?: GainNode;
  slide?: number;
  attack?: number;
}

interface BellOptions {
  freq: number;
  gain: number;
  when?: number;
  bus?: GainNode;
  decay?: number;
}

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

  private voice(o: VoiceOptions) {
    const { src, input, gain, decay, bus, t } = o;
    const attack = o.attack ?? 0.002;
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

  private burst(o: BurstOptions) {
    const { freq, q, gain, decay } = o;
    const type = o.type ?? 'bandpass';
    const when = o.when ?? 0;
    const attack = o.attack ?? 0.001;
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
    this.voice({ src, input: f, gain, decay, bus: this.sfx!, t: c.currentTime + when, attack });
  }

  private tone(o: ToneOptions) {
    const { freq, gain, decay } = o;
    const when = o.when ?? 0;
    const bus = o.bus ?? this.sfx!;
    const slide = o.slide ?? 1;
    const attack = o.attack ?? 0.003;
    const c = this.ctx!;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + decay);
    this.voice({ src: osc, input: osc, gain, decay, bus, t, attack });
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
    this.voice({ src, input: src, gain, decay: 2.8, bus, t: this.ctx!.currentTime + when });
  }

  private bell(o: BellOptions) {
    const { freq, gain } = o;
    const when = o.when ?? 0;
    const bus = o.bus ?? this.sfx!;
    const decay = o.decay ?? 2.4;
    for (const [ratio, level, length] of [[1, 1, 1], [2.71, 0.3, 0.6], [4.08, 0.12, 0.3]]) {
      this.tone({ freq: freq * ratio, gain: gain * level, decay: decay * length, when, bus });
    }
  }

  ballHit(speed: number) {
    if (!this.ready || speed < 0.05) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastClick < 0.012) return;
    this.lastClick = now;
    const v = this.unit(speed / 5);
    this.burst({ freq: 3200 + v * 2200, q: 2, gain: 0.08 + v * 0.48, decay: 0.018 + v * 0.015 });
    this.tone({ freq: 2100 + v * 900, gain: 0.04 + v * 0.16, decay: 0.025 });
    this.tone({ freq: 480, gain: v * 0.015 + 0.001, decay: 0.055 });
  }

  cushion(speed: number) {
    if (!this.ready || speed < 0.15) return;
    const now = this.ctx!.currentTime;
    if (now - this.lastCushion < 0.02) return;
    this.lastCushion = now;
    const v = this.unit(speed / 4);
    this.burst({ freq: 380 + v * 180, q: 0.7, gain: 0.08 + v * 0.35, decay: 0.07, type: 'lowpass' });
    this.tone({ freq: 140, gain: 0.02 + v * 0.09, decay: 0.065, when: 0, bus: this.sfx!, slide: 0.8 });
  }

  pocket(speed: number) {
    if (!this.ready) return;
    const v = this.unit(speed / 3);
    this.burst({ freq: 1900, q: 2, gain: 0.08 + v * 0.2, decay: 0.025 });
    this.burst({ freq: 1100, q: 2, gain: 0.04 + v * 0.1, decay: 0.035, when: 0.045 });
    this.burst({ freq: 260, q: 0.7, gain: 0.12 + v * 0.18, decay: 0.12, type: 'lowpass', when: 0.12 });
    this.tone({ freq: 105, gain: 0.05 + v * 0.08, decay: 0.12, when: 0.12, bus: this.sfx!, slide: 0.7 });
  }

  cueStrike(power: number) {
    if (!this.ready) return;
    const v = this.unit(power);
    this.burst({ freq: 1500 + v * 1000, q: 1, gain: 0.1 + v * 0.35, decay: 0.025 });
    this.tone({ freq: 650, gain: 0.025 + v * 0.1, decay: 0.028 });
  }

  miscue() {
    if (!this.ready) return;
    this.burst({ freq: 3600, q: 5, gain: 0.25, decay: 0.055 });
    this.burst({ freq: 1800, q: 1, gain: 0.12, decay: 0.08, type: 'highpass' });
  }

  tap() {
    if (!this.ready) return;
    this.tone({ freq: 740, gain: 0.09, decay: 0.055 });
    this.tone({ freq: 1190, gain: 0.025, decay: 0.025 });
    this.burst({ freq: 2200, q: 1, gain: 0.035, decay: 0.012 });
  }

  tick(level: number) {
    if (!this.ready || this.ctx!.currentTime - this.lastTick < 0.045) return;
    this.lastTick = this.ctx!.currentTime;
    this.tone({ freq: PENTATONIC[Math.round(this.unit(level) * 4)] * 4, gain: 0.035, decay: 0.035 });
    this.burst({ freq: 2400, q: 1, gain: 0.02, decay: 0.01 });
  }

  explode() {
    if (!this.ready) return;
    this.burst({ freq: 180, q: 0.7, gain: 0.28, decay: 0.35, type: 'lowpass' });
    this.bell({ freq: 65.405, gain: 0.18, when: 0, bus: this.sfx!, decay: 2 });
  }

  skill() {
    if (!this.ready) return;
    this.burst({ freq: 1200, q: 0.5, gain: 0.1, decay: 0.45, attack: 0.12 });
    this.pluck(PENTATONIC[1] * 2, 0.15);
    this.pluck(PENTATONIC[3] * 2, 0.12, 0.1);
  }

  ultimate() {
    if (!this.ready) return;
    this.burst({ freq: 700, q: 0.5, gain: 0.15, decay: 0.65, attack: 0.15 });
    this.bell({ freq: 65.405, gain: 0.23, when: 0.08, bus: this.sfx!, decay: 3.8 });
    this.pluck(PENTATONIC[0] * 2, 0.14, 0.2);
  }

  /** The rack-winning strike: a low blow, a deep bell, then a rising phrase. */
  finisher() {
    if (!this.ready) return;
    this.burst({ freq: 160, q: 0.7, gain: 0.32, decay: 0.4, type: 'lowpass' });
    this.burst({ freq: 900, q: 0.5, gain: 0.12, decay: 0.5, when: 0.05, attack: 0.1 });
    this.bell({ freq: 65.405, gain: 0.24, when: 0.05, bus: this.sfx!, decay: 4.5 });
    for (let i = 0; i < 3; i++) this.pluck(PENTATONIC[i + 2] * 2, 0.13, 0.35 + i * 0.12);
  }

  omen() {
    if (!this.ready) return;
    this.bell({ freq: 196, gain: 0.09, when: 0, bus: this.sfx!, decay: 3 });
    this.burst({ freq: 800, q: 0.5, gain: 0.055, decay: 0.8, attack: 0.22 });
  }

  page() {
    if (!this.ready) return;
    this.burst({ freq: 1700, q: 0.5, gain: 0.055, decay: 0.24, attack: 0.055 });
  }

  foul() {
    if (!this.ready) return;
    this.pluck(PENTATONIC[2], 0.13);
    this.pluck(PENTATONIC[1], 0.1, 0.17);
    this.pluck(PENTATONIC[0], 0.08, 0.34);
  }

  good() {
    if (!this.ready) return;
    this.bell({ freq: 392, gain: 0.075, when: 0, bus: this.sfx!, decay: 1.5 });
  }

  win() {
    if (!this.ready) return;
    this.bell({ freq: 130.81, gain: 0.18, when: 0, bus: this.sfx!, decay: 4 });
    for (let i = 0; i < 5; i++) this.pluck(PENTATONIC[i] * 2, 0.15, 0.18 + i * 0.22);
  }

  lose() {
    if (!this.ready) return;
    for (let i = 0; i < 4; i++) this.pluck(PENTATONIC[3 - i], 0.11, i * 0.25);
    this.tone({ freq: 65.405, gain: 0.1, decay: 0.5, when: 0.8, bus: this.sfx!, slide: 0.8 });
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
          this.tone({ freq: 65.405, gain: 0.045, decay: 12, when: delay, bus: this.music!, slide: 1, attack: 1.5 });
          this.tone({ freq: 98, gain: 0.018, decay: 12, when: delay, bus: this.music!, slide: 1, attack: 1.8 });
        }
        if (Math.random() > 0.2) {
          const degree = (step + Math.floor(Math.random() * 3)) % 5;
          this.pluck(PENTATONIC[degree] * (Math.random() < 0.25 ? 2 : 1), 0.13, delay, this.music!);
        }
        if (step % 16 === 12 && Math.random() < 0.65) this.bell({ freq: 392, gain: 0.025, when: delay, bus: this.music!, decay: 4 });
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
