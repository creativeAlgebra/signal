// The master class: twelve sessions in four parts. Each session is a few builds (the lessons, ticked
// by the board), a playground (an open invitation, nothing ticked), a piece to make and keep, the
// producer's questions (the notebook: asked by the Ghost Producer when the AI is there, read as
// they are when it isn't), and one line on where the same idea lives in Logic Pro. Sessions 11 and
// 12 are named and not yet built. No DOM here, and no names of artists anywhere in it.
import { LESSONS } from "./lessons.js";
import { COURSE } from "./course.js";
import { VOICE_LESSONS } from "./voice.js";

export const PARTS = [
  { id: "sound", name: "Sound", line: "What a synthesizer is made of." },
  { id: "time", name: "Time", line: "The loop, and a track as a plan." },
  { id: "voice", name: "The voice", line: "Your voice as the instrument, through pedals." },
  { id: "piece", name: "The piece", line: "Play it from the keys, then perform it." },
];

const b = (kind, ...ids) => ids.map((id) => ({ kind, id }));
export const SESSIONS = [
  {
    n: 1,
    part: "sound",
    title: "A sound from nothing",
    line: "A wave, its shape, and a key to play it.",
    builds: b("patch", "signal", "shape", "keys"),
    playground: "Three waves into one Speaker. Find the pair that fights and the pair that hides inside each other.",
    piece: "One sound you would know in the dark. Keep it as a patch and give it a name.",
    logic: "In Logic Pro, Retro Synth is this board with the cables already in: its four engines (Analog, Sync, Table, FM) are four ways to make the wave.",
    asks: ["What is the one thing this sound does that a piano can’t?", "If you could keep only the Tune knob or the wave switch, which, and what would you lose?", "What moment in a song is this sound for?", "Which of the four waves did you stop hearing first, and why?"],
  },
  {
    n: 2,
    part: "sound",
    title: "Shape",
    line: "How a note starts and ends, and what a filter takes away.",
    builds: b("patch", "envelope", "filter", "filterenv"),
    playground: "The slowest attack you can stand, then the fastest. Somewhere between them is a bow, a breath and a hit.",
    piece: "A pluck and a pad from the same oscillator. Only the envelopes differ.",
    logic: "Every Logic synth has the same four letters on its envelopes, ADSR; the Filter section of Retro Synth or ES2 is this Filter, with Cutoff and Resonance under the same names.",
    asks: ["Where does the note end: when you let go, or later?", "What did the filter take away that you miss?", "Is the resonance a sound or a decoration?", "Which envelope would you set first next time, and why that one?"],
  },
  {
    n: 3,
    part: "sound",
    title: "Motion",
    line: "Something moves a knob for you; two waves beat; a wave bends a wave.",
    builds: b("patch", "lfo", "two", "echo", "fm"),
    playground: "One LFO into three places at once. Then unplug two and keep the one you can’t do without.",
    piece: "A sound that is never the same twice while a key is held.",
    logic: "In Logic, the LFO lives inside each synth and reaches its knobs through the modulation router (ES2 has two). Tape Delay is the Echo, as a plug-in on the channel strip.",
    asks: ["Is the movement slower than you notice, or is it a wobble?", "What does the second oscillator add that a louder first one wouldn’t?", "How many echoes before it stops being the note and becomes the room?", "FM made something metal. Is that the sound you wanted, or the one you got?"],
  },
  {
    n: 4,
    part: "time",
    title: "The loop",
    line: "Eight notes, one exception, and a bass that never stops.",
    builds: b("compose", "pulse", "bass"),
    playground: "The same eight steps at 70, 100 and 140 BPM. Your foot picks one.",
    piece: "A two-bar loop you could listen to for a minute without wanting to change it.",
    logic: "Logic’s Step Sequencer (in the editors) is this row of steps; Live Loops is a grid where each cell is a section you launch.",
    asks: ["Which note is the one you remember, and why that one?", "What happens to the loop if the exception moves one step later?", "Does the bass need to be heard, or felt?", "What would you take out of this loop before adding anything?"],
  },
  {
    n: 5,
    part: "time",
    title: "Layers",
    line: "Slow harmony under fast rhythm; two of a thing; movement slower than a bar.",
    builds: b("compose", "slow", "thick", "breathing"),
    playground: "Hold one chord for the whole loop. Change one note of it on bar three. Then change a different one instead.",
    piece: "Four bars where one thing moves fast and one thing moves slow.",
    logic: "A Track Stack puts several voices under one fader. The Chorus and Ensemble plug-ins thicken a sound the way two detuned oscillators do here.",
    asks: ["Which layer is the floor, and does it know it?", "Two things move. Does the ear follow one, or both?", "How slow can the change be before nobody notices it, and does that matter?", "If you muted the thickest layer, what would be left?"],
  },
  {
    n: 6,
    part: "time",
    title: "Space and hits",
    line: "The room plays too; a lead that sings; noise as a drum, and as weather.",
    builds: b("compose", "space", "voice", "hits"),
    playground: "One hit on beat two only, for eight bars. Then move it to beat four. Notice where you breathe.",
    piece: "A loop with more silence than notes in its lead.",
    logic: "Space Designer and ChromaVerb are Logic’s rooms. Drum Machine Designer holds a kit of hits. ES2’s third oscillator can be noise, as the Noise module is here.",
    asks: ["Is the echo in time with the pulse, or arguing with it?", "How many notes could the lead lose and still be a melody?", "Where does the hit land: on the pulse, or against it?", "What is the room for, in this piece?"],
  },
  {
    n: 7,
    part: "time",
    title: "Arrivals and the mix",
    line: "A track is a plan of arrivals, and every part gets a room of its own.",
    builds: b("compose", "arrivals", "mix"),
    playground: "Play all with the sections in reverse order. Something arrives too early. Find out what.",
    piece: "A track of four sections, each one adding a part, bounced to a .wav you would send someone.",
    logic: "The Arrangement track names sections. Channel EQ’s analyser shows each track’s energy, as Measure’s brightness does here. The master meter shows the peak, and 0 dB is the ceiling.",
    asks: ["Which arrival did you wait for, and did it come at the right time?", "Two parts are fighting over the same place. Which one gives way?", "Is the last section the loudest, or the fullest? Which did you mean?", "Is it done, or did you stop?"],
  },
  {
    n: 8,
    part: "voice",
    title: "Your voice is an instrument",
    line: "The microphone, and a loop that grows layer by layer.",
    builds: b("voice", "mic"),
    playground: "Record the room with nothing in it. Hum one note and build a chord from it. Make a beat from mouth sounds alone.",
    piece: "A piece of at least three layers, made with nothing but your voice.",
    logic: "In Logic, your voice goes on an audio track. A Live Loops cell can record from the microphone and go round, as this Looper does.",
    asks: ["Which layer did you record first, and is it still the one the others lean on?", "What would the loop lose if the newest layer went?", "Is there a layer that is only breath, or only the room? Should there be?", "How long is your loop, and did you choose that or did it happen?"],
  },
  {
    n: 9,
    part: "voice",
    title: "Pedals",
    line: "A chain of effects between the loop and the speaker, and why the order matters.",
    builds: b("voice", "pedals"),
    playground: "Every pedal on at once. Then switch them off one at a time until only the one that matters is left.",
    piece: "One voice loop through a chain of your own. Write down the order, so you can build it again.",
    logic: "Pedalboard is this chain as a row of stompboxes; drag one to change the order. Amp Designer is a Drive with a speaker on the end.",
    asks: ["Which pedal could you switch off without anyone noticing?", "Drive before Reverb, or after: which one did you mean?", "Is the chain making the sound, or hiding it?", "What does the loop sound like with every pedal off, and is that worse?"],
  },
  {
    n: 10,
    part: "voice",
    title: "Pitch",
    line: "One voice sings three parts: an octave down, a fifth up, and itself.",
    builds: b("voice", "pitch"),
    playground: "The same two bars at −12, −5, +7 and +12. One of them is a song.",
    piece: "A three-part harmony in one voice, bass first.",
    logic: "Pitch Shifter and Vocal Transformer are this pedal as plug-ins; Vocal Transformer moves pitch and formant separately, so a voice can go down an octave without growing. Flex Pitch moves notes after they are recorded.",
    asks: ["Does the bass line still sound like you? Should it?", "Which of the three parts would you keep if you could keep one?", "Where do the parts cross, and does it bother you?", "Did you sing the melody first, or last, and what changed because of that?"],
  },
  {
    n: 11,
    part: "piece",
    title: "Play it from the keys",
    line: "A layer becomes an instrument: the keyboard plays your recordings, in time.",
    builds: [],
    soon: true,
    playground: "Soon.",
    piece: "Soon.",
    logic: "Musical Typing (⌘K) is the computer keyboard as a piano, as here. Quick Sampler turns a recording into a playable instrument; Chord Trigger plays a chord from one key.",
    asks: ["Which sound would you most want under your fingers?", "Should a sample follow the key’s pitch, or stay as it was?", "What would you play that you can’t sing?", "How many keys does the piece need?"],
  },
  {
    n: 12,
    part: "piece",
    title: "Perform",
    line: "The tape runs: a piece from the first sound to the last, in one go.",
    builds: [],
    soon: true,
    playground: "Soon.",
    piece: "Soon.",
    logic: "Bounce (⌘B) renders the project to a file. Live Loops with Remix FX is Logic’s performance view.",
    asks: ["What has to happen first, and what has to happen last?", "Where will it go wrong, and is that the best part?", "Who is it for?", "Is it done, or did you stop?"],
  },
];
export const partOf = (id) => PARTS.find((p) => p.id === id) || PARTS[0];
export const sessionOf = (n) => SESSIONS.find((s) => s.n === Number(n)) || null;
export const sessionOfLesson = (kind, id) => SESSIONS.find((s) => s.builds.some((x) => x.kind === kind && x.id === id)) || null;
export const sessionsOf = (partId) => SESSIONS.filter((s) => s.part === partId);
// Every build names a lesson that exists.
export const buildDef = ({ kind, id }) => (kind === "compose" ? COURSE : kind === "voice" ? VOICE_LESSONS : LESSONS).find((l) => l.id === id) || null;
// A session is done when every build in it is (a session with no builds yet is never done).
export const sessionDone = (s, doneIds) => s.builds.length > 0 && s.builds.every((x) => doneIds.includes(x.id));
