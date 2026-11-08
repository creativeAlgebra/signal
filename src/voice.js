// The voice sessions of the master class (8, 9 and 10): the microphone, a loop that grows, a chain
// of pedals, and one voice singing three parts. They all happen on one board, the "Your voice"
// project: a session arrives, writes its name on the floor to the right of what is there, puts down
// what it brings, and takes nothing away. A step is ticked by the board and by what the Looper and
// the Microphone report (the engine's state), never by a timer. The checks read:
// { patch, notes, tried(type, knob), state(type): the engine's state of the first module of that type,
//   layers: layers recorded in this step, undos: layers taken off in this step, orders: the pedal orders heard in this step }.
import { addModule, addPlace, nextPlace, freeSpot, chain, wired, ofType, heard, moduleOf, cablesFrom, empty, COL } from "./patch.js";
import { PEDALS, defOf, portOf } from "./modules.js";
import { newProject } from "./project.js";

export const VOICE_ID = "voice";
export const VOICE_NAME = "Your voice";
export const newVoiceRig = () => newProject({ name: VOICE_NAME, role: "voice", voiceName: "Voice", patch: empty() });

// A session arrives: its name goes on the floor (once), and what it brings goes beneath the name,
// or on the lessons' grid the first time. A module of a kind already on the board isn't added again.
function arrive(patch, name, types) {
  const at = nextPlace(patch);
  const first = !(patch.places || []).length;
  let p = addPlace(patch, name, at.x, at.y);
  let x = at.x;
  for (const type of types) {
    if (ofType(p, type).length) continue;
    p = addModule(p, type, first ? freeSpot(p) : { x, y: at.y + 12 }).patch;
    x += COL[1] - COL[0];
  }
  return p;
}

// The pedals the sound passes on its way from the Looper (or the Microphone) to the Speaker, in order, as "drive>reverb".
export function pedalOrder(patch) {
  const start = ofType(patch, "looper")[0] || ofType(patch, "mic")[0] || null;
  if (!start) return "";
  const seen = new Set();
  const order = [];
  const walk = (id) => {
    if (id === "out") return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const m = moduleOf(patch, id);
    const pedal = m && PEDALS.has(m.type) && m.id !== start.id;
    if (pedal) order.push(m.type);
    for (const c of cablesFrom(patch, id)) {
      const b = moduleOf(patch, c.to[0]);
      if (b && portOf(b.type, "in", c.to[1])?.kind === "audio" && walk(b.id)) return true;
    }
    if (pedal) order.pop();
    return false;
  };
  return walk(start.id) ? order.join(">") : "";
}

const S = (c, type) => c.state(type);
const some = (c, type, f) => ofType(c.patch, type).some((m) => f(m.p, m));
const layersOf = (c) => S(c, "looper")?.layers || 0;

export const VOICE_LESSONS = [
  {
    id: "mic",
    title: "Your voice is an instrument",
    line: "The microphone, and a loop that grows.",
    place: "8 · Your voice is an instrument",
    start: (patch) => arrive(patch, "8 · Your voice is an instrument", ["mic"]),
    steps: [
      {
        do: "Headphones on. Switch the Microphone on (the Mic switch on its card) and let the browser use it.",
        why: "The microphone is a module like any other: a wave comes out of it. Headphones keep the speaker’s sound out of it; without them the loop feeds back and howls.",
        done: (c) => S(c, "mic")?.status === "live",
      },
      {
        do: "Connect the Microphone’s Out to the Speaker’s In, and say something.",
        why: "Your voice shows on the card as the wave it is. Everything the synthesizer did to an oscillator, it can do to this.",
        done: (c) => wired(c.patch, "mic.out", "out.in"),
      },
      {
        do: "Add a Looper (Add, then Looper) and put it between the Microphone and the Speaker.",
        why: "The Looper records what reaches it and plays it round. Through is how much of you goes straight on; Loop is how loud the layers play.",
        done: (c) => chain(c.patch, "mic", "looper", "out"),
      },
      {
        do: "Press L (or Record on the Looper), sing or say something for a couple of seconds, and press L again.",
        why: "The second press set the length. From now on that length is the bar everything else fits in.",
        done: (c) => layersOf(c) >= 1,
      },
      {
        do: "While it goes round, press L, add something over it, and press L again to finish the layer.",
        why: "A layer is recorded against the loop you already hear, so it lands in time. Three or four voices from one.",
        done: (c) => layersOf(c) >= 2,
      },
      {
        do: "Shift L takes the last layer off. Take one off, then put a better one on.",
        why: "The newest layer is the one to lose; the loop beneath it stays. A loop is a stack you edit from the top.",
        done: (c) => c.undos >= 1 && layersOf(c) >= 2,
      },
    ],
  },
  {
    id: "pedals",
    title: "Pedals",
    line: "A chain of effects, and why the order matters.",
    place: "9 · Pedals",
    start: (patch) => arrive(patch, "9 · Pedals", ["drive"]),
    steps: [
      {
        do: "Put the Drive after the Looper: Looper Out to Drive In, Drive Out to Speaker In.",
        why: "A pedal sits in the signal’s path: the sound goes in one side and comes out changed. Its Pedal switch lets the sound through untouched when it’s off.",
        done: (c) => chain(c.patch, "looper", "drive", "out"),
      },
      {
        do: "Play the loop and turn Drive up past 70%. Then bring Tone down under 1.5 kHz.",
        why: "Drive pushes the wave until its tops flatten, which adds overtones: grit. Tone takes the fizz off the top of what Drive added.",
        done: (c) => some(c, "drive", (p) => p.drive >= 0.7 && p.tone < 1500),
      },
      {
        do: "Add a Reverb after the Drive. Size past 3 seconds, Mix under 40%.",
        why: "The Reverb is a room drawn in sound. A long room at a low mix is far away; the same room at a high mix drowns.",
        done: (c) => chain(c.patch, "drive", "reverb") && some(c, "reverb", (p) => p.size >= 3 && p.mix <= 0.4),
      },
      {
        do: "Add a Tremolo or a Chorus somewhere in the chain. Switch it off and on while the loop plays.",
        why: "Off and on is how to hear what a pedal does: the ear only knows a change. Tremolo moves the loudness; Chorus moves the time.",
        done: (c) => ["trem", "chorus"].some((t) => ofType(c.patch, t).some((m) => heard(c.patch).has(m.id)) && c.tried(t, "on").size >= 2),
      },
      {
        do: "Swap two pedals: take their cables off and put them back the other way round. Listen for what changed.",
        why: "A chain reads in order: what comes first is heard through everything after it. Drive into Reverb is a loud thing in a room; Reverb into Drive is the room itself breaking up.",
        done: (c) => c.orders.size >= 2,
      },
    ],
  },
  {
    id: "pitch",
    title: "Pitch",
    line: "One voice, three parts.",
    place: "10 · Pitch",
    start: (patch) => arrive(patch, "10 · Pitch", ["pitch"]),
    steps: [
      {
        do: "Put the Pitch pedal between the Microphone and the Looper, so each layer is recorded at its own pitch.",
        why: "Before the Looper, a pedal is printed into the layer; after it, it colours everything at once. Pitch goes before, so the shift can be different for every layer.",
        done: (c) => chain(c.patch, "mic", "pitch", "looper"),
      },
      {
        do: "Shift −12. Press L, sing a low line, press L: a bass an octave under your voice.",
        why: "The pedal plays the same wave at half speed, so every frequency in it halves: an octave down. It’s your voice and it isn’t.",
        done: (c) => some(c, "pitch", (p) => p.semis <= -12) && c.layers >= 1,
      },
      {
        do: "Shift +7, and layer a second line over it.",
        why: "Seven semitones up is a fifth: the interval that sounds like the same note’s shadow. Two lines a fifth apart agree without matching.",
        done: (c) => some(c, "pitch", (p) => p.semis === 7) && c.layers >= 1,
      },
      {
        do: "Back to 0, and sing the melody on top.",
        why: "Three parts from one voice: the bass holds the ground, the fifth fills the middle, and the melody is the only one anyone hums.",
        done: (c) => some(c, "pitch", (p) => p.semis === 0) && c.layers >= 1,
      },
      {
        do: "Set the Pitch pedal’s Mix to about half: the original and the shifted copy together.",
        why: "At half mix the pedal is a second singer who always knows the harmony. That is how one voice sings a chord live.",
        done: (c) => some(c, "pitch", (p) => p.mix >= 0.3 && p.mix <= 0.7),
      },
    ],
  },
];
export const voiceLessonOf = (id) => VOICE_LESSONS.find((l) => l.id === id) || null;
// The single definition a module type has, for the arrive step (kept here so the lessons can say what they bring).
export const brings = (id) => (voiceLessonOf(id) ? [...new Set(voiceLessonOf(id).start(empty()).modules.map((m) => m.type))].filter((t) => t !== "out" && defOf(t)) : []);
