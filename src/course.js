// The composing course: ten lessons after the ten about patching, all in one project the kid builds
// up ("My first track"), one idea each. A lesson's start adds what it needs (a voice, a longer
// loop) and never takes away what the kid made. A step is ticked by the project itself (notes in the
// loop, a cable, a knob in a range, the loop played round, the numbers measured), and only then says
// why. None of it needs the AI. The checks read:
// { project, voice(role), patch(role), notes(role), loops: turns of the loop heard in this step,
//   song: times the whole track was started in this step, numbers: the last measurement or null }.
import { wired, chain, ofType, cablesInto, moduleOf, heard } from "./patch.js";
import { newProject, addVoice, voiceByRole, setFront, setBars, totalSteps, stepSeconds, activeVoices, STEPS } from "./project.js";
import { rolePatch } from "./presets.js";

export const COURSE_NAME = "My first track";
export const newCourse = () => newProject({ name: COURSE_NAME, patch: rolePatch("pulse", "plain"), role: "pulse" });
// The voice for a part, added (bare, to build up) if it isn't there yet, and put in front.
function bring(pr, role) {
  let p = pr;
  if (!voiceByRole(p, role)) p = addVoice(p, (r) => rolePatch(r, "plain"), role).project;
  const v = voiceByRole(p, role);
  return v ? setFront(p, v.id) : p;
}
const atLeastBars = (pr, n) => (pr.bars < n ? setBars(pr, n) : pr);
const P = (c, role) => c.patch(role) || { modules: [], cables: [] };
const mods = (c, role, type) => ofType(P(c, role), type);
const from = (patch, id, jack, type) =>
  cablesInto(patch, id, jack)
    .map((x) => moduleOf(patch, x.from[0]))
    .filter((m) => m && (!type || m.type === type));
const pitched = (patch) => ofType(patch, "osc").filter((o) => from(patch, o.id, "pitch", "keys").length);
const mostOf = (notes) => {
  const n = new Map();
  for (const x of notes) n.set(x.n, (n.get(x.n) || 0) + 1);
  return Math.max(0, ...n.values());
};
const ms = (s) => `${Math.round(s * 1000)} ms`;

export const COURSE = [
  {
    id: "pulse",
    title: "The pulse",
    line: "Eight notes and one exception.",
    start: (pr) => bring(pr, "pulse"),
    steps: [
      {
        do: "Press R and play one key eight times while the loop goes round, or click eight steps in the Pulse row.",
        why: "Eight of the same note is already a rhythm: what repeats becomes the ground everything else stands on.",
        done: (c) => mostOf(c.notes("pulse")) >= 8,
      },
      {
        do: "Now change one of them: play a different key, then click one of the notes.",
        why: "A pattern is a rule and one exception. The exception is the note you remember.",
        done: (c) => {
          const ns = c.notes("pulse");
          return ns.length >= 8 && new Set(ns.map((n) => n.n)).size >= 2 && mostOf(ns) >= ns.length - 2;
        },
      },
      {
        do: "Press Space and let it go round twice.",
        why: "The loop doesn’t wear out the way you’d expect: after a few turns the ear starts to hear inside it.",
        done: (c) => c.loops >= 2,
      },
    ],
  },
  {
    id: "bass",
    title: "The bass that never stops",
    line: "Rhythm that comes from tone.",
    start: (pr) => bring(pr, "pulse"),
    steps: [
      {
        do: "Add an Envelope to the Pulse. Plug the Keyboard’s Gate into it, and its Out into the Filter’s Cutoff.",
        why: "Each note now moves the filter as well as the volume.",
        done: (c) => mods(c, "pulse", "env").some((e) => from(P(c, "pulse"), e.id, "gate", "keys").length) && wired(P(c, "pulse"), "env.out", "filter.cut"),
      },
      {
        do: "Make that envelope short: Decay under 0.2 s and Sustain under 20%.",
        why: "Every note now opens the filter and shuts it again, a little bite of brightness on each step. Rhythm can come from tone.",
        done: (c) => mods(c, "pulse", "filter").some((f) => from(P(c, "pulse"), f.id, "cut", "env").some((e) => e.p.d < 0.2 && e.p.s < 0.2)),
      },
      {
        do: "Turn the Filter’s Resonance past 5 and play the loop.",
        why: "Resonance rings at the cutoff, so the bite has a pitch of its own.",
        done: (c) => mods(c, "pulse", "filter").some((f) => f.p.res >= 5) && c.loops >= 1,
      },
    ],
  },
  {
    id: "slow",
    title: "A slow change",
    line: "Harmony moves less than you think.",
    start: (pr) => atLeastBars(bring(pr, "floor"), 4),
    steps: [
      {
        do: "In the Floor row, make one note from the start that lasts two bars: hold a key while recording, or drag across the steps.",
        why: "One note held under a pulse that moves every step: the slow part and the fast part need each other.",
        done: (c) => c.notes("floor").some((n) => n.s <= 1 && n.l >= 2 * STEPS - 4),
      },
      {
        do: "Make a different note from bar 3 that lasts to the end.",
        why: "Harmony is slow. Two changes in four bars are enough to feel the ground shift.",
        done: (c) => {
          const ns = c.notes("floor");
          const first = ns.find((n) => n.s <= 1 && n.l >= 2 * STEPS - 4);
          return !!first && ns.some((n) => n.s >= 2 * STEPS && n.s <= 2 * STEPS + 2 && n.l >= STEPS + 8 && n.n !== first.n);
        },
      },
    ],
  },
  {
    id: "thick",
    title: "Thick",
    line: "Two waves, almost the same.",
    start: (pr) => atLeastBars(bring(pr, "floor"), 4),
    steps: [
      {
        do: "Add a second Oscillator to the Floor. Plug the Keyboard’s Pitch into it, and mix both oscillators through a Mixer into the Filter.",
        why: "Two oscillators on the same note sound like one, louder.",
        done: (c) => {
          const p = P(c, "floor");
          const h = heard(p);
          return pitched(p).filter((o) => h.has(o.id)).length >= 2;
        },
      },
      {
        do: "Set Fine on one oscillator a few cents away from the other: between 4 and 20 cents apart.",
        why: "Two waves a few cents apart drift in and out of step, so the sound moves by itself. Small differences move.",
        done: (c) => {
          const os = pitched(P(c, "floor"));
          return os.some((a) => os.some((b) => a !== b && a.p.tune === b.p.tune && Math.abs(a.p.fine - b.p.fine) >= 4 && Math.abs(a.p.fine - b.p.fine) <= 25));
        },
      },
    ],
  },
  {
    id: "breathing",
    title: "Breathing",
    line: "Movement slower than a note.",
    start: (pr) => atLeastBars(bring(pr, "floor"), 4),
    steps: [
      {
        do: "Add an LFO to the Floor and plug it into the Filter’s Cutoff.",
        why: "The filter now opens and closes on its own.",
        done: (c) => wired(P(c, "floor"), "lfo.out", "filter.cut"),
      },
      {
        do: "Slow the LFO right down: Rate under 0.2 Hz, slower than the loop goes round.",
        why: "At that speed it isn’t a wobble: the sound breathes over several bars. The best movement is slower than you notice.",
        done: (c) => wired(P(c, "floor"), "lfo.out", "filter.cut", (a) => a.p.rate <= 0.2),
      },
    ],
  },
  {
    id: "space",
    title: "Space",
    line: "The room plays too.",
    start: (pr) => bring(pr, "pulse"),
    steps: [
      {
        do: "Add an Echo to the Pulse, between its Amp and the Speaker.",
        why: "Every note now comes back a moment later.",
        done: (c) => chain(P(c, "pulse"), "amp", "delay", "out"),
      },
      {
        do: (c) => `Set the Echo’s Time to three steps of the loop: ${ms(3 * stepSeconds(c.project))} at this tempo.`,
        why: "An echo in time with the pulse plays along with it, filling the gaps on the beat.",
        done: (c) => {
          const st = stepSeconds(c.project);
          return mods(c, "pulse", "delay").some((d) => [2, 3, 4, 6].some((k) => Math.abs(d.p.time - k * st) <= k * st * 0.08));
        },
      },
      {
        do: "Keep its Feedback under half and its Mix above 20%.",
        why: "Under half, each echo is quieter than the one before, so the room never drowns the pulse.",
        done: (c) => mods(c, "pulse", "delay").some((d) => d.p.feedback < 0.5 && d.p.mix >= 0.2),
      },
    ],
  },
  {
    id: "voice",
    title: "The voice",
    line: "A lead that sings.",
    start: (pr) => atLeastBars(bring(pr, "voice"), 4),
    steps: [
      {
        do: "Turn up Glide on the Voice’s Oscillator to about 0.1 s. It shows while the Keyboard plays it.",
        why: "Each note now slides from the one before, as a voice does.",
        done: (c) => pitched(P(c, "voice")).some((o) => o.p.glide >= 0.05),
      },
      {
        do: "Record a line of five notes or fewer across the whole loop, with long rests between.",
        why: "A melody is mostly what isn’t played. A few notes, held and bent into each other, sound like someone singing.",
        done: (c) => {
          const ns = c.notes("voice");
          const steps = totalSteps(c.project);
          const covered = ns.reduce((a, n) => a + n.l, 0);
          return ns.length >= 2 && ns.length <= 5 && Math.max(...ns.map((n) => n.s)) >= steps / 2 && covered <= steps * 0.6;
        },
      },
      {
        do: "Plug an LFO into the Oscillator’s Bend, with a Bend depth under 40 cents: a light vibrato.",
        why: "A small, quick wobble in pitch is what makes a held note sound alive.",
        done: (c) => wired(P(c, "voice"), "lfo.out", "osc.mod", (_, o) => o.p.bend > 0 && o.p.bend <= 40),
      },
    ],
  },
  {
    id: "hits",
    title: "Wind and hits",
    line: "Noise as a drum, and as weather.",
    start: (pr) => bring(pr, "hit"),
    steps: [
      {
        do: "In the Hit row, put a note on step 5 and step 13 of every bar.",
        why: "Those are beats 2 and 4, where a backbeat lives; the pulse fills everything between.",
        done: (c) => {
          const ss = new Set(c.notes("hit").map((n) => n.s));
          for (let b = 0; b < c.project.bars; b++) if (!ss.has(b * STEPS + 4) || !ss.has(b * STEPS + 12)) return false;
          return true;
        },
      },
      {
        do: "Make the hit short: its Envelope’s Decay under 0.15 s, and Sustain at 0.",
        why: "A snare is a burst of noise that shuts at once. Drums are envelopes.",
        done: (c) => mods(c, "hit", "amp").some((a) => from(P(c, "hit"), a.id, "level", "env").some((e) => e.p.d < 0.15 && e.p.s <= 0.01)),
      },
      {
        do: "Now the wind: in the Floor, send Noise through a Filter set to Band, so it reaches the Speaker.",
        why: "Noise has a pitch once you give it one: a narrow band of it is wind.",
        done: (c) => {
          const p = P(c, "floor");
          const h = heard(p);
          return ofType(p, "noise").some((n) => h.has(n.id) && p.cables.some((x) => x.from[0] === n.id && moduleOf(p, x.to[0])?.type === "filter" && moduleOf(p, x.to[0]).p.type === "bandpass"));
        },
      },
    ],
  },
  {
    id: "arrivals",
    title: "Arrivals",
    line: "A track is a plan.",
    start: (pr) => pr,
    steps: [
      {
        do: "Press New section. It starts as a copy of this one.",
        why: "A section is a loop with a name; the track plays them in order.",
        done: (c) => c.project.sections.length >= 2,
      },
      {
        do: "Make four sections, each with one more part than the one before. Clear a voice’s row in the early ones.",
        why: "A track is a plan of arrivals: the ear waits for what comes next.",
        done: (c) => {
          const s = c.project.sections.slice(0, 4);
          if (s.length < 4) return false;
          const n = s.map((x) => activeVoices(c.project, x.id).length);
          return n.every((k, i) => i === 0 || k > n[i - 1]);
        },
      },
      {
        do: "Press Play all (Shift Space) to hear the whole plan from the start.",
        why: "The same few bars, arriving one part at a time: now it’s a track.",
        done: (c) => c.song >= 1,
      },
    ],
  },
  {
    id: "mix",
    title: "The mix",
    line: "Every part in its own room.",
    start: (pr) => pr,
    steps: [
      {
        do: "Press Measure in the notes column to see how bright each voice is.",
        why: "Brightness is where a sound’s energy sits, low or high. Two voices in the same place fight.",
        done: (c) => !!c.numbers,
      },
      {
        do: "Give each voice its own range: the Pulse the darkest, the Voice the brightest. Measure again after each change.",
        why: "Low and high parts stop covering each other, so you hear every one.",
        done: (c) => {
          const n = c.numbers?.voices.filter((v) => !v.silent) || [];
          const roleOf = (v) => c.project.voices.find((x) => x.id === v.id)?.role;
          const pulse = n.find((v) => roleOf(v) === "pulse"),
            lead = n.find((v) => roleOf(v) === "voice");
          if (!pulse || n.length < 2) return false;
          return n.every((v) => v === pulse || v.centroid > pulse.centroid) && (!lead || n.every((v) => v === lead || v.centroid < lead.centroid));
        },
      },
      {
        do: "Nothing clips: keep the peak under 0 dB. Turn a Speaker’s Volume down if it does, then Measure.",
        why: "Clarity is loudness: when every part has its own room, the whole sounds bigger without being turned up.",
        done: (c) => !!c.numbers?.mix && !c.numbers.mix.silent && !c.numbers.mix.clips && c.numbers.voices.filter((v) => !v.silent).length >= 2,
      },
    ],
  },
];
export const courseOf = (id) => COURSE.find((l) => l.id === id) || null;
