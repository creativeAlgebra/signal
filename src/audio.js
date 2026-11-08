// Signal's sound: the patch made real in Web Audio, the browser's own nodes and one small worklet
// of our own (the Looper's recorder). Each key played is a voice: its own copy of every module that follows the keyboard
// (oscillators, noise, mixers, filters, amps, envelopes). The LFO, the echo and the speaker are one
// each, shared by every voice, and so is anything the echo feeds. With the keyboard plugged into
// nothing the patch plays as one voice that never stops: a drone, which is what lesson one hears.
//
// How the knobs move: a mod input has a depth knob at the receiving end. An oscillator's Bend and a
// filter's Cutoff move in cents (1,200 to the octave), so an envelope or LFO opens a filter by
// octaves, as the ear hears it; an amp's Level is the signal itself times Gain (an LFO, which swings
// below zero, is lifted to 0..1 first, so it gives tremolo rather than silence).
//
// The pictures on the cards come from analysers on the newest voice: the one you hear last is the
// one you see.
//
// In the studio several engines share one clock (opts.context, a function that returns the
// AudioContext, and opts.out, where each engine's sound goes), and the loop plays notes ahead of
// time with trigger(note, at, length). An OfflineAudioContext works the same way (opts.offline):
// the whole loop is scheduled at once and rendered, for a .wav or for the numbers the AI reads.
// Glide: an oscillator played from the keyboard slides from the note before to this one.
//
// The voice and the pedals (the master class): the Microphone is the page's microphone, asked for
// once and shared; the Looper records what reaches it through a small worklet of our own
// (recorder-worklet.js) and plays each layer round as its own looping source, so a layer can be
// taken off again; the pedals are nodes (a wave shaper, a convolver on an impulse made in code,
// modulated delays, a swept band-pass, two crossfaded delay lines for pitch). The Microphone and
// the Looper keep their state when the patch around them changes (a knob, a cable): they are
// `persistent`, carried from one load to the next instead of being made again.
import { defOf, FREE_HZ } from "./modules.js";
import { moduleOf, cablesInto, cablesFrom, keyed, heard } from "./patch.js";
import { afterPress, afterUndo, layerOffset, placeLayer } from "./looper.js";

// The microphone: asked for once, shared by every engine on the page. status: "none" (this browser
// has none), "asking", "live", "denied".
const MIC = { stream: null, status: "none", pending: null };
export function requestMic() {
  if (MIC.stream) return Promise.resolve(MIC.stream);
  if (MIC.pending) return MIC.pending;
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
  if (!md?.getUserMedia) {
    MIC.status = "none";
    return Promise.resolve(null);
  }
  MIC.status = "asking";
  MIC.pending = md
    .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
    .then((stream) => {
      MIC.stream = stream;
      MIC.status = "live";
      return stream;
    })
    .catch(() => {
      MIC.status = "denied";
      return null;
    })
    .finally(() => (MIC.pending = null));
  return MIC.pending;
}
export const micStatus = () => MIC.status;
// Let the microphone go (when Signal closes), so the browser's indicator goes off.
export function releaseMic() {
  for (const t of MIC.stream?.getTracks?.() || []) t.stop();
  MIC.stream = null;
  if (MIC.status === "live") MIC.status = "none";
}

// The recorder worklet, added once per AudioContext.
const WORKLETS = new WeakMap();
function recorderReady(ac) {
  if (!ac?.audioWorklet?.addModule) return Promise.resolve(false);
  if (!WORKLETS.has(ac))
    WORKLETS.set(
      ac,
      ac.audioWorklet.addModule(new URL("./recorder-worklet.js", import.meta.url)).then(
        () => true,
        () => false,
      ),
    );
  return WORKLETS.get(ac);
}

// The pitch shifter's modulation, made once per context: a tenth of a second of ramp and fade for
// each of its two delay lines, the second half a grain behind the first.
export const GRAIN = 0.1;
const SHIFT_BUFS = new WeakMap();
function shiftBuffers(ac) {
  if (SHIFT_BUFS.has(ac)) return SHIFT_BUFS.get(ac);
  const n = Math.round(GRAIN * ac.sampleRate);
  const mk = (f) => {
    const b = ac.createBuffer(1, n, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = f(i / n);
    return b;
  };
  const bufs = {
    rampA: mk((t) => t),
    fadeA: mk((t) => Math.sin(Math.PI * t) ** 2),
    rampB: mk((t) => (t + 0.5) % 1),
    fadeB: mk((t) => Math.cos(Math.PI * t) ** 2),
  };
  SHIFT_BUFS.set(ac, bufs);
  return bufs;
}
// A room: noise that dies away, a little late, for the Reverb's convolver.
function impulse(ac, seconds) {
  const rate = ac.sampleRate;
  const n = Math.max(1, Math.ceil(seconds * rate));
  const pre = Math.round(0.012 * rate);
  const b = ac.createBuffer(2, n + pre, rate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i + pre] = (Math.random() * 2 - 1) * (1 - t) ** 2.4 * Math.exp(-2.2 * t);
    }
  }
  return b;
}
// The Drive's curve: a soft bend that hardens as the signal is pushed into it.
const DRIVE_CURVE = (() => {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(2.6 * x) / Math.tanh(2.6);
  }
  return c;
})();
const ABS_CURVE = (() => {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.abs((i / (n - 1)) * 2 - 1);
  return c;
})();

export const midiHz = (n) => 440 * 2 ** ((n - 69) / 12);
const VOICES = 8;
const BIPOLAR = new Set(["lfo", "osc", "noise", "mixer", "filter", "amp", "delay"]);

export function createEngine(opts = {}) {
  const sharedCtx = opts.context || null,
    offline = !!opts.offline;
  let ac = null,
    master = null,
    sink = null, // analysers are pulled through here, silently
    one = null, // a constant 1, for lifting a swinging signal to 0..1
    noiseBuf = null,
    patch = null,
    global = new Map(), // module id → instance (shared)
    voices = [], // { note, at, off, inst: Map, gates, extra, dead }
    monitor = null,
    taps = new Map(), // module id → AnalyserNode
    tapped = [], // [node, analyser] pairs of the monitored voice
    muted = false,
    globalIds = new Set();

  function ensure() {
    if (ac) return ac;
    if (sharedCtx) {
      ac = typeof sharedCtx === "function" ? sharedCtx() : sharedCtx;
      if (!ac) return null;
      master = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect((typeof opts.out === "function" ? opts.out() : opts.out) || ac.destination);
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC({ latencyHint: "interactive" });
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(comp).connect(ac.destination);
    }
    sink = ac.createGain();
    sink.gain.value = 0;
    sink.connect(ac.destination);
    one = ac.createConstantSource();
    one.offset.value = 1;
    one.start();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return ac;
  }
  const now = () => ac.currentTime;
  const glideTo = (param, v, t = 0.012) => {
    if (!ac) return;
    param.cancelScheduledValues(now());
    param.setTargetAtTime(v, now(), t);
  };

  // One module, made of nodes. ins: jack → { node, param } that cables connect to; outs: jack → node.
  function make(m, voice) {
    const p = m.p;
    const inst = { m, ins: {}, outs: {}, set: () => {}, stop: () => {}, gateOn: () => {}, gateOff: () => {}, nodes: [] };
    const depthInto = (param, value) => {
      const g = ac.createGain();
      g.gain.value = value;
      g.connect(param);
      return g;
    };
    const G = (v = 1) => {
      const g = ac.createGain();
      g.gain.value = v;
      return g;
    };
    const changed = () => opts.changed?.(m.id);
    // A pedal's switch: on, the dry path is what the pedal leaves of it and the wet path is open; off, the signal passes untouched.
    const footswitch = (dry, wet, dryOn) => (on) => (glideTo(dry.gain, on === "on" ? dryOn() : 1, 0.01), glideTo(wet.gain, on === "on" ? 1 : 0, 0.01));
    switch (m.type) {
      case "osc": {
        const o = ac.createOscillator();
        o.type = p.wave;
        const base = () => (voice && voice.note != null && isPitched(m.id) ? midiHz(voice.note) : FREE_HZ) * 2 ** (inst.m.p.tune / 12);
        if (voice && voice.from != null && voice.note != null && p.glide > 0.001 && isPitched(m.id)) {
          // Glide: start on the note before and slide to this one.
          o.frequency.setValueAtTime(midiHz(voice.from) * 2 ** (p.tune / 12), voice.at);
          o.frequency.exponentialRampToValueAtTime(base(), voice.at + p.glide);
        } else o.frequency.value = base();
        o.detune.value = p.fine;
        const bend = depthInto(o.detune, p.bend);
        o.start(voice ? voice.at : 0);
        inst.outs.out = o;
        inst.ins.mod = bend;
        inst.set = (k, v) => {
          if (k === "wave") o.type = v;
          else if (k === "tune") glideTo(o.frequency, base());
          else if (k === "fine") glideTo(o.detune, v);
          else if (k === "bend") glideTo(bend.gain, v);
        };
        inst.stop = (t) => o.stop(t);
        inst.nodes = [o, bend];
        break;
      }
      case "noise": {
        const s = ac.createBufferSource();
        s.buffer = noiseBuf;
        s.loop = true;
        s.loopStart = Math.random();
        const g = ac.createGain();
        g.gain.value = p.level;
        s.connect(g);
        s.start(voice ? voice.at : 0, Math.random() * 1.5);
        inst.outs.out = g;
        inst.set = (k, v) => k === "level" && glideTo(g.gain, v);
        inst.stop = (t) => s.stop(t);
        inst.nodes = [s, g];
        break;
      }
      case "mixer": {
        const out = ac.createGain();
        const ch = {};
        for (const k of ["a", "b", "c"]) {
          ch[k] = ac.createGain();
          ch[k].gain.value = p[k];
          ch[k].connect(out);
          inst.ins[k] = ch[k];
        }
        inst.outs.out = out;
        inst.set = (k, v) => ch[k] && glideTo(ch[k].gain, v);
        inst.nodes = [out, ...Object.values(ch)];
        break;
      }
      case "filter": {
        const f = ac.createBiquadFilter();
        f.type = p.type;
        f.frequency.value = p.cutoff;
        f.Q.value = p.res;
        const cut = depthInto(f.detune, p.depth);
        inst.ins.in = f;
        inst.ins.cut = cut;
        inst.outs.out = f;
        inst.filter = f;
        inst.set = (k, v) => {
          if (k === "type") f.type = v;
          else if (k === "cutoff") glideTo(f.frequency, v);
          else if (k === "res") glideTo(f.Q, v);
          else if (k === "depth") glideTo(cut.gain, v);
        };
        inst.nodes = [f, cut];
        break;
      }
      case "amp": {
        const g = ac.createGain();
        const lvl = depthInto(g.gain, p.gain);
        const ruled = () => cablesInto(patch, m.id, "level").length > 0;
        g.gain.value = ruled() ? 0 : p.gain;
        inst.ins.in = g;
        inst.ins.level = lvl;
        inst.outs.out = g;
        inst.set = (k, v) => {
          if (k !== "gain") return;
          glideTo(lvl.gain, v);
          if (!ruled()) glideTo(g.gain, v);
        };
        inst.nodes = [g, lvl];
        break;
      }
      case "env": {
        const c = ac.createConstantSource();
        c.offset.value = 0;
        c.start(voice ? voice.at : 0);
        inst.outs.out = c;
        inst.gateOn = (t) => {
          const { a, d, s } = inst.m.p;
          const o = c.offset;
          o.cancelScheduledValues(t);
          o.setValueAtTime(o.value, t);
          o.linearRampToValueAtTime(1, t + a);
          o.setTargetAtTime(s, t + a, d / 3);
        };
        inst.gateOff = (t) => {
          const o = c.offset;
          o.cancelScheduledValues(t);
          o.setValueAtTime(o.value, t);
          o.setTargetAtTime(0, t, inst.m.p.r / 4);
        };
        inst.stop = (t) => c.stop(t);
        inst.nodes = [c];
        break;
      }
      case "lfo": {
        const o = ac.createOscillator();
        o.type = p.wave;
        o.frequency.value = p.rate;
        o.start();
        inst.outs.out = o;
        inst.set = (k, v) => (k === "wave" ? (o.type = v) : k === "rate" && glideTo(o.frequency, v, 0.03));
        inst.stop = (t) => o.stop(t);
        inst.nodes = [o];
        break;
      }
      case "delay": {
        const inp = ac.createGain(),
          out = ac.createGain(),
          dry = ac.createGain(),
          wet = ac.createGain(),
          line = ac.createDelay(2),
          fb = ac.createGain(),
          tone = ac.createBiquadFilter();
        tone.type = "lowpass";
        tone.frequency.value = 5200;
        line.delayTime.value = p.time;
        fb.gain.value = p.feedback;
        dry.gain.value = 1 - p.mix * 0.5;
        wet.gain.value = p.mix;
        inp.connect(dry).connect(out);
        inp.connect(line).connect(tone).connect(fb).connect(line);
        tone.connect(wet).connect(out);
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.set = (k, v) => {
          if (k === "time") glideTo(line.delayTime, v, 0.05);
          else if (k === "feedback") glideTo(fb.gain, v);
          else if (k === "mix") (glideTo(wet.gain, v), glideTo(dry.gain, 1 - v * 0.5));
        };
        inst.nodes = [inp, out, dry, wet, line, fb, tone];
        break;
      }
      case "out": {
        const g = ac.createGain();
        g.gain.value = p.volume * 0.6;
        g.connect(master);
        inst.ins.in = g;
        inst.outs.out = g;
        inst.set = (k, v) => k === "volume" && glideTo(g.gain, v * 0.6);
        inst.nodes = [g];
        break;
      }
      case "keys":
        break;

      // ---- the voice ----
      case "mic": {
        const pre = G(1),
          g = G(p.on === "on" ? p.level : 0);
        pre.connect(g);
        inst.outs.out = g;
        inst.monitor = pre; // the card shows the level even while the mic is off
        inst.persistent = true;
        inst.mic = { src: null, status: offline ? "none" : "off" };
        const attach = (stream) => {
          if (inst.dead || !stream || inst.mic.src) return;
          try {
            inst.mic.src = ac.createMediaStreamSource(stream);
            inst.mic.src.connect(pre);
            inst.mic.status = "live";
          } catch {
            inst.mic.status = "denied";
          }
          changed();
        };
        const want = () => {
          if (offline || inst.mic.src) return;
          if (MIC.stream) return attach(MIC.stream);
          inst.mic.status = "asking";
          changed();
          requestMic().then((stream) => {
            if (stream) attach(stream);
            else ((inst.mic.status = MIC.status), changed());
          });
        };
        if (p.on === "on") want();
        inst.set = (k, v) => {
          const pp = inst.m.p;
          if (k === "level") glideTo(g.gain, pp.on === "on" ? v : 0);
          else if (k === "on") (glideTo(g.gain, v === "on" ? pp.level : 0), v === "on" && want());
        };
        inst.sync = () => ((g.gain.value = inst.m.p.on === "on" ? inst.m.p.level : 0), inst.m.p.on === "on" && want());
        inst.state = () => ({ on: inst.m.p.on === "on", status: inst.mic.src ? "live" : inst.mic.status });
        inst.detach = () => g.disconnect();
        inst.stop = () => {
          inst.dead = true;
          try {
            inst.mic.src?.disconnect();
          } catch {}
        };
        inst.nodes = [pre, g];
        break;
      }
      case "looper": {
        const inp = G(1),
          out = G(1),
          thru = G(p.thru),
          loopG = G(p.level);
        inp.connect(thru).connect(out);
        loopG.connect(out);
        const L = { mode: "idle", layers: [], length: 0, start: 0, rec: null, chunks: [], node: null, ready: null, timers: [] };
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.monitor = out;
        inst.persistent = true;
        const latency = () => (ac.outputLatency || 0) + (ac.baseLatency || 0);
        const position = (t = now()) => (L.length ? (((t - L.start) % L.length) + L.length) % L.length : 0);
        const setMode = (mode) => ((L.mode = mode), changed());
        // The worklet that listens to the input, made on the first press.
        const recorder = () => {
          if (L.ready) return L.ready;
          L.ready = recorderReady(ac).then((ok) => {
            if (!ok || inst.dead) return null;
            const node = new AudioWorkletNode(ac, "sg-recorder", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
            inp.connect(node);
            node.connect(sink);
            node.port.onmessage = (e) => {
              const d = e.data;
              if (d?.stopped != null) finish();
              else if (L.rec && d?.data) L.chunks.push(d);
            };
            return (L.node = node);
          });
          return L.ready;
        };
        // What was heard between `from` and `to`, from the timed pieces (a gap before the first piece is silence).
        const gather = (from, to) => {
          const rate = ac.sampleRate;
          const n = Math.max(1, Math.round((to - from) * rate));
          const outBuf = new Float32Array(n);
          for (const c of L.chunks) {
            const at = Math.round((c.t - from) * rate);
            for (let i = 0; i < c.data.length; i++) {
              const j = at + i;
              if (j >= 0 && j < n) outBuf[j] = c.data[i];
            }
          }
          return outBuf;
        };
        const startLayer = (samples, when, offset) => {
          const b = ac.createBuffer(1, samples.length, ac.sampleRate);
          b.copyToChannel(samples, 0);
          const src = ac.createBufferSource();
          src.buffer = b;
          src.loop = true;
          src.connect(loopG);
          src.start(when, offset);
          L.layers.push({ src, at: when });
        };
        const beginRec = (from) => {
          L.chunks = [];
          L.rec = { from, to: null };
          L.node?.port.postMessage("start");
        };
        const endRec = (to) => {
          if (!L.rec) return;
          L.rec.to = to;
          L.node?.port.postMessage("stop");
        };
        // The recording stopped: it becomes a layer. The first one sets the loop and starts it where it ended.
        const finish = () => {
          const r = L.rec;
          if (!r || r.to == null || inst.dead) return;
          L.rec = null;
          const t = now();
          if (!L.length) {
            L.length = Math.max(0.05, r.to - r.from);
            L.start = r.to;
            startLayer(gather(r.from, r.to), t, position(t));
          } else {
            const frames = Math.round(L.length * ac.sampleRate);
            const off = Math.round(layerOffset(r.from, L.start, L.length, latency()) * ac.sampleRate);
            startLayer(placeLayer(gather(r.from, r.to), frames, off), t, position(t));
          }
          L.chunks = [];
          setMode("playing");
        };
        const clearTimers = () => (L.timers.forEach(clearTimeout), (L.timers = []));
        const later = (at, f) => L.timers.push(setTimeout(f, Math.max(0, (at - now()) * 1000)));
        inst.act = (name, t = now()) => {
          if (offline) return;
          const sync = inst.m.p.sync;
          if (name === "undo") {
            if (L.rec) return; // not while recording
            const last = L.layers.pop();
            try {
              last?.src.stop();
            } catch {}
            const next = afterUndo(L.mode, L.layers.length);
            if (next === "idle") (L.length = 0), (L.start = 0);
            return setMode(next);
          }
          if (name === "clear") {
            clearTimers();
            if (L.rec) (L.node?.port.postMessage("stop"), (L.rec = null));
            for (const l of L.layers)
              try {
                l.src.stop();
              } catch {}
            L.layers = [];
            L.length = 0;
            L.start = 0;
            L.chunks = [];
            return setMode("idle");
          }
          if (name !== "press") return;
          const next = afterPress(L.mode, sync);
          if (L.mode === "idle" && next === "recording") {
            setMode("armed");
            return recorder().then((node) => {
              if (!node || inst.dead) return setMode("idle");
              if (L.mode !== "armed") return;
              beginRec(now()); // from when the recorder is listening, not from the press (the first time, that is a moment later)
              setMode("recording");
            });
          }
          if (L.mode === "idle" && next === "armed") {
            const bars = Number(sync) || 1;
            const g = opts.grid?.() || null;
            const from = g?.next != null && g.next > t ? g.next : t + 0.05;
            const len = bars * (g?.bar || 2);
            setMode("armed");
            return recorder().then((node) => {
              if (!node || inst.dead || L.mode !== "armed") return;
              later(from - 0.04, () => {
                if (L.mode !== "armed") return;
                beginRec(from);
                setMode("recording");
                later(from + len + 0.02, () => L.rec && endRec(from + len));
              });
            });
          }
          if (L.mode === "armed") return (clearTimers(), setMode("idle"));
          if (L.mode === "recording") return sync === "free" ? endRec(t) : undefined;
          if (L.mode === "playing")
            return recorder().then((node) => {
              if (!node || inst.dead) return;
              beginRec(now());
              setMode("overdub");
            });
          if (L.mode === "overdub") return endRec(t);
        };
        inst.set = (k, v) => (k === "thru" ? glideTo(thru.gain, v) : k === "level" ? glideTo(loopG.gain, v) : undefined);
        inst.sync = () => ((thru.gain.value = inst.m.p.thru), (loopG.gain.value = inst.m.p.level));
        inst.state = () => ({ mode: L.mode, layers: L.layers.length, length: L.length, start: L.start, position: L.length ? position() / L.length : 0, recording: !!L.rec });
        inst.detach = () => out.disconnect();
        inst.stop = () => {
          inst.dead = true;
          clearTimers();
          for (const l of L.layers)
            try {
              l.src.stop();
            } catch {}
          L.layers = [];
          try {
            L.node?.disconnect();
          } catch {}
        };
        inst.nodes = [inp, out, thru, loopG];
        break;
      }

      // ---- the pedals: each has a dry path and a wet path, and a footswitch between them ----
      case "drive": {
        const inp = G(1),
          out = G(1),
          dry = G(0),
          wet = G(1),
          pre = G(1 + p.drive * 9),
          shaper = ac.createWaveShaper(),
          tone = ac.createBiquadFilter(),
          lvl = G(p.level);
        shaper.curve = DRIVE_CURVE;
        shaper.oversample = "2x";
        tone.type = "lowpass";
        tone.frequency.value = p.tone;
        inp.connect(dry).connect(out);
        inp.connect(pre).connect(shaper).connect(tone).connect(lvl).connect(wet).connect(out);
        const sw = footswitch(dry, wet, () => 0);
        sw(p.on);
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.set = (k, v) => {
          if (k === "on") sw(v);
          else if (k === "drive") glideTo(pre.gain, 1 + v * 9);
          else if (k === "tone") glideTo(tone.frequency, v);
          else if (k === "level") glideTo(lvl.gain, v);
        };
        inst.nodes = [inp, out, dry, wet, pre, shaper, tone, lvl];
        break;
      }
      case "reverb": {
        const inp = G(1),
          out = G(1),
          dry = G(1 - p.mix * 0.5),
          wet = G(1),
          mixG = G(p.mix),
          conv = ac.createConvolver();
        conv.buffer = impulse(ac, p.size);
        inp.connect(dry).connect(out);
        inp.connect(conv).connect(mixG).connect(wet).connect(out);
        const sw = footswitch(dry, wet, () => 1 - inst.m.p.mix * 0.5);
        sw(p.on);
        let regen = 0;
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.set = (k, v) => {
          if (k === "on") sw(v);
          else if (k === "mix") (glideTo(mixG.gain, v), inst.m.p.on === "on" && glideTo(dry.gain, 1 - v * 0.5));
          else if (k === "size") {
            // The room is rebuilt once the knob rests.
            clearTimeout(regen);
            regen = setTimeout(() => !inst.dead && (conv.buffer = impulse(ac, inst.m.p.size)), 160);
          }
        };
        inst.stop = () => ((inst.dead = true), clearTimeout(regen));
        inst.nodes = [inp, out, dry, wet, mixG, conv];
        break;
      }
      case "chorus": {
        const inp = G(1),
          out = G(1),
          dry = G(1),
          wet = G(1),
          mixG = G(p.mix * 0.7),
          d1 = ac.createDelay(0.06),
          d2 = ac.createDelay(0.06),
          lfo = ac.createOscillator(),
          m1 = G(p.depth * 0.004),
          m2 = G(-p.depth * 0.003);
        d1.delayTime.value = 0.014;
        d2.delayTime.value = 0.021;
        lfo.type = "sine";
        lfo.frequency.value = p.rate;
        lfo.connect(m1).connect(d1.delayTime);
        lfo.connect(m2).connect(d2.delayTime);
        lfo.start();
        inp.connect(dry).connect(out);
        inp.connect(d1).connect(mixG);
        inp.connect(d2).connect(mixG);
        mixG.connect(wet).connect(out);
        const sw = footswitch(dry, wet, () => 1);
        sw(p.on);
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.set = (k, v) => {
          if (k === "on") sw(v);
          else if (k === "rate") glideTo(lfo.frequency, v, 0.03);
          else if (k === "depth") (glideTo(m1.gain, v * 0.004), glideTo(m2.gain, -v * 0.003));
          else if (k === "mix") glideTo(mixG.gain, v * 0.7);
        };
        inst.stop = (t) => lfo.stop(t);
        inst.nodes = [inp, out, dry, wet, mixG, d1, d2, lfo, m1, m2];
        break;
      }
      case "trem": {
        const inp = G(1),
          out = G(1),
          g = G(1 - p.depth / 2),
          lfo = ac.createOscillator(),
          depth = G(p.depth / 2);
        lfo.type = "sine";
        lfo.frequency.value = p.rate;
        lfo.connect(depth).connect(g.gain);
        lfo.start();
        inp.connect(g).connect(out);
        const apply = () => {
          const on = inst.m.p.on === "on";
          glideTo(g.gain, on ? 1 - inst.m.p.depth / 2 : 1, 0.01);
          glideTo(depth.gain, on ? inst.m.p.depth / 2 : 0, 0.01);
        };
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.set = (k, v) => (k === "rate" ? glideTo(lfo.frequency, v, 0.03) : apply());
        inst.stop = (t) => lfo.stop(t);
        inst.nodes = [inp, out, g, lfo, depth];
        break;
      }
      case "wah": {
        const inp = G(1),
          out = G(1),
          dry = G(0),
          wet = G(1),
          f = ac.createBiquadFilter(),
          make = G(2.2),
          lfo = ac.createOscillator(),
          sweep = G(0),
          rect = ac.createWaveShaper(),
          lp = ac.createBiquadFilter(),
          touch = G(0);
        f.type = "bandpass";
        f.frequency.value = 520;
        f.Q.value = p.res;
        lfo.type = "sine";
        lfo.frequency.value = p.rate;
        lfo.connect(sweep).connect(f.detune);
        lfo.start();
        rect.curve = ABS_CURVE;
        lp.type = "lowpass";
        lp.frequency.value = 9;
        inp.connect(rect).connect(lp).connect(touch).connect(f.detune);
        inp.connect(dry).connect(out);
        inp.connect(f).connect(make).connect(wet).connect(out);
        const mode = () => ((inst.m.p.mode === "sweep" ? (glideTo(sweep.gain, 1500, 0.03), glideTo(touch.gain, 0, 0.03)) : (glideTo(sweep.gain, 0, 0.03), glideTo(touch.gain, 5200, 0.03))), undefined);
        mode();
        const sw = footswitch(dry, wet, () => 0);
        sw(p.on);
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.filter = f;
        inst.set = (k, v) => {
          if (k === "on") sw(v);
          else if (k === "mode") mode();
          else if (k === "rate") glideTo(lfo.frequency, v, 0.03);
          else if (k === "res") glideTo(f.Q, v);
        };
        inst.stop = (t) => lfo.stop(t);
        inst.nodes = [inp, out, dry, wet, f, make, lfo, sweep, rect, lp, touch];
        break;
      }
      case "pitch": {
        const inp = G(1),
          out = G(1),
          dry = G(1 - p.mix),
          wet = G(1),
          mixG = G(p.mix),
          dA = ac.createDelay(1),
          dB = ac.createDelay(1),
          gA = G(0),
          gB = G(0),
          kA = G(0),
          kB = G(0);
        const bufs = shiftBuffers(ac);
        const srcs = ["rampA", "fadeA", "rampB", "fadeB"].map((name) => {
          const src = ac.createBufferSource();
          src.buffer = bufs[name];
          src.loop = true;
          return src;
        });
        srcs[0].connect(kA).connect(dA.delayTime);
        srcs[2].connect(kB).connect(dB.delayTime);
        srcs[1].connect(gA.gain);
        srcs[3].connect(gB.gain);
        const t0 = ac.currentTime + 0.01;
        for (const src of srcs) src.start(t0);
        inp.connect(dry).connect(out);
        inp.connect(dA).connect(gA).connect(mixG);
        inp.connect(dB).connect(gB).connect(mixG);
        mixG.connect(wet).connect(out);
        // delay(t) = base + a·ramp(t): a ramp that shortens the delay raises the pitch, one that lengthens it lowers it.
        const shift = (semis, glide = 0.012) => {
          const ratio = 2 ** (semis / 12);
          const a = GRAIN * (1 - ratio),
            base = Math.max(0, -a);
          glideTo(kA.gain, a, glide);
          glideTo(kB.gain, a, glide);
          glideTo(dA.delayTime, base, glide);
          glideTo(dB.delayTime, base, glide);
        };
        shift(p.semis, 0.001);
        const sw = footswitch(dry, wet, () => 1 - inst.m.p.mix);
        sw(p.on);
        inst.ins.in = inp;
        inst.outs.out = out;
        inst.set = (k, v) => {
          if (k === "on") sw(v);
          else if (k === "semis") shift(v);
          else if (k === "mix") (glideTo(mixG.gain, v), inst.m.p.on === "on" && glideTo(dry.gain, 1 - v));
        };
        inst.stop = (t) => srcs.forEach((src) => src.stop(t));
        inst.nodes = [inp, out, dry, wet, mixG, dA, dB, gA, gB, kA, kB, ...srcs];
        break;
      }
    }
    return inst;
  }
  const isPitched = (id) => patch && patch.cables.some((c) => c.to[0] === id && c.to[1] === "pitch" && moduleOf(patch, c.from[0])?.type === "keys");

  // Which modules are shared: the LFO, the echo, the speaker, the microphone, the looper and the
  // pedals, and anything their audio reaches (a filter after the looper is one filter, not one a key).
  function sharedIds() {
    const ids = new Set(patch.modules.filter((m) => defOf(m.type)?.global && m.type !== "out").map((m) => m.id));
    ids.add("out");
    const grow = (id) => {
      for (const c of cablesFrom(patch, id)) {
        const b = moduleOf(patch, c.to[0]);
        if (b && !ids.has(b.id) && moduleOf(patch, id)?.type !== "lfo") (ids.add(b.id), grow(b.id));
      }
    };
    for (const m of patch.modules) if (defOf(m.type)?.global && m.type !== "lfo" && m.type !== "out") grow(m.id);
    return ids;
  }

  // Wire one cable between two instances. A swinging signal into an amp's Level is lifted to 0..1.
  function wire(c, src, dst, through = null) {
    const out = src?.outs[c.from[1]],
      inp = dst?.ins[c.to[1]];
    if (!out || !inp) return [];
    const made = [];
    const target = inp;
    let from = out;
    if (through) {
      from.connect(through);
      from = through;
    }
    if (dst.m.type === "amp" && c.to[1] === "level" && BIPOLAR.has(src.m.type)) {
      const half = ac.createGain();
      half.gain.value = 0.5;
      from.connect(half);
      half.connect(target);
      const lift = ac.createGain();
      lift.gain.value = 0.5;
      one.connect(lift);
      lift.connect(target);
      made.push(half, lift);
    } else from.connect(target);
    return made;
  }

  function buildVoice(note, at) {
    const voice = { note, at, off: null, inst: new Map(), extra: [], dead: false, from: lastNote };
    if (note != null) lastNote = note;
    for (const m of patch.modules) if (!globalIds.has(m.id)) voice.inst.set(m.id, make(m, voice));
    // Per-voice cables, and per-voice signals into shared modules (through the voice's gate).
    const outsToShared = new Map();
    for (const c of patch.cables) {
      const fromShared = globalIds.has(c.from[0]),
        toShared = globalIds.has(c.to[0]);
      if (fromShared && toShared) continue;
      const src = fromShared ? global.get(c.from[0]) : voice.inst.get(c.from[0]);
      const dst = toShared ? global.get(c.to[0]) : voice.inst.get(c.to[0]);
      if (!src || !dst || moduleOf(patch, c.from[0])?.type === "keys") continue;
      let through = null;
      if (!fromShared && toShared) {
        const key = c.from.join(".");
        if (!outsToShared.has(key)) {
          const g = ac.createGain();
          g.gain.value = 0;
          outsToShared.set(key, g);
          voice.extra.push(g);
        }
        through = outsToShared.get(key);
      }
      voice.extra.push(...wire(c, src, dst, through));
    }
    voice.gates = [...outsToShared.values()];
    return voice;
  }
  const tailOf = () => {
    let r = 0.02;
    for (const m of patch.modules) if (m.type === "env" && cablesInto(patch, m.id, "gate").length) r = Math.max(r, m.p.r * 1.6);
    return r;
  };
  function openVoice(v, t) {
    for (const g of v.gates) (g.gain.cancelScheduledValues(t), g.gain.setValueAtTime(0, t), g.gain.linearRampToValueAtTime(1, t + 0.004));
    for (const c of patch.cables)
      if (moduleOf(patch, c.from[0])?.type === "keys" && c.from[1] === "gate") (voice(v, c.to[0])?.gateOn(t));
  }
  const voice = (v, id) => v.inst.get(id) || global.get(id);
  function closeVoice(v, t, quick = false) {
    if (v.off != null && !quick) return;
    v.off = t;
    for (const c of patch.cables) if (moduleOf(patch, c.from[0])?.type === "keys" && c.from[1] === "gate") voice(v, c.to[0])?.gateOff(t);
    const end = t + (quick ? 0.02 : tailOf());
    for (const g of v.gates) (g.gain.cancelScheduledValues(t), g.gain.setValueAtTime(g.gain.value, t), quick ? g.gain.linearRampToValueAtTime(0, end) : g.gain.setTargetAtTime(0, end - 0.02, 0.008));
    const done = end + 0.1;
    if (offline) {
      // Nothing is dropped while rendering: the sources just stop when the note has died away.
      for (const inst of v.inst.values())
        try {
          inst.stop(done);
        } catch {}
      return;
    }
    setTimeout(() => drop(v, done), (done - now()) * 1000 + 60);
  }
  function drop(v) {
    if (v.dead) return;
    v.dead = true;
    for (const inst of v.inst.values()) {
      try {
        inst.stop(now());
      } catch {}
      for (const n of inst.nodes) n.disconnect?.();
    }
    for (const n of v.extra) n.disconnect?.();
    voices = voices.filter((x) => x !== v);
    if (monitor === v) watch(voices[voices.length - 1] || null);
  }

  // The pictures: one analyser per module, fed by the newest voice (or the shared instance).
  function tap(id) {
    if (!taps.has(id)) {
      const a = ac.createAnalyser();
      a.fftSize = 2048;
      a.smoothingTimeConstant = 0.5;
      a.connect(sink);
      taps.set(id, a);
    }
    return taps.get(id);
  }
  function watch(v) {
    for (const [n, a] of tapped)
      try {
        n.disconnect(a);
      } catch {}
    tapped = [];
    monitor = v;
    const add = (inst) => {
      const n = inst?.monitor || inst?.outs.out;
      if (n) (n.connect(tap(inst.m.id)), tapped.push([n, tap(inst.m.id)]));
    };
    if (v) for (const inst of v.inst.values()) add(inst);
    for (const inst of global.values()) add(inst);
  }

  // Start again from this patch: every voice ends, the shared modules are made anew. The ones
  // that hold something (the microphone's stream, the looper's layers) are kept if the patch
  // still has them: unplugged, then wired in again.
  function load(next) {
    patch = next;
    if (!ensure()) return;
    const t = now();
    for (const v of [...voices]) (closeVoice(v, t, true), drop(v));
    const keepers = new Map();
    for (const [id, inst] of global) {
      const still = inst.persistent && moduleOf(patch, id)?.type === inst.m.type;
      if (still) {
        inst.detach?.();
        keepers.set(id, inst);
        continue;
      }
      try {
        inst.stop(t);
      } catch {}
      for (const n of inst.nodes) n.disconnect?.();
    }
    global = new Map();
    globalIds = sharedIds();
    for (const m of patch.modules)
      if (globalIds.has(m.id)) {
        const kept = keepers.get(m.id);
        if (kept) {
          kept.m = m;
          kept.sync?.();
          global.set(m.id, kept);
        } else global.set(m.id, make(m, null));
      }
    for (const c of patch.cables) if (globalIds.has(c.from[0]) && globalIds.has(c.to[0])) wire(c, global.get(c.from[0]), global.get(c.to[0]));
    held.clear();
    if (!keyed(patch)) {
      // No keyboard: one voice, always on, if anything reaches the speaker.
      const v = buildVoice(null, t);
      voices.push(v);
      openVoice(v, t);
    }
    watch(voices[voices.length - 1] || null);
  }

  const held = new Map(); // note → voice
  let lastNote = null;
  // Eight voices at most: a new one takes the place of the oldest (one already let go, if there is one).
  function steal(t) {
    if (offline) return;
    const live = voices.filter((v) => !v.dead);
    if (live.length < VOICES) return;
    const old = live.find((v) => v.off != null) || live[0];
    closeVoice(old, t, true);
    for (const [n, v] of held) if (v === old) held.delete(n);
  }
  function noteOn(note) {
    if (!patch || !ensure()) return;
    resume();
    if (!keyed(patch)) return;
    if (held.has(note)) noteOff(note);
    const t = now() + 0.005;
    steal(t);
    const v = buildVoice(note, t);
    voices.push(v);
    held.set(note, v);
    openVoice(v, t);
    watch(v);
  }
  function noteOff(note) {
    const v = held.get(note);
    if (!v) return;
    held.delete(note);
    closeVoice(v, now());
  }
  // A note from the loop: it starts at `at` (the clock's seconds) and is let go `length` seconds later.
  function trigger(note, at, length) {
    if (!patch || !ensure() || !keyed(patch)) return;
    const t = Math.max(at, now());
    steal(t);
    const v = buildVoice(note, t);
    voices.push(v);
    openVoice(v, t);
    closeVoice(v, t + Math.max(0.02, length));
    // The pictures follow it once it sounds, not before.
    if (!offline) setTimeout(() => !v.dead && watch(v), Math.max(0, (t - now()) * 1000));
  }
  function allOff() {
    for (const n of [...held.keys()]) noteOff(n);
  }
  // A press on a card's button (the Looper's), and what a card shows of its module's state.
  const act = (id, name) => (ac ? global.get(id)?.act?.(name, now()) : undefined);
  const state = (id) => global.get(id)?.state?.() || null;
  // A knob moved: every copy of the module follows.
  function set(id, key, value, nextPatch) {
    if (nextPatch) patch = nextPatch;
    if (!ac) return;
    const m = moduleOf(patch, id);
    for (const inst of [global.get(id), ...voices.map((v) => v.inst.get(id))]) if (inst && m) ((inst.m = m), inst.set(key, value));
  }
  function resume() {
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }
  function mute(on) {
    muted = on;
    if (master) glideTo(master.gain, on ? 0 : 0.9, 0.03);
  }
  // What a card draws. kind "wave": the last moments of the signal; "level": its value now; "spectrum": its frequencies (dB).
  const buf = new Float32Array(2048);
  function read(id, kind = "wave") {
    const a = taps.get(id);
    if (!a || !ac) return null;
    if (kind === "spectrum") {
      const f = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(f);
      return f;
    }
    a.getFloatTimeDomainData(buf);
    return kind === "level" ? buf[buf.length - 1] : buf;
  }
  // The filter's shape as the ear hears it now: its response at these frequencies.
  // With no note sounding, a stand-in filter set to the knobs answers instead.
  let shadow = null;
  function response(id, freqs, m) {
    const inst = (monitor && !monitor.dead && monitor.inst.get(id)) || global.get(id);
    let f = inst?.filter;
    if (!f) {
      if (!ac || !m) return null;
      shadow ||= ac.createBiquadFilter();
      shadow.type = m.p.type;
      shadow.frequency.value = m.p.cutoff;
      shadow.Q.value = m.p.res;
      f = shadow;
    }
    const mag = new Float32Array(freqs.length),
      ph = new Float32Array(freqs.length);
    f.getFrequencyResponse(freqs, mag, ph);
    return mag;
  }
  // For the envelope's dot: when the newest voice's key went down (and up), in the clock's seconds.
  const phase = () => (monitor && ac ? { on: monitor.at, off: monitor.off, now: now(), note: monitor.note } : null);
  const notes = () => [...held.keys()];
  function close() {
    if (sharedCtx) {
      const t = ac ? now() : 0;
      for (const v of [...voices]) drop(v);
      for (const inst of global.values()) {
        try {
          inst.stop(t);
        } catch {}
        for (const n of inst.nodes) n.disconnect?.();
      }
      for (const a of taps.values()) a.disconnect();
      master?.disconnect();
    } else
      try {
        ac?.close();
      } catch {}
    ac = null;
    voices = [];
    global = new Map();
    taps = new Map();
    shadow = null;
    held.clear();
  }
  return { load, set, act, state, noteOn, noteOff, trigger, allOff, get patch() { return patch; }, resume, mute, read, response, phase, notes, close, heard: () => (patch ? heard(patch) : new Set()), get ready() { return !!ac; }, get rate() { return ac?.sampleRate || 48000; }, get latency() { return ac ? (ac.outputLatency || 0) + (ac.baseLatency || 0) : 0; } };
}
