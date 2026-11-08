// Signal's modules: what each one is called, what it says it does, its jacks and its knobs.
// The synthesizer's modules come first; then the voice and the pedals (the master class, sessions
// 8 to 10): the Microphone, the Looper and six pedals, all shared by every voice (one of each plays
// for the whole board). A module can carry `actions`: buttons on its card (the Looper's Record).
// Four kinds of signal run through the cables:
// - audio: a wave fast enough to hear (oscillators, noise, and whatever filters and amps make of them)
// - mod: a slower signal that moves a knob (envelopes, LFOs; an audio wave works too, which is FM)
// - pitch: the note the keyboard is playing
// - gate: on while a key is held
// An output plugs into an input of its own kind; an audio output also plugs into a mod input.

export const KINDS = ["audio", "mod", "pitch", "gate"];
export const fits = (out, inp) => out === inp || (out === "audio" && inp === "mod");

// A knob: min, max, def, the curve its travel follows ("exp" for frequencies and times), a step,
// and how its value reads. A choice: options, def. `when` shows a knob only while that input has a cable.
const hz = (v) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} kHz` : `${v >= 100 ? Math.round(v) : v.toFixed(1)} Hz`);
const sec = (v) => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
const pct = (v) => `${Math.round(v * 100)}%`;
const cents = (v) => `${v < 0 ? "−" : ""}${Math.abs(Math.round(v))} cents`;
const semis = (v) => (v === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(v)}`);
export const FREE_HZ = 220; // an oscillator with no keyboard plays A3, moved by its Tune

export const MODULES = {
  keys: {
    name: "Keyboard",
    line: "Sends the note you play (Pitch) and whether a key is held (Gate).",
    ins: [],
    outs: [
      { id: "pitch", kind: "pitch", label: "Pitch" },
      { id: "gate", kind: "gate", label: "Gate" },
    ],
    params: {},
    single: true,
  },
  osc: {
    name: "Oscillator",
    line: "Makes a wave: the raw sound.",
    ins: [
      { id: "pitch", kind: "pitch", label: "Pitch" },
      { id: "mod", kind: "mod", label: "Bend" },
    ],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      wave: { label: "Wave", options: ["sine", "triangle", "sawtooth", "square"], def: "sine" },
      tune: { label: "Tune", min: -24, max: 24, def: 0, step: 1, read: semis },
      fine: { label: "Fine", min: -50, max: 50, def: 0, step: 1, read: cents },
      bend: { label: "Bend depth", min: 0, max: 4800, def: 100, step: 1, curve: "sq", read: cents, when: "mod" },
      glide: { label: "Glide", min: 0, max: 1, def: 0, curve: "sq", read: sec, when: "pitch" },
    },
  },
  noise: {
    name: "Noise",
    line: "Every frequency at once: a hiss with no pitch.",
    ins: [],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      level: { label: "Level", min: 0, max: 1, def: 0.5, read: pct },
    },
  },
  mixer: {
    name: "Mixer",
    line: "Adds up to three signals, each at its own level.",
    ins: [
      { id: "a", kind: "audio", label: "1" },
      { id: "b", kind: "audio", label: "2" },
      { id: "c", kind: "audio", label: "3" },
    ],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      a: { label: "1", min: 0, max: 1, def: 0.7, read: pct },
      b: { label: "2", min: 0, max: 1, def: 0.7, read: pct },
      c: { label: "3", min: 0, max: 1, def: 0.7, read: pct },
    },
  },
  filter: {
    name: "Filter",
    line: "Takes away the frequencies above its cutoff (or below, or both sides).",
    ins: [
      { id: "in", kind: "audio", label: "In" },
      { id: "cut", kind: "mod", label: "Cutoff" },
    ],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      type: { label: "Type", options: ["lowpass", "bandpass", "highpass"], def: "lowpass", names: { lowpass: "Low", bandpass: "Band", highpass: "High" } },
      cutoff: { label: "Cutoff", min: 40, max: 16000, def: 2000, curve: "exp", read: hz },
      res: { label: "Resonance", min: 0.5, max: 24, def: 1, curve: "exp", read: (v) => v.toFixed(1) },
      depth: { label: "Depth", min: 0, max: 6000, def: 2400, step: 1, curve: "sq", read: cents, when: "cut" },
    },
  },
  amp: {
    name: "Amp",
    line: "Sets how loud. With a signal in Level, that signal decides.",
    ins: [
      { id: "in", kind: "audio", label: "In" },
      { id: "level", kind: "mod", label: "Level" },
    ],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      gain: { label: "Gain", min: 0, max: 1, def: 0.8, read: pct },
    },
  },
  env: {
    name: "Envelope",
    line: "A shape in time, started by the gate: attack, decay, sustain, release.",
    ins: [{ id: "gate", kind: "gate", label: "Gate" }],
    outs: [{ id: "out", kind: "mod", label: "Out" }],
    params: {
      a: { label: "Attack", min: 0.002, max: 4, def: 0.01, curve: "exp", read: sec },
      d: { label: "Decay", min: 0.01, max: 4, def: 0.3, curve: "exp", read: sec },
      s: { label: "Sustain", min: 0, max: 1, def: 0.7, read: pct },
      r: { label: "Release", min: 0.01, max: 6, def: 0.4, curve: "exp", read: sec },
    },
  },
  lfo: {
    name: "LFO",
    line: "A wave too slow to hear, for moving other knobs.",
    ins: [],
    outs: [{ id: "out", kind: "mod", label: "Out" }],
    params: {
      wave: { label: "Wave", options: ["sine", "triangle", "sawtooth", "square"], def: "sine" },
      rate: { label: "Rate", min: 0.05, max: 30, def: 4, curve: "exp", read: hz },
    },
    global: true,
  },
  delay: {
    name: "Echo",
    line: "Plays the signal again a moment later; feedback sends the copy round again.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      time: { label: "Time", min: 0.02, max: 1.5, def: 0.33, curve: "exp", read: sec },
      feedback: { label: "Feedback", min: 0, max: 0.9, def: 0.4, read: pct },
      mix: { label: "Mix", min: 0, max: 1, def: 0.35, read: pct },
    },
    global: true,
  },
  out: {
    name: "Speaker",
    line: "Whatever reaches it is what you hear.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [],
    params: {
      volume: { label: "Volume", min: 0, max: 1, def: 0.7, read: pct },
    },
    single: true,
    fixed: true,
    global: true,
  },

  // ---- The voice and the pedals. Each is shared: one of it plays for every voice, like the Echo. ----
  mic: {
    name: "Microphone",
    line: "Your voice, or anything near the computer. Headphones on, or it howls.",
    ins: [],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Mic", options: ["off", "on"], def: "off", names: { off: "Off", on: "On" } },
      level: { label: "Level", min: 0, max: 2, def: 1, read: pct },
    },
    single: true,
    global: true,
    group: "voice",
  },
  looper: {
    name: "Looper",
    line: "Records what comes in and plays it round. One press starts, the next sets the length; then layers go on top.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      sync: { label: "Length", options: ["free", "1", "2", "4"], def: "free", names: { free: "Free", 1: "1 bar", 2: "2 bars", 4: "4 bars" } },
      level: { label: "Loop", min: 0, max: 1, def: 1, read: pct },
      thru: { label: "Through", min: 0, max: 1, def: 1, read: pct },
    },
    actions: [
      { id: "press", label: "Record", key: "L" },
      { id: "undo", label: "Undo layer", key: "⇧L" },
      { id: "clear", label: "Clear" },
      { id: "clock", label: "Set the clock from it" },
    ],
    global: true,
    group: "voice",
  },
  drive: {
    name: "Drive",
    line: "Pushes the signal until it breaks up. Tone takes the fizz off.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Pedal", options: ["on", "off"], def: "on", names: { on: "On", off: "Off" } },
      drive: { label: "Drive", min: 0, max: 1, def: 0.4, read: pct },
      tone: { label: "Tone", min: 500, max: 10000, def: 3200, curve: "exp", read: hz },
      level: { label: "Level", min: 0, max: 1, def: 0.7, read: pct },
    },
    global: true,
    group: "pedals",
  },
  reverb: {
    name: "Reverb",
    line: "A room around the sound. Size is how long it rings.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Pedal", options: ["on", "off"], def: "on", names: { on: "On", off: "Off" } },
      size: { label: "Size", min: 0.3, max: 6, def: 1.8, curve: "exp", read: sec },
      mix: { label: "Mix", min: 0, max: 1, def: 0.35, read: pct },
    },
    global: true,
    group: "pedals",
  },
  chorus: {
    name: "Chorus",
    line: "A second copy, a little out of tune and a little late: one voice sounds like several.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Pedal", options: ["on", "off"], def: "on", names: { on: "On", off: "Off" } },
      rate: { label: "Rate", min: 0.1, max: 5, def: 0.8, curve: "exp", read: hz },
      depth: { label: "Depth", min: 0, max: 1, def: 0.5, read: pct },
      mix: { label: "Mix", min: 0, max: 1, def: 0.5, read: pct },
    },
    global: true,
    group: "pedals",
  },
  trem: {
    name: "Tremolo",
    line: "The volume rises and falls on its own, fast or slow.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Pedal", options: ["on", "off"], def: "on", names: { on: "On", off: "Off" } },
      rate: { label: "Rate", min: 0.5, max: 16, def: 5, curve: "exp", read: hz },
      depth: { label: "Depth", min: 0, max: 1, def: 0.7, read: pct },
    },
    global: true,
    group: "pedals",
  },
  wah: {
    name: "Wah",
    line: "A narrow filter that sweeps: on its own, or with how loud you are.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Pedal", options: ["on", "off"], def: "on", names: { on: "On", off: "Off" } },
      mode: { label: "Moved by", options: ["sweep", "touch"], def: "sweep", names: { sweep: "Sweep", touch: "Touch" } },
      rate: { label: "Rate", min: 0.1, max: 8, def: 1.2, curve: "exp", read: hz },
      res: { label: "Resonance", min: 1, max: 20, def: 8, curve: "exp", read: (v) => v.toFixed(1) },
    },
    global: true,
    group: "pedals",
  },
  pitch: {
    name: "Pitch",
    line: "The same sound higher or lower. −12 is an octave down; +7 a fifth up.",
    ins: [{ id: "in", kind: "audio", label: "In" }],
    outs: [{ id: "out", kind: "audio", label: "Out" }],
    params: {
      on: { label: "Pedal", options: ["on", "off"], def: "on", names: { on: "On", off: "Off" } },
      semis: { label: "Shift", min: -24, max: 24, def: -12, step: 1, read: semis },
      mix: { label: "Mix", min: 0, max: 1, def: 1, read: pct },
    },
    global: true,
    group: "pedals",
  },
  // The floor's own object: a note. No jacks and no sound, just words beside the instrument (a lyric,
  // a thought, what to try next). The Ghost Producer reads them and never writes one.
  note: {
    name: "Note",
    line: "Words on the floor: a lyric, a thought, what to try next.",
    ins: [],
    outs: [],
    params: { text: { label: "Note", text: true, def: "", max: 2000 } },
    note: true,
  },
};
// The order of the Add menu, in its groups.
export const ADDABLE = ["osc", "noise", "mixer", "filter", "amp", "env", "lfo", "delay", "keys", "mic", "looper", "drive", "reverb", "chorus", "trem", "wah", "pitch", "note"];
export const GROUPS = [
  { id: "synth", name: "The synthesizer", types: ["osc", "noise", "mixer", "filter", "amp", "env", "lfo", "delay", "keys"] },
  { id: "voice", name: "The voice", types: ["mic", "looper"] },
  { id: "pedals", name: "Pedals", types: ["drive", "reverb", "chorus", "trem", "wah", "pitch"] },
  { id: "floor", name: "The floor", types: ["note"] },
];
export const PEDALS = new Set(["drive", "reverb", "chorus", "trem", "wah", "pitch", "delay"]);
export const actionsOf = (type) => defOf(type)?.actions || [];

export const defOf = (type) => MODULES[type] || null;
export const portOf = (type, dir, id) => (defOf(type)?.[dir === "out" ? "outs" : "ins"] || []).find((p) => p.id === id) || null;
export const defaults = (type) => {
  const p = {};
  for (const [k, d] of Object.entries(defOf(type)?.params || {})) p[k] = d.def;
  return p;
};
export const isChoice = (d) => Array.isArray(d.options);
// A knob's travel (0..1) and its value, each way, along its curve.
export function toValue(d, t) {
  t = Math.min(1, Math.max(0, t));
  let v;
  if (d.curve === "exp") v = d.min * (d.max / d.min) ** t;
  else if (d.curve === "sq") v = d.min + (d.max - d.min) * t * t;
  else v = d.min + (d.max - d.min) * t;
  return tidy(d, v);
}
export function toTravel(d, v) {
  v = Math.min(d.max, Math.max(d.min, Number(v)));
  if (d.curve === "exp") return Math.log(v / d.min) / Math.log(d.max / d.min);
  if (d.curve === "sq") return Math.sqrt((v - d.min) / (d.max - d.min));
  return (v - d.min) / (d.max - d.min);
}
export function tidy(d, v) {
  if (d.text) return typeof v === "string" ? v.slice(0, d.max || 2000) : d.def;
  if (isChoice(d)) return d.options.includes(v) ? v : d.def;
  v = Number(v);
  if (!Number.isFinite(v)) return d.def;
  v = Math.min(d.max, Math.max(d.min, v));
  if (d.step) v = Math.round(v / d.step) * d.step;
  else v = Number(v.toPrecision(4));
  return v;
}
export const readOf = (d, v) => (isChoice(d) ? (d.names?.[v] ?? v) : d.read ? d.read(v) : String(v));
