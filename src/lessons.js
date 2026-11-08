// The course: ten short lessons, each one idea, from a single wave to FM. A lesson starts from its
// own patch (so any one can be taken on its own) and has steps; a step is done when the patch, the
// knobs tried or the notes played say so, and only then is its "why" shown, so the reason arrives
// with the sound. The checks read a context the game keeps:
// { patch, notes: keys played in this step, tried(type, knob): values chosen in this step, all(type): the modules of a type }.
import { build, wired, chain, ofType, cablesInto, moduleOf, COL, ROW } from "./patch.js";

const all = (ctx, type) => ofType(ctx.patch, type);
const some = (ctx, type, f) => all(ctx, type).some((m) => f(m.p, m));
// The envelope that drives this module's jack.
const driver = (ctx, id, jack, type = "env") =>
  cablesInto(ctx.patch, id, jack)
    .map((c) => moduleOf(ctx.patch, c.from[0]))
    .find((m) => m && m.type === type) || null;
const gated = (ctx, env) => !!env && cablesInto(ctx.patch, env.id, "gate").length > 0;

// The patches the lessons start from (positions in the board's units; the speaker sits on the right).
const R = { keys: [COL[0], ROW[0]], osc: [COL[1], ROW[0]], osc2: [COL[1], ROW[1]], filter: [COL[2], ROW[0]], amp: [COL[3], ROW[0]], env: [COL[3], ROW[1]], out: [COL[4], ROW[0]] };
const at = (id, p) => [...R[id], p];
const PLAIN = { keys: at("keys"), osc: at("osc", { wave: "sawtooth" }), amp: at("amp"), env: at("env"), out: at("out") };
const PLAIN_WIRES = [
  ["keys.pitch", "osc.pitch"],
  ["keys.gate", "env.gate"],
  ["osc.out", "amp.in"],
  ["env.out", "amp.level"],
  ["amp.out", "out.in"],
];

export const LESSONS = [
  {
    id: "signal",
    title: "A signal",
    line: "What a sound is, as a synthesizer sees it.",
    start: () => build({ osc: [COL[1], 180], out: [COL[3], 180] }),
    steps: [
      {
        do: "Drag a cable from the Oscillator’s Out to the Speaker’s In.",
        why: "That hum is a sine wave: the speaker moving out and in 220 times a second. The picture on the Oscillator is the wave itself.",
        done: (c) => wired(c.patch, "osc.out", "out.in"),
      },
      {
        do: "Turn the Oscillator’s Tune knob up and down. Drag up or down on it, or use the arrow keys.",
        why: "More waves a second sounds higher. Each step of Tune is a semitone; twelve of them double the speed, which is an octave.",
        done: (c) => c.tried("osc", "tune").size >= 4,
      },
    ],
  },
  {
    id: "shape",
    title: "The shape of a wave",
    line: "Why a saw and a sine sound different at the same pitch.",
    start: () => build({ osc: [COL[1], 180], out: [COL[3], 180] }, [["osc.out", "out.in"]]),
    steps: [
      {
        do: "Try each of the four waves on the Oscillator: sine, triangle, saw and square.",
        why: "Same pitch, different colour. A sharp corner is made of overtones, quieter waves at two, three, four times the speed riding on the first. The saw has all of them; the square only the odd ones; the sine has none.",
        done: (c) => c.tried("osc", "wave").size >= 4,
      },
      {
        do: "Add Noise (Add, then Noise) and connect it to the Speaker too.",
        why: "Noise is every frequency at once, so it has no pitch at all. Two cables into one input simply add up.",
        done: (c) => wired(c.patch, "noise.out", "out.in") && wired(c.patch, "osc.out", "out.in"),
      },
    ],
  },
  {
    id: "keys",
    title: "Playing it",
    line: "The keyboard sends a pitch.",
    start: () => build({ keys: [COL[0], 180], osc: [COL[2], 180, { wave: "sawtooth" }], out: [COL[4], 180] }, [["osc.out", "out.in"]]),
    steps: [
      {
        do: "Connect the Keyboard’s Pitch to the Oscillator’s Pitch.",
        why: "The hum stopped: once the keyboard is plugged in, a sound plays only while a key is down. The oscillator now takes its pitch from the key.",
        done: (c) => wired(c.patch, "keys.pitch", "osc.pitch"),
      },
      {
        do: "Play a few notes on your keyboard. A S D F G H J K are the white keys; W E T Y U the black ones.",
        why: "Every key is its own voice, so chords work. Z and X move the whole keyboard down and up an octave.",
        done: (c) => c.notes >= 5,
      },
      {
        do: "Set Tune to +12 and play again.",
        why: "Tune now moves the oscillator away from the key you play: +12 is an octave above it, +7 a fifth.",
        done: (c) => some(c, "osc", (p) => p.tune === 12) && c.notes >= 1,
      },
    ],
  },
  {
    id: "envelope",
    title: "Shaping time",
    line: "An amp and an envelope: how a note starts and ends.",
    start: () => build({ keys: at("keys"), osc: at("osc", { wave: "sawtooth" }), out: at("out") }, [["keys.pitch", "osc.pitch"], ["osc.out", "out.in"]]),
    steps: [
      {
        do: "Add an Amp and put it between the Oscillator and the Speaker: Oscillator Out to Amp In, Amp Out to Speaker In.",
        why: "An amp sets how loud a signal is. Nothing has changed yet: it’s open, and each note still starts and stops like a switch.",
        done: (c) => chain(c.patch, "osc", "amp", "out") && !wired(c.patch, "osc.out", "out.in"),
      },
      {
        do: "Add an Envelope and connect its Out to the Amp’s Level.",
        why: "Silence: the envelope now decides how loud the amp is, and it’s resting at zero. It needs to know when a note starts.",
        done: (c) => wired(c.patch, "env.out", "amp.level"),
      },
      {
        do: "Connect the Keyboard’s Gate to the Envelope’s Gate, then play.",
        why: "The gate is on while a key is held. When it opens the envelope rises, and when it closes it falls: watch the dot run along its shape.",
        done: (c) => wired(c.patch, "keys.gate", "env.gate") && c.notes >= 2,
      },
      {
        do: "Turn Attack up to about a second, and hold a note.",
        why: "Attack is how long the rise takes. A slow one sounds bowed or blown; it can’t be hit.",
        done: (c) => some(c, "env", (p) => p.a >= 0.6) && c.notes >= 1,
      },
      {
        do: "Now take Attack right down, Sustain to zero and Decay to under half a second. Play.",
        why: "With no sustain the note dies away even while the key is held: a pluck. Release is what’s left after you let go.",
        done: (c) => some(c, "env", (p) => p.a <= 0.05 && p.s <= 0.1 && p.d <= 0.5) && c.notes >= 1,
      },
    ],
  },
  {
    id: "filter",
    title: "Taking away",
    line: "A filter: how most synthesizers find their sound.",
    start: () => build(PLAIN, PLAIN_WIRES),
    steps: [
      {
        do: "Add a Filter and put it between the Oscillator and the Amp.",
        why: "A low-pass filter lets the low frequencies through and takes away those above its cutoff. Its picture is the shape of what passes, over the sound’s own frequencies.",
        done: (c) => chain(c.patch, "osc", "filter", "amp"),
      },
      {
        do: "Play, and turn the Filter’s Cutoff down slowly, below 500 Hz.",
        why: "The saw loses its buzz as its overtones are taken away. Starting bright and taking away is called subtractive synthesis.",
        done: (c) => some(c, "filter", (p) => p.cutoff < 500) && c.tried("filter", "cutoff").size >= 3 && c.notes >= 1,
      },
      {
        do: "Turn Resonance up past 8.",
        why: "Resonance lifts the frequencies right at the cutoff. Sweep the cutoff now: that whistle is the sound people mean by “synth”.",
        done: (c) => some(c, "filter", (p) => p.res >= 8),
      },
    ],
  },
  {
    id: "filterenv",
    title: "A second envelope",
    line: "One envelope for loudness, one for tone.",
    start: () =>
      build({ ...PLAIN, filter: at("filter", { cutoff: 700, res: 4 }) }, [
        ["keys.pitch", "osc.pitch"],
        ["keys.gate", "env.gate"],
        ["osc.out", "filter.in"],
        ["filter.out", "amp.in"],
        ["env.out", "amp.level"],
        ["amp.out", "out.in"],
      ]),
    steps: [
      {
        do: "Add another Envelope. Connect the Keyboard’s Gate to it, and its Out to the Filter’s Cutoff.",
        why: "Every note now opens the filter and lets it close again. A Depth knob appeared on the filter: how far the envelope can open it.",
        done: (c) => {
          const e = c.patch.modules.find((m) => m.type === "filter") && driver(c, c.patch.modules.find((m) => m.type === "filter").id, "cut");
          return gated(c, e);
        },
      },
      {
        do: "Set Cutoff low (under 300 Hz) and that envelope’s Sustain low (under 20%). Play.",
        why: "The bright start and dull end of a plucked string, or a bass. Try a longer Decay for a slower close.",
        done: (c) =>
          some(c, "filter", (p, m) => {
            const e = driver(c, m.id, "cut");
            return p.cutoff < 300 && e && e.p.s < 0.2;
          }) && c.notes >= 2,
      },
    ],
  },
  {
    id: "lfo",
    title: "Movement",
    line: "An LFO moves knobs for you.",
    start: () =>
      build({ ...PLAIN, filter: at("filter", { cutoff: 1400, res: 3 }), env: at("env", { s: 0.8, r: 0.6 }) }, [
        ["keys.pitch", "osc.pitch"],
        ["keys.gate", "env.gate"],
        ["osc.out", "filter.in"],
        ["filter.out", "amp.in"],
        ["env.out", "amp.level"],
        ["amp.out", "out.in"],
      ]),
    steps: [
      {
        do: "Add an LFO and connect it to the Oscillator’s Bend. Hold a note.",
        why: "A low-frequency oscillator is a wave too slow to hear as a pitch. Bending the pitch up and down with it is vibrato.",
        done: (c) => wired(c.patch, "lfo.out", "osc.mod") && c.notes >= 1,
      },
      {
        do: "Set the Oscillator’s Bend depth under 40 cents, and the LFO’s Rate between 4 and 7 Hz.",
        why: "Small and quick is a singer’s vibrato. Deep and slow is a siren.",
        done: (c) => some(c, "osc", (p) => p.bend <= 40) && some(c, "lfo", (p) => p.rate >= 4 && p.rate <= 7),
      },
      {
        do: "Move the cable: from the LFO to the Filter’s Cutoff instead of the Bend.",
        why: "Any signal can move any knob that has an input. That one idea is the whole of a modular synthesizer.",
        done: (c) => wired(c.patch, "lfo.out", "filter.cut") && !wired(c.patch, "lfo.out", "osc.mod"),
      },
    ],
  },
  {
    id: "two",
    title: "Two oscillators",
    line: "Thickness, and the beating of two near pitches.",
    start: () =>
      build({ ...PLAIN, filter: at("filter", { cutoff: 2400, res: 1 }) }, [
        ["keys.pitch", "osc.pitch"],
        ["keys.gate", "env.gate"],
        ["osc.out", "filter.in"],
        ["filter.out", "amp.in"],
        ["env.out", "amp.level"],
        ["amp.out", "out.in"],
      ]),
    steps: [
      {
        do: "Add a Mixer and a second Oscillator. Both oscillators go into the Mixer, and the Mixer into the Filter.",
        why: "The mixer adds them up. The new oscillator isn’t following the keys yet, so it plays its own A whenever a note sounds.",
        done: (c) => all(c, "osc").length >= 2 && chain(c.patch, "mixer", "filter") && all(c, "osc").filter((m) => c.patch.cables.some((x) => x.from[0] === m.id && moduleOf(c.patch, x.to[0])?.type === "mixer")).length >= 2,
      },
      {
        do: "Connect the Keyboard’s Pitch to the new Oscillator as well, and make it a saw.",
        why: "Two saws at the same pitch: louder, but no different. It’s the small differences that make it interesting.",
        done: (c) => all(c, "osc").filter((m) => wired(c.patch, "keys.pitch", "osc.pitch", (a, b) => b.id === m.id)).length >= 2 && all(c, "osc").filter((m) => m.p.wave === "sawtooth").length >= 2,
      },
      {
        do: "Set one oscillator’s Fine to about 8 cents, and play a held chord.",
        why: "Two waves a hair apart drift in and out of step, so the sound swims: the thick, moving sound of a chorus. Try Tune +7 or +12 too: a fifth, an octave.",
        done: (c) => {
          const f = all(c, "osc").map((m) => m.p.fine);
          return f.length >= 2 && Math.max(...f) - Math.min(...f) >= 5 && Math.max(...f) - Math.min(...f) <= 20 && c.notes >= 2;
        },
      },
    ],
  },
  {
    id: "echo",
    title: "Echo",
    line: "A copy, later, and again.",
    start: () => build({ ...PLAIN, env: at("env", { a: 0.003, d: 0.25, s: 0, r: 0.25 }) }, PLAIN_WIRES),
    steps: [
      {
        do: "Add an Echo and put it between the Amp and the Speaker.",
        why: "Each short note now comes back. The echo is shared by every key, so the copies carry on after the voice has ended.",
        done: (c) => chain(c.patch, "amp", "delay", "out") && !wired(c.patch, "amp.out", "out.in"),
      },
      {
        do: "Turn Feedback past 60% and play short notes. Change Time while the echoes are going.",
        why: "Feedback sends the copy round again, quieter each time. Moving the time stretches the echoes already in the line, so their pitch bends.",
        done: (c) => some(c, "delay", (p) => p.feedback >= 0.6) && c.tried("delay", "time").size >= 2 && c.notes >= 3,
      },
    ],
  },
  {
    id: "fm",
    title: "A wave into a wave",
    line: "FM: bells and metal from two sines.",
    start: () =>
      build({ ...PLAIN, osc: at("osc", { wave: "sine" }), osc2: at("osc2", { wave: "sine", tune: 12, bend: 0 }), env: at("env", { a: 0.002, d: 1.2, s: 0.2, r: 1.2 }) }, [...PLAIN_WIRES, ["keys.pitch", "osc2.pitch"]]),
    steps: [
      {
        do: "Connect the lower Oscillator’s Out to the upper Oscillator’s Bend.",
        why: "One wave now bends the other’s pitch, hundreds of times a second: too fast to hear as vibrato, so you hear new overtones instead. This is FM synthesis.",
        done: (c) => c.patch.cables.some((x) => moduleOf(c.patch, x.from[0])?.type === "osc" && moduleOf(c.patch, x.to[0])?.type === "osc" && x.to[1] === "mod"),
      },
      {
        do: "Turn the upper Oscillator’s Bend depth past 1,200 cents and play. Then try the lower one’s Tune at +19 or +24.",
        why: "The deeper the bend, the brighter. Whole-octave ratios sound like a reed or an organ; odd ones like +19 or +7 ring like bells and metal.",
        done: (c) =>
          c.patch.cables.some((x) => {
            const a = moduleOf(c.patch, x.from[0]),
              b = moduleOf(c.patch, x.to[0]);
            return a?.type === "osc" && b?.type === "osc" && x.to[1] === "mod" && b.p.bend >= 1200 && [19, 24, 7, 17].includes(a.p.tune);
          }) && c.notes >= 2,
      },
    ],
  },
];
export const lessonOf = (id) => LESSONS.find((l) => l.id === id) || null;
