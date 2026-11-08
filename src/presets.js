// Starting points: finished patches to play and take apart. Each one is a lesson's idea carried a little further.
import { build, COL, ROW } from "./patch.js";

// A place on the grid: column, row.
const g = (c, r, p) => [COL[c], ROW[r], p];

const voice = [
  ["keys.pitch", "osc.pitch"],
  ["keys.gate", "env.gate"],
  ["filter.out", "amp.in"],
  ["env.out", "amp.level"],
];
export const PRESETS = [
  {
    id: "pluck",
    name: "Pluck",
    line: "A saw, a filter that snaps shut, a short echo.",
    patch: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "sawtooth" }),
          filter: g(2, 0, { cutoff: 260, res: 6, depth: 4200 }),
          env2: g(1, 1, { a: 0.002, d: 0.22, s: 0.05, r: 0.2 }),
          amp: g(3, 0),
          env: g(2, 1, { a: 0.002, d: 0.5, s: 0.0, r: 0.3 }),
          delay: g(3, 1, { time: 0.28, feedback: 0.35, mix: 0.3 }),
          out: g(4, 0),
        },
        [...voice, ["osc.out", "filter.in"], ["keys.gate", "env2.gate"], ["env2.out", "filter.cut"], ["amp.out", "delay.in"], ["delay.out", "out.in"]],
      ),
  },
  {
    id: "pad",
    name: "Pad",
    line: "Two saws a few cents apart, a slow rise, a filter that breathes.",
    patch: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "sawtooth", fine: -7 }),
          osc2: g(1, 1, { wave: "sawtooth", fine: 7 }),
          mixer: g(2, 0, { a: 0.6, b: 0.6 }),
          filter: g(3, 0, { cutoff: 900, res: 2, depth: 900 }),
          lfo: g(2, 1, { rate: 0.2, wave: "triangle" }),
          amp: g(4, 0),
          env: g(3, 1, { a: 1.2, d: 1, s: 0.8, r: 2.2 }),
          out: g(4, 1),
        },
        [
          ["keys.pitch", "osc.pitch"],
          ["keys.pitch", "osc2.pitch"],
          ["keys.gate", "env.gate"],
          ["osc.out", "mixer.a"],
          ["osc2.out", "mixer.b"],
          ["mixer.out", "filter.in"],
          ["lfo.out", "filter.cut"],
          ["filter.out", "amp.in"],
          ["env.out", "amp.level"],
          ["amp.out", "out.in"],
        ],
      ),
  },
  {
    id: "bass",
    name: "Bass",
    line: "A square and a saw an octave apart, a filter envelope with a bite.",
    patch: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "square", tune: -12 }),
          osc2: g(1, 1, { wave: "sawtooth", tune: -24 }),
          mixer: g(2, 0, { a: 0.5, b: 0.7 }),
          filter: g(3, 0, { cutoff: 180, res: 7, depth: 3000 }),
          env2: g(2, 1, { a: 0.002, d: 0.18, s: 0.15, r: 0.1 }),
          amp: g(4, 0),
          env: g(3, 1, { a: 0.002, d: 0.3, s: 0.8, r: 0.08 }),
          out: g(4, 1),
        },
        [
          ["keys.pitch", "osc.pitch"],
          ["keys.pitch", "osc2.pitch"],
          ["keys.gate", "env.gate"],
          ["keys.gate", "env2.gate"],
          ["osc.out", "mixer.a"],
          ["osc2.out", "mixer.b"],
          ["mixer.out", "filter.in"],
          ["env2.out", "filter.cut"],
          ["filter.out", "amp.in"],
          ["env.out", "amp.level"],
          ["amp.out", "out.in"],
        ],
      ),
  },
  {
    id: "bell",
    name: "Bell",
    line: "FM: one sine bending another at an odd ratio, a long ring.",
    patch: () =>
      build(
        {
          keys: g(0, 0),
          osc2: g(1, 1, { wave: "sine", tune: 19 }),
          osc: g(1, 0, { wave: "sine", bend: 2200 }),
          amp: g(2, 0),
          env: g(2, 1, { a: 0.002, d: 2.5, s: 0, r: 2.5 }),
          delay: g(3, 1, { time: 0.42, feedback: 0.3, mix: 0.25 }),
          out: g(4, 0),
        },
        [
          ["keys.pitch", "osc.pitch"],
          ["keys.pitch", "osc2.pitch"],
          ["keys.gate", "env.gate"],
          ["osc2.out", "osc.mod"],
          ["osc.out", "amp.in"],
          ["env.out", "amp.level"],
          ["amp.out", "delay.in"],
          ["delay.out", "out.in"],
        ],
      ),
  },
  {
    id: "wind",
    name: "Wind",
    line: "Noise through a narrow filter that a slow LFO moves. No keys needed.",
    patch: () =>
      build(
        {
          noise: g(1, 0, { level: 0.8 }),
          filter: g(2, 0, { type: "bandpass", cutoff: 700, res: 9, depth: 1800 }),
          lfo: g(1, 1, { rate: 0.12, wave: "triangle" }),
          delay: g(3, 0, { time: 0.6, feedback: 0.45, mix: 0.4 }),
          out: g(4, 0),
        },
        [
          ["noise.out", "filter.in"],
          ["lfo.out", "filter.cut"],
          ["filter.out", "delay.in"],
          ["delay.out", "out.in"],
        ],
      ),
  },
  {
    id: "wobble",
    name: "Wobble",
    line: "A low saw with an LFO on the cutoff: the filter opens and shuts on its own.",
    patch: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "sawtooth", tune: -12 }),
          filter: g(2, 0, { cutoff: 220, res: 10, depth: 3600 }),
          lfo: g(1, 1, { rate: 3, wave: "sine" }),
          amp: g(3, 0),
          env: g(3, 1, { a: 0.005, d: 0.3, s: 0.9, r: 0.15 }),
          out: g(4, 0),
        },
        [...voice, ["osc.out", "filter.in"], ["lfo.out", "filter.cut"], ["amp.out", "out.in"]],
      ),
  },
];
export const presetOf = (id) => PRESETS.find((p) => p.id === id) || null;

// What a new voice in the studio starts as, by its part. "plain" is the barer one a lesson starts from,
// for the kid to build up; the full one is for a voice added outside the course.
const KEYED = [
  ["keys.pitch", "osc.pitch"],
  ["keys.gate", "env.gate"],
  ["env.out", "amp.level"],
  ["amp.out", "out.in"],
];
export const ROLE_PATCHES = {
  pulse: {
    full: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "sawtooth", tune: -12 }),
          filter: g(2, 0, { cutoff: 320, res: 6, depth: 3200 }),
          env2: g(1, 1, { a: 0.002, d: 0.14, s: 0.08, r: 0.08 }),
          amp: g(3, 0),
          env: g(2, 1, { a: 0.002, d: 0.2, s: 0.7, r: 0.06 }),
          out: g(4, 0, { volume: 0.6 }),
        },
        [...KEYED, ["osc.out", "filter.in"], ["filter.out", "amp.in"], ["keys.gate", "env2.gate"], ["env2.out", "filter.cut"]],
      ),
    plain: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "sawtooth", tune: -12 }),
          filter: g(2, 0, { cutoff: 420, res: 4, depth: 3200 }),
          amp: g(3, 0),
          env: g(3, 1, { a: 0.002, d: 0.2, s: 0.7, r: 0.06 }),
          out: g(4, 0, { volume: 0.6 }),
        },
        [...KEYED, ["osc.out", "filter.in"], ["filter.out", "amp.in"]],
      ),
  },
  floor: {
    full: () => PRESETS.find((p) => p.id === "pad").patch(),
    plain: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "sawtooth" }),
          filter: g(2, 0, { cutoff: 1100, res: 1.5, depth: 1200 }),
          amp: g(3, 0),
          env: g(3, 1, { a: 0.9, d: 1, s: 0.8, r: 1.8 }),
          out: g(4, 0, { volume: 0.5 }),
        },
        [...KEYED, ["osc.out", "filter.in"], ["filter.out", "amp.in"]],
      ),
  },
  voice: {
    full: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "square", glide: 0.12, bend: 22 }),
          lfo: g(1, 1, { rate: 5.5, wave: "sine" }),
          filter: g(2, 0, { cutoff: 2600, res: 1.2, depth: 0 }),
          amp: g(3, 0),
          env: g(2, 1, { a: 0.04, d: 0.5, s: 0.8, r: 0.5 }),
          delay: g(3, 1, { time: 0.45, feedback: 0.35, mix: 0.3 }),
          out: g(4, 0, { volume: 0.55 }),
        },
        [
          ["keys.pitch", "osc.pitch"],
          ["keys.gate", "env.gate"],
          ["env.out", "amp.level"],
          ["lfo.out", "osc.mod"],
          ["osc.out", "filter.in"],
          ["filter.out", "amp.in"],
          ["amp.out", "delay.in"],
          ["delay.out", "out.in"],
        ],
      ),
    plain: () =>
      build(
        {
          keys: g(0, 0),
          osc: g(1, 0, { wave: "square" }),
          amp: g(2, 0),
          env: g(2, 1, { a: 0.04, d: 0.5, s: 0.8, r: 0.5 }),
          out: g(4, 0, { volume: 0.5 }),
        },
        [...KEYED, ["osc.out", "amp.in"]],
      ),
  },
  hit: {
    full: () =>
      build(
        {
          keys: g(0, 0),
          noise: g(1, 0, { level: 0.9 }),
          filter: g(2, 0, { type: "highpass", cutoff: 900, res: 1, depth: 0 }),
          amp: g(3, 0),
          env: g(3, 1, { a: 0.001, d: 0.11, s: 0, r: 0.1 }),
          out: g(4, 0, { volume: 0.5 }),
        },
        [
          ["keys.gate", "env.gate"],
          ["noise.out", "filter.in"],
          ["filter.out", "amp.in"],
          ["env.out", "amp.level"],
          ["amp.out", "out.in"],
        ],
      ),
    plain: () =>
      build(
        {
          keys: g(0, 0),
          noise: g(1, 0, { level: 0.8 }),
          amp: g(2, 0),
          env: g(2, 1, { a: 0.001, d: 0.6, s: 0.5, r: 0.3 }),
          out: g(4, 0, { volume: 0.5 }),
        },
        [
          ["keys.gate", "env.gate"],
          ["noise.out", "amp.in"],
          ["env.out", "amp.level"],
          ["amp.out", "out.in"],
        ],
      ),
  },
};
export const rolePatch = (role, kind = "full") => (ROLE_PATCHES[role] || ROLE_PATCHES.pulse)[kind]();
