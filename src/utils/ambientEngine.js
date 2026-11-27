// Procedural Web Audio API synthesizer for offline-first ambient soundscapes & chimes

class AmbientSoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeChannels = new Map();
    this.noiseBuffers = {};
    this.masterVolume = 0.75;
    this.muted = false;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  getNoiseBuffer(type = 'pink') {
    if (this.noiseBuffers[type]) return this.noiseBuffers[type];
    const ctx = this.ensureContext();
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 4; // 4-second seamless loop
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      if (type === 'white') {
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.42;
        }
      } else if (type === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 2.6;
        }
      } else if (type === 'vinyl') {
        let last = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.03 * white) / 1.03;
          const crackle = Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.45 : 0;
          data[i] = last * 0.6 + crackle;
        }
      } else {
        // Pink noise (Paul Kellet's refined filter)
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.065;
          b6 = white * 0.115926;
        }
      }

      // Crossfade loop seam (last 2048 samples) for click-free looping
      const fade = 2048;
      for (let i = 0; i < fade; i++) {
        const t = i / fade;
        const tailIdx = length - fade + i;
        data[i] = data[i] * t + data[tailIdx] * (1 - t);
      }
    }

    this.noiseBuffers[type] = buffer;
    return buffer;
  }

  setMaster(volume, muted) {
    this.masterVolume = volume;
    this.muted = muted;
    if (!this.ctx || !this.masterGain) return;
    const target = muted ? 0 : Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
  }

  syncChannel(id, active, volume) {
    if (!active) {
      this.stopChannel(id);
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.activeChannels.has(id)) {
      this.startChannel(id, volume);
    } else {
      const ch = this.activeChannels.get(id);
      ch.channelGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        ctx.currentTime,
        0.07
      );
    }
  }

  startChannel(id, volume = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx || this.activeChannels.has(id)) return;

    const channelGain = ctx.createGain();
    channelGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    channelGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime, 0.12);
    channelGain.connect(this.masterGain);

    const nodes = [];
    const intervals = [];

    if (id === 'rain') {
      // Main rainfall body
      const src1 = ctx.createBufferSource();
      src1.buffer = this.getNoiseBuffer('pink');
      src1.loop = true;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 180;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2100;

      // Subtle rain swell LFO
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 450;
      lfo.connect(lfoGain);
      lfoGain.connect(lp.frequency);

      const rainGain = ctx.createGain();
      rainGain.gain.value = 0.85;

      src1.connect(hp);
      hp.connect(lp);
      lp.connect(rainGain);
      rainGain.connect(channelGain);

      // Gentle fine drizzle shimmer
      const src2 = ctx.createBufferSource();
      src2.buffer = this.getNoiseBuffer('white');
      src2.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 4200;
      bp.Q.value = 0.8;
      const drizzleGain = ctx.createGain();
      drizzleGain.gain.value = 0.08;
      src2.connect(bp);
      bp.connect(drizzleGain);
      drizzleGain.connect(channelGain);

      src1.start();
      src2.start();
      lfo.start();
      nodes.push(src1, src2, lfo, hp, lp, bp, lfoGain, rainGain, drizzleGain);
    } else if (id === 'cafe') {
      // Cozy low room warmth
      const roomSrc = ctx.createBufferSource();
      roomSrc.buffer = this.getNoiseBuffer('brown');
      roomSrc.loop = true;
      const roomLp = ctx.createBiquadFilter();
      roomLp.type = 'lowpass';
      roomLp.frequency.value = 320;
      const roomGain = ctx.createGain();
      roomGain.gain.value = 0.65;
      roomSrc.connect(roomLp);
      roomLp.connect(roomGain);
      roomGain.connect(channelGain);

      // Distant soft chatter texture (dual modulated bandpass)
      const chatterSrc = ctx.createBufferSource();
      chatterSrc.buffer = this.getNoiseBuffer('pink');
      chatterSrc.loop = true;

      const form1 = ctx.createBiquadFilter();
      form1.type = 'bandpass';
      form1.frequency.value = 680;
      form1.Q.value = 1.6;

      const form2 = ctx.createBiquadFilter();
      form2.type = 'bandpass';
      form2.frequency.value = 1280;
      form2.Q.value = 1.9;

      const modGain1 = ctx.createGain();
      modGain1.gain.value = 0.35;
      const modGain2 = ctx.createGain();
      modGain2.gain.value = 0.25;

      const lfo1 = ctx.createOscillator();
      lfo1.frequency.value = 0.17;
      const lfo1Depth = ctx.createGain();
      lfo1Depth.gain.value = 0.16;
      lfo1.connect(lfo1Depth);
      lfo1Depth.connect(modGain1.gain);

      const lfo2 = ctx.createOscillator();
      lfo2.frequency.value = 0.27;
      const lfo2Depth = ctx.createGain();
      lfo2Depth.gain.value = 0.12;
      lfo2.connect(lfo2Depth);
      lfo2Depth.connect(modGain2.gain);

      chatterSrc.connect(form1);
      chatterSrc.connect(form2);
      form1.connect(modGain1);
      form2.connect(modGain2);
      modGain1.connect(channelGain);
      modGain2.connect(channelGain);

      roomSrc.start();
      chatterSrc.start();
      lfo1.start();
      lfo2.start();
      nodes.push(roomSrc, chatterSrc, lfo1, lfo2, roomLp, roomGain, form1, form2, modGain1, modGain2, lfo1Depth, lfo2Depth);

      // Occasional soft ceramic cup clink
      const clinkTimer = setInterval(() => {
        if (!this.ctx || !this.activeChannels.has('cafe')) return;
        if (Math.random() > 0.65) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2100 + Math.random() * 1400, now);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.022, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        osc.connect(g);
        g.connect(channelGain);
        osc.start(now);
        osc.stop(now + 0.25);
      }, 4200);
      intervals.push(clinkTimer);
    } else if (id === 'whitenoise') {
      // Smooth, sculpted focus white noise (warmed so ears don't fatigue)
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer('white');
      src.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3400;
      lp.Q.value = 0.5;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;

      const g = ctx.createGain();
      g.gain.value = 0.45;

      src.connect(hp);
      hp.connect(lp);
      lp.connect(g);
      g.connect(channelGain);
      src.start();
      nodes.push(src, lp, hp, g);
    } else if (id === 'lofi') {
      // Vinyl crackle bed
      const vinyl = ctx.createBufferSource();
      vinyl.buffer = this.getNoiseBuffer('vinyl');
      vinyl.loop = true;
      const vinylFilter = ctx.createBiquadFilter();
      vinylFilter.type = 'bandpass';
      vinylFilter.frequency.value = 1800;
      vinylFilter.Q.value = 0.6;
      const vinylGain = ctx.createGain();
      vinylGain.gain.value = 0.14;
      vinyl.connect(vinylFilter);
      vinylFilter.connect(vinylGain);
      vinylGain.connect(channelGain);
      vinyl.start();

      // Warm master tone filter + subtle echo for Rhodes lo-fi chords
      const chordBus = ctx.createBiquadFilter();
      chordBus.type = 'lowpass';
      chordBus.frequency.value = 980;
      chordBus.connect(channelGain);

      const delay = ctx.createDelay();
      delay.delayTime.value = 0.36;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.26;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 720;

      chordBus.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(feedback);
      feedback.connect(delay);
      delayFilter.connect(channelGain);

      // Gentle Maj7 / Min9 progression (Fmaj7 - Em7 - Dm9 - Cmaj7)
      const chords = [
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [164.81, 196.0, 246.94, 293.66], // Em7
        [146.83, 174.61, 220.0, 329.63], // Dm9
        [130.81, 164.81, 196.0, 246.94], // Cmaj7
      ];
      let step = 0;

      const playChord = () => {
        if (!this.ctx || !this.activeChannels.has('lofi')) return;
        const notes = chords[step % chords.length];
        step++;
        const now = this.ctx.currentTime;

        notes.forEach((freq, idx) => {
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const voiceGain = this.ctx.createGain();

          osc1.type = 'triangle';
          osc2.type = 'sine';
          // Slight tape-warble detune
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 1.003, now);

          const startOffset = idx * 0.055; // Gentle strum
          voiceGain.gain.setValueAtTime(0.0001, now + startOffset);
          voiceGain.gain.linearRampToValueAtTime(0.065, now + startOffset + 0.14);
          voiceGain.gain.exponentialRampToValueAtTime(0.018, now + startOffset + 2.4);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 3.5);

          osc1.connect(voiceGain);
          osc2.connect(voiceGain);
          voiceGain.connect(chordBus);

          osc1.start(now + startOffset);
          osc2.start(now + startOffset);
          osc1.stop(now + startOffset + 3.6);
          osc2.stop(now + startOffset + 3.6);
        });
      };

      playChord();
      const lofiTimer = setInterval(playChord, 3800);
      intervals.push(lofiTimer);
      nodes.push(vinyl, vinylFilter, vinylGain, chordBus, delay, feedback, delayFilter);
    }

    this.activeChannels.set(id, { channelGain, nodes, intervals });
  }

  stopChannel(id) {
    const ch = this.activeChannels.get(id);
    if (!ch) return;

    ch.intervals.forEach((t) => clearInterval(t));
    const ctx = this.ctx;
    if (ctx) {
      ch.channelGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    }

    const nodesToStop = ch.nodes;
    const gainNode = ch.channelGain;
    this.activeChannels.delete(id);

    setTimeout(() => {
      nodesToStop.forEach((node) => {
        try {
          if (typeof node.stop === 'function') node.stop();
        } catch {}
        try {
          node.disconnect();
        } catch {}
      });
      try {
        gainNode.disconnect();
      } catch {}
    }, 220);
  }

  stopAll() {
    Array.from(this.activeChannels.keys()).forEach((id) => this.stopChannel(id));
  }

  playCompletionChime(mode = 'focus') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      mode === 'focus'
        ? [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6 uplifting chime
        : [587.33, 440.0, 523.25]; // Gentle return-to-focus chime

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.14;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.95);
    });
  }
}

export const ambientEngine = new AmbientSoundEngine();

export const AMBIENT_CHANNELS = [
  {
    id: 'rain',
    name: 'Hujan',
    desc: 'Rintik hujan lembut',
    emoji: '🌧️',
  },
  {
    id: 'cafe',
    name: 'Kafe',
    desc: 'Suasana kedai kopi hangat',
    emoji: '☕',
  },
  {
    id: 'whitenoise',
    name: 'White Noise',
    desc: 'Frekuensi halus peredam bising',
    emoji: '〰️',
  },
  {
    id: 'lofi',
    name: 'Lo-fi',
    desc: 'Akord hangat & vinyl lembut',
    emoji: '🎧',
  },
];
