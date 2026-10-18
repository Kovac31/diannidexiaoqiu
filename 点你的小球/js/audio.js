/* ============================================================
   CS: FACE STRIKE — synthesized weapon / feedback audio
   All sounds are generated at runtime (no external assets).
   ============================================================ */
window.CS = window.CS || {};
(function () {
  'use strict';

  var Audio = {
    ctx: null,
    master: null,
    noiseBuf: null,
    volume: 0.55,
    ready: false,

    init: function () {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) { return; }
      var ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 22;
      comp.ratio.value = 7;
      comp.attack.value = 0.002;
      comp.release.value = 0.22;
      this.master.connect(comp);
      comp.connect(ctx.destination);

      // white noise buffer
      var len = Math.floor(ctx.sampleRate * 2);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.ready = true;
    },

    resume: function () {
      if (!this.ctx) this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    setVolume: function (v) {
      this.volume = v;
      if (this.master) this.master.gain.value = v;
    },

    _noise: function (dur, when) {
      var ctx = this.ctx;
      var src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      src.start(when);
      src.stop(when + dur + 0.05);
      return src;
    },

    /* ---------------- gunshot ---------------- */
    shot: function (w) {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime + 0.001;
      var s = w.sound;
      var g = s.gain;

      // 1. sharp crack
      var n1 = this._noise(0.08, t);
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = s.crack || 1600;
      var g1 = ctx.createGain();
      g1.gain.setValueAtTime(g * 0.9, t);
      g1.gain.exponentialRampToValueAtTime(0.0008, t + (s.crackDecay || 0.05));
      n1.connect(hp); hp.connect(g1); g1.connect(this.master);

      // 2. body noise
      var n2 = this._noise(0.45, t);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(s.filter || 3200, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(200, (s.filter || 3200) * 0.22), t + (s.decay || 0.18));
      lp.Q.value = 1.1;
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, t);
      g2.gain.linearRampToValueAtTime(g * 1.15, t + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0008, t + (s.decay || 0.18));
      n2.connect(lp); lp.connect(g2); g2.connect(this.master);

      // 3. low thump
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(s.body || 150, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(28, (s.body || 150) * 0.32), t + (s.thump || 0.14));
      var g3 = ctx.createGain();
      g3.gain.setValueAtTime(g * 0.85, t);
      g3.gain.exponentialRampToValueAtTime(0.0008, t + (s.thump || 0.14));
      osc.connect(g3); g3.connect(this.master);
      osc.start(t); osc.stop(t + (s.thump || 0.14) + 0.02);

      // 4. long tail (AWP / deagle)
      if (s.tail) {
        var n3 = this._noise(s.tail + 0.1, t + 0.01);
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 420;
        bp.Q.value = 0.6;
        var g4 = ctx.createGain();
        g4.gain.setValueAtTime(g * 0.4, t + 0.02);
        g4.gain.exponentialRampToValueAtTime(0.0006, t + s.tail);
        n3.connect(bp); bp.connect(g4); g4.connect(this.master);
      }

      // 5. mechanical action click
      var n4 = this._noise(0.02, t + 0.05);
      var hp2 = ctx.createBiquadFilter();
      hp2.type = 'bandpass';
      hp2.frequency.value = 4200;
      var g5 = ctx.createGain();
      g5.gain.setValueAtTime(g * 0.22, t + 0.05);
      g5.gain.exponentialRampToValueAtTime(0.0005, t + 0.07);
      n4.connect(hp2); hp2.connect(g5); g5.connect(this.master);
    },

    /* ---------------- hit feedback ---------------- */
    hit: function (headshot, kill) {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime + 0.001;
      var base = headshot ? 1900 : 1250;
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.055);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.075);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.09);

      if (headshot) {
        var o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(2950, t + 0.008);
        var g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.11, t + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.0004, t + 0.12);
        o2.connect(g2); g2.connect(this.master);
        o2.start(t + 0.008); o2.stop(t + 0.14);
      }
      if (kill) {
        var o3 = ctx.createOscillator();
        o3.type = 'sine';
        o3.frequency.setValueAtTime(760, t + 0.02);
        o3.frequency.setValueAtTime(1140, t + 0.09);
        var g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.09, t + 0.02);
        g3.gain.exponentialRampToValueAtTime(0.0004, t + 0.2);
        o3.connect(g3); g3.connect(this.master);
        o3.start(t + 0.02); o3.stop(t + 0.22);
      }
    },

    /* ---------------- misc ---------------- */
    empty: function () {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var n = this._noise(0.03, t);
      var f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 2600;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      n.connect(f); f.connect(g); g.connect(this.master);
    },

    click: function (vol, freq, dur) {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var n = this._noise(dur || 0.03, t);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq || 2200; f.Q.value = 1.6;
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + (dur || 0.03));
      n.connect(f); f.connect(g); g.connect(this.master);
    },

    reload: function (w) {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var d = w.reload;
      this.click(0.16, 1500, 0.05);
      var self = this;
      setTimeout(function () { self.click(0.2, 900, 0.06); }, d * 1000 * 0.55);
      setTimeout(function () { self.click(0.24, 2600, 0.04); }, d * 1000 * 0.86);
      // magazine rattle
      var n = this._noise(0.14, t + d * 0.3);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0, t + d * 0.3);
      g.gain.linearRampToValueAtTime(0.09, t + d * 0.3 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t + d * 0.3 + 0.14);
      n.connect(f); f.connect(g); g.connect(this.master);
    },

    draw: function () {
      this.click(0.12, 3000, 0.035);
      var self = this;
      setTimeout(function () { self.click(0.09, 1800, 0.04); }, 90);
    },

    jump: function () {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var n = this._noise(0.12, t);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(280, t + 0.12);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
      n.connect(f); f.connect(g); g.connect(this.master);
    },

    land: function (strength) {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.14);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.1 * (strength || 1), t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.18);
      this.click(0.05, 700, 0.07);
    },

    hurt: function () {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var n = this._noise(0.3, t);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t);
      f.frequency.exponentialRampToValueAtTime(180, t + 0.3);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
      n.connect(f); f.connect(g); g.connect(this.master);
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.22);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.12, t);
      g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.24);
      o.connect(g2); g2.connect(this.master);
      o.start(t); o.stop(t + 0.26);
    },

    wave: function (up) {
      if (!this.ready) return;
      var ctx = this.ctx, t = ctx.currentTime;
      var freqs = up ? [330, 495, 660] : [220, 330];
      var self = this;
      freqs.forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        var g = ctx.createGain();
        var st = t + i * 0.1;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(0.055, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0004, st + 0.3);
        o.connect(g); g.connect(self.master);
        o.start(st); o.stop(st + 0.32);
      });
    },

    scope: function () {
      this.click(0.1, 3400, 0.03);
    }
  };

  window.CS.Audio = Audio;
})();
