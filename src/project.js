// A studio project: up to four voices (each its own patch), a loop of 16 steps a bar in each
// section, the tempo, and the Ghost Producer's notes that were kept. Plain data, changed only by
// making a new project, so it can be kept, undone and sent as a file:
// { v: 1, name, tempo, bars, front, voices: [{ id, role, name, patch }],
//   sections: [{ id, name, times, notes: { voiceId: [{ s: step, n: midi note, l: length in steps }] } }],
//   section, ghost: [{ id, at, model, about, move, text, kept }] }
// Nothing here touches sound or the page.
import { parse as parsePatch, empty as emptyPatch } from "./patch.js";

export const VERSION = 1;
export const STEPS = 16; // to the bar
export const MAX_VOICES = 4;
export const BAR_CHOICES = [1, 2, 4];
export const TIMES = [1, 2, 4];
export const TEMPO = { min: 50, max: 180, def: 100 };
// The four parts a voice starts as. Any name can be changed; the role stays, for the lessons.
export const ROLES = [
  { id: "pulse", name: "Pulse" },
  { id: "floor", name: "Floor" },
  { id: "voice", name: "Voice" },
  { id: "hit", name: "Hit" },
];
export const roleIndex = (role) => Math.max(0, ROLES.findIndex((r) => r.id === role));

const nextId = (list, prefix) => {
  let n = 1;
  const used = new Set(list.map((x) => x.id));
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const clampInt = (v, lo, hi, def) => {
  v = Math.round(Number(v));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
};

export function newProject({ name = "Untitled", patch = null, role = "pulse", voiceName = null } = {}) {
  const r = ROLES[roleIndex(role)];
  return {
    v: VERSION,
    name,
    tempo: TEMPO.def,
    bars: 2,
    front: "v1",
    voices: [{ id: "v1", role: r.id, name: voiceName || r.name, patch: patch || emptyPatch() }],
    sections: [{ id: "s1", name: "A", times: 1, notes: {} }],
    section: "s1",
    ghost: [],
  };
}

export const voiceOf = (pr, id) => pr.voices.find((v) => v.id === id) || null;
export const voiceByRole = (pr, role) => pr.voices.find((v) => v.role === role) || null;
export const frontOf = (pr) => voiceOf(pr, pr.front) || pr.voices[0];
export const sectionOf = (pr, id = pr.section) => pr.sections.find((s) => s.id === id) || pr.sections[0];
export const totalSteps = (pr) => pr.bars * STEPS;
export const stepSeconds = (pr) => 60 / pr.tempo / 4;
// The notes of one voice in a section, only those that fall inside the loop as long as it is now.
export const notesOf = (pr, voiceId, sectionId = pr.section) => (sectionOf(pr, sectionId)?.notes[voiceId] || []).filter((n) => n.s < totalSteps(pr));
export const notesAt = (pr, voiceId, step, sectionId) => notesOf(pr, voiceId, sectionId).filter((n) => n.s <= step && step < n.s + n.l);
export const voiceIndex = (pr, id) => pr.voices.findIndex((v) => v.id === id);
// Which voices have something to play in a section (a voice with no keyboard plays on its own, always).
export const activeVoices = (pr, sectionId = pr.section) => pr.voices.filter((v) => notesOf(pr, v.id, sectionId).length > 0).map((v) => v.id);

const mapVoice = (pr, id, f) => ({ ...pr, voices: pr.voices.map((v) => (v.id === id ? f(v) : v)) });
export const withPatch = (pr, id, patch) => mapVoice(pr, id, (v) => ({ ...v, patch }));
export const setFront = (pr, id) => (voiceOf(pr, id) && pr.front !== id ? { ...pr, front: id } : pr);
export const renameVoice = (pr, id, name) => mapVoice(pr, id, (v) => ({ ...v, name: String(name).trim().slice(0, 24) || v.name }));
export function addVoice(pr, patchFor = () => emptyPatch(), role = null) {
  if (pr.voices.length >= MAX_VOICES) return { project: pr, id: null };
  const free = ROLES.filter((r) => !pr.voices.some((v) => v.role === r.id));
  const r = (role && free.find((x) => x.id === role)) || free[0] || ROLES[pr.voices.length % ROLES.length];
  const id = nextId(pr.voices, "v");
  return { project: { ...pr, voices: [...pr.voices, { id, role: r.id, name: r.name, patch: patchFor(r.id) }], front: id }, id };
}
export function removeVoice(pr, id) {
  if (pr.voices.length < 2 || !voiceOf(pr, id)) return pr;
  const voices = pr.voices.filter((v) => v.id !== id);
  const sections = pr.sections.map((s) => {
    const notes = { ...s.notes };
    delete notes[id];
    return { ...s, notes };
  });
  return { ...pr, voices, sections, front: pr.front === id ? voices[Math.max(0, voiceIndex(pr, id) - 1)].id : pr.front };
}

export const setTempo = (pr, t) => ({ ...pr, tempo: clampInt(t, TEMPO.min, TEMPO.max, pr.tempo) });
// Fewer bars hides the notes beyond the end; they come back if the loop grows again.
export const setBars = (pr, b) => (BAR_CHOICES.includes(Number(b)) ? { ...pr, bars: Number(b) } : pr);

const mapSection = (pr, id, f) => ({ ...pr, sections: pr.sections.map((s) => (s.id === id ? f(s) : s)) });
const setNotes = (pr, voiceId, list, sectionId = pr.section) => mapSection(pr, sectionId, (s) => ({ ...s, notes: { ...s.notes, [voiceId]: [...list].sort((a, b) => a.s - b.s || a.n - b.n) } }));
const rawNotes = (pr, voiceId, sectionId = pr.section) => sectionOf(pr, sectionId)?.notes[voiceId] || [];
// A note in a step. A note of the same pitch that it runs into is replaced; other pitches stay, so chords can be built.
export function placeNote(pr, voiceId, s, n, l = 1, sectionId = pr.section) {
  const len = clampInt(l, 1, totalSteps(pr) - s, 1);
  if (s < 0 || s >= totalSteps(pr) || !voiceOf(pr, voiceId)) return pr;
  const keep = rawNotes(pr, voiceId, sectionId).filter((x) => x.n !== n || x.s + x.l <= s || x.s >= s + len);
  return setNotes(pr, voiceId, [...keep, { s, n: clampInt(n, 12, 120, 60), l: len }], sectionId);
}
export const removeNote = (pr, voiceId, s, n, sectionId = pr.section) => setNotes(pr, voiceId, rawNotes(pr, voiceId, sectionId).filter((x) => !(x.s === s && x.n === n)), sectionId);
export const repitch = (pr, voiceId, s, n, to, sectionId = pr.section) => {
  const note = rawNotes(pr, voiceId, sectionId).find((x) => x.s === s && x.n === n);
  return note ? placeNote(removeNote(pr, voiceId, s, n, sectionId), voiceId, s, to, note.l, sectionId) : pr;
};
export const clearVoice = (pr, voiceId, sectionId = pr.section) => setNotes(pr, voiceId, [], sectionId);

export const setSection = (pr, id) => (pr.sections.some((s) => s.id === id) ? { ...pr, section: id } : pr);
// A new section starts as a copy of the one in front, and comes after it.
export function addSection(pr) {
  if (pr.sections.length >= 12) return pr;
  const from = sectionOf(pr);
  const id = nextId(pr.sections, "s");
  const name = LETTERS.split("").find((l) => !pr.sections.some((s) => s.name === l)) || String(pr.sections.length + 1);
  const at = pr.sections.indexOf(from) + 1;
  const copy = { id, name, times: from.times, notes: JSON.parse(JSON.stringify(from.notes)) };
  return { ...pr, sections: [...pr.sections.slice(0, at), copy, ...pr.sections.slice(at)], section: id };
}
export function removeSection(pr, id) {
  if (pr.sections.length < 2) return pr;
  const i = pr.sections.findIndex((s) => s.id === id);
  if (i < 0) return pr;
  const sections = pr.sections.filter((s) => s.id !== id);
  return { ...pr, sections, section: pr.section === id ? sections[Math.max(0, i - 1)].id : pr.section };
}
export const renameSection = (pr, id, name) => mapSection(pr, id, (s) => ({ ...s, name: String(name).trim().slice(0, 16) || s.name }));
export const setTimes = (pr, id, times) => (TIMES.includes(Number(times)) ? mapSection(pr, id, (s) => ({ ...s, times: Number(times) })) : pr);
// How many bars the whole track runs, every section played its number of times.
export const songBars = (pr) => pr.sections.reduce((n, s) => n + s.times * pr.bars, 0);

// The Ghost Producer's notes. Only the kept ones are written when the project is kept.
export const addGhost = (pr, list) => ({ ...pr, ghost: [...(pr.ghost || []), ...list.map((g, i) => ({ ...g, id: g.id || `g${Date.now().toString(36)}${i}` }))] });
export const keepGhost = (pr, id) => ({ ...pr, ghost: (pr.ghost || []).map((g) => (g.id === id ? { ...g, kept: true } : g)) });
export const letGo = (pr, id) => ({ ...pr, ghost: (pr.ghost || []).filter((g) => g.id !== id) });

// Kept and read back. What isn't understood is left out, never a reason to lose the rest.
export function parseProject(raw) {
  let d = raw;
  if (typeof raw === "string") {
    try {
      d = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== "object" || !Array.isArray(d.voices)) return null;
  const voices = [];
  for (const v of d.voices.slice(0, MAX_VOICES)) {
    if (!v || typeof v !== "object" || typeof v.id !== "string" || voices.some((x) => x.id === v.id)) continue;
    const r = ROLES.find((x) => x.id === v.role) || ROLES[voices.length % ROLES.length];
    voices.push({ id: v.id, role: r.id, name: typeof v.name === "string" && v.name.trim() ? v.name.trim().slice(0, 24) : r.name, patch: parsePatch(v.patch) });
  }
  if (!voices.length) return null;
  const bars = BAR_CHOICES.includes(Number(d.bars)) ? Number(d.bars) : 2;
  const sections = [];
  for (const s of Array.isArray(d.sections) ? d.sections.slice(0, 12) : []) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || sections.some((x) => x.id === s.id)) continue;
    const notes = {};
    for (const v of voices) {
      const list = Array.isArray(s.notes?.[v.id]) ? s.notes[v.id] : [];
      const kept = list
        .filter((n) => n && Number.isFinite(Number(n.s)) && Number.isFinite(Number(n.n)))
        .map((n) => ({ s: clampInt(n.s, 0, 4 * STEPS - 1, 0), n: clampInt(n.n, 12, 120, 60), l: clampInt(n.l, 1, 4 * STEPS, 1) }))
        .slice(0, 512);
      if (kept.length) notes[v.id] = kept;
    }
    sections.push({ id: s.id, name: typeof s.name === "string" && s.name.trim() ? s.name.trim().slice(0, 16) : LETTERS[sections.length] || "?", times: TIMES.includes(Number(s.times)) ? Number(s.times) : 1, notes });
  }
  if (!sections.length) sections.push({ id: "s1", name: "A", times: 1, notes: {} });
  const ghost = (Array.isArray(d.ghost) ? d.ghost : [])
    .filter((g) => g && typeof g.text === "string" && g.text.trim())
    .slice(0, 60)
    .map((g, i) => ({ id: typeof g.id === "string" ? g.id : `g${i}`, at: typeof g.at === "string" ? g.at : "", model: typeof g.model === "string" ? g.model : "", about: typeof g.about === "string" ? g.about : "loop", move: typeof g.move === "string" ? g.move : "", text: g.text.trim().slice(0, 600), kept: true }));
  return {
    v: VERSION,
    name: typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 40) : "Untitled",
    tempo: clampInt(d.tempo, TEMPO.min, TEMPO.max, TEMPO.def),
    bars,
    front: voices.some((v) => v.id === d.front) ? d.front : voices[0].id,
    voices,
    sections,
    section: sections.some((s) => s.id === d.section) ? d.section : sections[0].id,
    ghost,
  };
}
export const serializeProject = (pr) =>
  JSON.stringify({
    v: VERSION,
    name: pr.name,
    tempo: pr.tempo,
    bars: pr.bars,
    front: pr.front,
    voices: pr.voices.map((v) => ({ id: v.id, role: v.role, name: v.name, patch: { v: v.patch.v, modules: v.patch.modules, cables: v.patch.cables, ...(v.patch.places?.length ? { places: v.patch.places } : {}) } })),
    sections: pr.sections,
    section: pr.section,
    ghost: (pr.ghost || []).filter((g) => g.kept).map(({ id, at, model, about, move, text }) => ({ id, at, model, about, move, text })),
  });
