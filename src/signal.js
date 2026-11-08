// Signal: a synthesizer to learn by patching, in the Arcade, loaded only when it's chosen. The board
// holds modules (an oscillator, a filter, an envelope…) and the cables between them; every card
// shows its own signal as it plays, so what a knob does is seen as well as heard. The lessons on the
// left take it one idea at a time, from a single wave to FM; each step is ticked when the patch, the
// knobs or the notes played say it's done, and only then says why. A patch can be kept and played on
// the computer's own keyboard (A to ' as a piano, W E T Y U O P the black keys, Z and X for the octave).
// Like the other full-screen games it's an overlay: it never touches the document, and Esc puts the
// page back as it was. Kept on this device ("subtextual-arcade-signal"): the projects, the lessons
// done, the patches kept, the octave and the sound switch.
//
// The studio: under the board runs the loop, one row per voice (up to four, each its own patch; the
// one in front is on the board, the others keep playing). Space plays it, R records the front voice
// from the keys, a click puts a note in a step. Sections are loops with names, played in order by
// Play all. Down the right runs a conversation with the Ghost Producer (Randall, 2026-11-08: a chat,
// not notes in bullets): the kid's words and its replies in turn, kept with the project on this
// device. It reads the patches, the loop and a few numbers measured from an offline render, and never
// hears the sound; its replies are marked as its own. Asked for a sound, it has hands (the hands,
// below): the board does its steps in front of the kid, one at a time with the reason beside the
// hand, each step one undo; a reply carries buttons when there is something to do, show or take back.
//
// The master class (sessions.js): twelve sessions in four parts, each a few builds (the lessons),
// a playground, a piece, the producer's question and a line on Logic Pro. The board is a floor with
// no edges under a camera (pan with two fingers or by dragging the floor, pinch or ⌘-scroll to
// zoom, ⌘0 to fit everything): the voice sessions arrive on one board, write their name on the
// floor where they start, and put down what they bring (a Microphone, a Looper, pedals) without
// taking anything away. The Looper's Record is L, Undo layer is Shift L.
import "./signal.css";
import "./looks.css";
import { MODULES, GROUPS, actionsOf, defOf, portOf, fits, isChoice, toValue, toTravel, readOf, tidy, FREE_HZ } from "./modules.js";
import { BOARD, CARD, empty, addModule, removeModule, moveModule, setParam, connect, canConnect, disconnect, cablesInto, kindOf, moduleOf, parse, serialize, keyed, freeSpot, bounds, heard as heardOf } from "./patch.js";
import { createEngine, midiHz, releaseMic } from "./audio.js";
import { LESSONS, lessonOf } from "./lessons.js";
import { PRESETS, presetOf, rolePatch } from "./presets.js";
import * as Pj from "./project.js";
import { createSequencer } from "./loop.js";
import { render as renderSound, wav, measure as measureSound } from "./render.js";
import { NAME as GHOST, systemFor, ASKS, drawCard, userFor, projectText, parseNotes, parseReply } from "./ghost.js";
import { courseOf, newCourse, COURSE_NAME } from "./course.js";
import { voiceLessonOf, newVoiceRig, VOICE_ID, VOICE_NAME, pedalOrder } from "./voice.js";
import { PARTS, sessionOf, sessionOfLesson, sessionsOf, partOf, buildDef, sessionDone } from "./sessions.js";
import { pressLabel, clockFromLoop } from "./looper.js";

export const KEY = "subtextual-arcade-signal";
const DEFAULTS = { work: null, lesson: null, done: [], patches: [], muted: false, octave: 4, side: "lessons", projects: null, current: null, paper: "", chats: {}, margin: 0 };
// The papers Signal can lie on (looks.css). None chosen means the system's: stone when it is light, slate when dark.
export const PAPERS = ["cream", "white", "stone", "slate", "black"];
const PAPER_NAMES = { cream: "Cream", white: "White", stone: "Stone", slate: "Slate", black: "Black" };
const DARK_PAPERS = new Set(["slate", "black"]);
const SYSTEM_PAPER = { light: "stone", dark: "slate" };
// The two projects the courses use, made the first time they're needed.
const PRACTICE = "practice",
  COURSE_ID = "course";
const prefs = () => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    return { ...DEFAULTS, ...(p && typeof p === "object" ? p : {}) };
  } catch {
    return { ...DEFAULTS };
  }
};
const keep = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...prefs(), ...p }));
  } catch {}
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ICON = {
  add: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  muted: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="m16 10 4 4m0-4-4 4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
// The four waves, drawn small for the wave switches.
const WAVE = {
  sine: "M2 8C4.5 1 7.5 1 10 8s5.5 7 8 0",
  triangle: "M2 8 6 2l8 12 4-6",
  sawtooth: "M2 12 10 3v9l8-9",
  square: "M2 12V4h8v8h8V4",
};
const WAVE_NAMES = { sine: "Sine", triangle: "Triangle", sawtooth: "Saw", square: "Square" };
// The computer's keys as a piano: the codes (so any layout plays by position) and the letters drawn on them.
export const PIANO = [
  ["KeyA", "A", 0],
  ["KeyW", "W", 1],
  ["KeyS", "S", 2],
  ["KeyE", "E", 3],
  ["KeyD", "D", 4],
  ["KeyF", "F", 5],
  ["KeyT", "T", 6],
  ["KeyG", "G", 7],
  ["KeyY", "Y", 8],
  ["KeyH", "H", 9],
  ["KeyU", "U", 10],
  ["KeyJ", "J", 11],
  ["KeyK", "K", 12],
  ["KeyO", "O", 13],
  ["KeyL", "L", 14],
  ["KeyP", "P", 15],
  ["Semicolon", ";", 16],
  ["Quote", "'", 17],
];
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const noteName = (n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const BLACK = new Set([1, 3, 6, 8, 10]);
const VOICE_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4"];
const fileName = (name, ext) => `${String(name || "Signal").replace(/[\\/:*?"<>|]+/g, " ").trim() || "Signal"}${ext}`;
const when = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};
const clockTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
};

let current = null;

// Options: onClose; ai, the app's door to the AI (ready, model, ask, setup, failed), as Keyfall has;
// save(blob, name), where a file goes when one is made (a download, if left out).
// Returns the dialog's api (also on dialog.signal, for tests).
export function openSignal({ onClose = null, ai = null, save: saveFile = null } = {}) {
  if (current) return current;
  const back = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const darkMQ = matchMedia("(prefers-color-scheme: dark)");
  let p = prefs();
  // One clock for every voice: an AudioContext made on first use, and the last stage they share.
  const studio = { ac: null, bus: null, master: null };
  function clock() {
    if (studio.ac) return studio.ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = (studio.ac = new AC({ latencyHint: "interactive" }));
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    studio.master = ac.createGain();
    studio.master.gain.value = p.muted ? 0 : 0.9;
    studio.master.connect(comp).connect(ac.destination);
    studio.bus = ac.createGain();
    studio.bus.connect(studio.master);
    return ac;
  }
  const engines = new Map(); // voice id → engine
  // Each engine gets the loop's grid (for a Looper that records whole bars) and a way to say a module's state changed.
  const newEngine = () => {
    const e = createEngine({ context: clock, out: () => (clock(), studio.bus), grid, changed: (id) => onChanged(id, e) });
    return e;
  };
  let engine = null; // the front voice's

  const dialog = document.createElement("dialog");
  dialog.className = "signal";
  dialog.setAttribute("aria-label", "Signal");
  dialog.tabIndex = -1;
  dialog.innerHTML = `
    <header class="sg-head">
      <h2 class="sg-title">Signal <span class="sg-beta">Beta</span></h2>
      <div class="sg-corner">
        <button type="button" class="sg-paper" data-act="paper" aria-haspopup="menu" aria-expanded="false" title="Choose the paper"><i class="sg-swatch" aria-hidden="true"></i><span>Paper</span></button>
        <button type="button" data-act="sound"></button>
        <button type="button" data-act="close" aria-label="Return to your page" title="Return to your page (Esc)">${svg("close")}</button>
      </div>
    </header>
    <div class="sg-body">
      <aside class="sg-side">
        <div class="sg-seg" role="tablist" aria-label="Lessons, patches, projects">
          <button type="button" role="tab" data-side="lessons">Sessions</button>
          <button type="button" role="tab" data-side="patches">Patches</button>
          <button type="button" role="tab" data-side="projects">Projects</button>
          <button type="button" role="tab" data-side="notes" class="sg-notes-tab">Notes</button>
        </div>
        <div class="sg-panel"></div>
      </aside>
      <div class="sg-shead"><p class="sg-front"></p><div class="sg-corner sg-btools">
        <button type="button" data-act="undo" aria-label="Undo" title="Undo (⌘Z)">${svg("undo")}</button>
        <button type="button" class="sg-add" data-act="add" aria-haspopup="menu" aria-expanded="false" title="Add a module">${svg("add")}<span>Add</span></button>
      </div></div>
      <div class="sg-stage"><div class="sg-board"><svg class="sg-cables" aria-hidden="true"></svg></div><button type="button" class="sg-zoom" data-act="fit" title="Fit everything (⌘0)" hidden></button></div>
      <section class="sg-loop" aria-label="Loop"></section>
      <aside class="sg-margin" aria-label="${GHOST}"><div class="sg-resize" data-act="resize" title="Drag to change the width"></div><div class="sg-ghost"></div></aside>
    </div>
    <div class="sg-kbd">
      <p class="sg-oct"><span data-oct></span><span class="sg-oct-keys"><kbd>Z</kbd><kbd>X</kbd></span></p>
      <div class="sg-piano" role="group" aria-label="Keyboard"></div>
      <p class="sg-held" aria-live="off"></p>
    </div>
    <div class="sg-menu" role="menu" aria-label="Add a module" hidden></div>
    <p class="sg-said" role="status" aria-live="polite"></p>`;
  document.body.appendChild(dialog);
  dialog.showModal();
  const $ = (s) => dialog.querySelector(s);
  // The paper comes from the prefs; with none chosen, Signal follows the system: stone when it is light, slate when dark.
  const chosenPaper = () => (PAPERS.includes(p.paper) ? p.paper : "");
  function applyTheme() {
    const paper = chosenPaper() || SYSTEM_PAPER[darkMQ.matches ? "dark" : "light"];
    dialog.dataset.paper = paper;
    dialog.dataset.theme = DARK_PAPERS.has(paper) ? "dark" : "light";
    $(".sg-paper .sg-swatch").dataset.paper = paper;
  }
  applyTheme();
  const onScheme = () => applyTheme();
  darkMQ.addEventListener?.("change", onScheme);
  const stage = $(".sg-stage"),
    zoomEl = $(".sg-zoom"),
    board = $(".sg-board"),
    wires = $(".sg-cables"),
    panel = $(".sg-panel"),
    menu = $(".sg-menu"),
    piano = $(".sg-piano"),
    said = $(".sg-said"),
    loopEl = $(".sg-loop"),
    marginEl = $(".sg-margin"),
    bodyEl = $(".sg-body"),
    frontEl = $(".sg-front");
  if (p.margin) bodyEl.style.setProperty("--sg-margin", `${Math.max(240, Math.min(560, Number(p.margin) || 264))}px`);
  // A wide window has the Ghost Producer's column on the right; a narrower one has it as a tab.
  const wideMQ = matchMedia("(min-width: 1200px)");
  // The board layer is the lessons' area in size (so it has a size to click on); what's on it may lie anywhere on the floor.
  wires.setAttribute("viewBox", `0 0 ${BOARD.w} ${BOARD.h}`);
  board.style.width = `${BOARD.w}px`;
  board.style.height = `${BOARD.h}px`;
  // The producer's hand (the hands, below): on the board in its units, so it moves and scales with the camera.
  const hand = document.createElement("div");
  hand.className = "sg-hand";
  hand.setAttribute("aria-hidden", "true");
  hand.innerHTML = `<i></i><p class="sg-hand-say"></p>`;
  board.appendChild(hand);

  // ---------- state ----------
  // The projects on this device: [{ id, name, at, data }]. The first time, the board as it was left
  // (from before there were projects) becomes the practice project the patching lessons use.
  if (!Array.isArray(p.projects)) {
    const old = p.work ? parse(p.work) : null;
    p.projects = old ? [{ id: PRACTICE, name: "Practice", at: new Date().toISOString(), data: Pj.serializeProject(Pj.newProject({ name: "Practice", patch: old, voiceName: "Sound" })) }] : [];
    p.current = old ? PRACTICE : null;
  }
  let currentId = p.current;
  let project = null;
  {
    const row = p.projects.find((x) => x.id === currentId);
    project = row ? Pj.parseProject(row.data) : null;
    if (!project) currentId = null;
  }
  let patch = project ? Pj.frontOf(project).patch : null; // the front voice's, on the board
  let lesson = null; // { kind: "patch" | "compose" | "voice", id, step }
  // Undo keeps whole projects (they share everything that didn't change), so a knob, a cable and a note undo alike.
  const undo = [],
    redo = [];
  const fresh = () => ({ notes: 0, tried: new Map(), loops: 0, song: 0, layers: 0, undos: 0, orders: new Set() });
  let counters = fresh();
  let numbers = null; // the last measurement
  let pen = 48; // the note a click puts in the loop: the last one played
  let rec = false;
  const recording = new Map(); // key → { s, n, section, t }
  const seq = createSequencer({
    clock: () => studio.ac,
    project: () => project,
    engineOf: (id) => engines.get(id),
    on: {
      turn: () => ((counters.loops += 1), check()),
      end: () => ((rec = false), renderTransport()),
    },
  });
  const remember = () => (undo.push(project), undo.length > 120 && undo.shift(), (redo.length = 0));
  // The front voice's patch changed.
  const put = (next) => ((patch = next), (project = Pj.withPatch(project, project.front, next)));
  // Every voice plays its own patch; a voice whose patch changed starts again from it.
  function syncEngines() {
    for (const v of project.voices) {
      let e = engines.get(v.id);
      if (!e) engines.set(v.id, (e = newEngine()));
      if (e.patch !== v.patch) e.load(v.patch);
    }
    for (const [id, e] of [...engines]) if (!Pj.voiceOf(project, id)) (e.close(), engines.delete(id));
    engine = engines.get(project.front);
  }
  let saidTimer = 0;
  function say(text) {
    said.textContent = text;
    said.classList.add("is-on");
    clearTimeout(saidTimer);
    saidTimer = setTimeout(() => said.classList.remove("is-on"), 3200);
  }
  // Kept a moment after the last change (a knob being turned changes many times a second).
  let saveTimer = 0;
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (!project) return;
    const row = { id: currentId, name: project.name, at: new Date().toISOString(), data: Pj.serializeProject(project) };
    p.projects = [row, ...p.projects.filter((x) => x.id !== currentId)].slice(0, 40);
    keep({ work: serialize(patch), lesson: lesson ? { kind: lesson.kind, id: lesson.id, step: lesson.step } : null, projects: p.projects, current: currentId });
  }
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 150);
  };
  // A change to the patch on the board: kept for undo, heard, drawn, checked against the lesson.
  function commit(next, { history = true, rebuild = true } = {}) {
    if (next === patch) return;
    if (history) remember();
    put(next);
    if (rebuild) (engine.load(patch), render());
    else renderLoop();
    save();
    check();
  }
  // A change to the project (the loop, the voices, the sections).
  function commitProject(next, { history = true, board = false } = {}) {
    if (next === project) return;
    if (history) remember();
    const front = project.front;
    project = next;
    patch = Pj.frontOf(project).patch;
    syncEngines();
    if (board || front !== project.front) render();
    else (renderLoop(), renderMargin());
    save();
    check();
  }
  function restore(from, to) {
    const prev = from.pop();
    if (!prev) return say(from === undo ? "Nothing to undo." : "Nothing to redo.");
    to.push(project);
    project = prev;
    patch = Pj.frontOf(project).patch;
    syncEngines();
    render();
    save();
    check();
  }
  // Another project on the board: everything stops and starts again from it.
  function openProject(id, make = null) {
    if (project && currentId === id) return;
    if (project) flush();
    doing?.controller.abort();
    stopLoop();
    liftAll();
    const row = p.projects.find((x) => x.id === id);
    const next = (row && Pj.parseProject(row.data)) || (make ? make() : null);
    if (!next) return;
    for (const e of engines.values()) e.close();
    engines.clear();
    engine = null;
    currentId = id;
    project = next;
    patch = Pj.frontOf(project).patch;
    undo.length = redo.length = 0;
    numbers = null;
    layersSeen.clear();
    loadChat();
    syncEngines();
    render();
    flush();
  }
  const newId = () => `j${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

  // ---------- the floor and the camera ----------
  // The board has no edges. The camera is the point of the floor at the stage's top-left (x, y, in
  // the board's units) and a scale k; the board layer is moved and scaled under it, so a card at
  // (x, y) on the floor shows at ((x − cam.x)·k, (y − cam.y)·k) in the stage. Fitted, everything on
  // the floor is in view (the lessons' area at least, never smaller than 0.3). The dots on the floor
  // move with it. Pinched or ⌘-scrolled it zooms around the pointer, up to twice its size.
  const ZOOM_MIN = 0.25,
    ZOOM_MAX = 2,
    PAD = 16,
    GRID = 48;
  const cam = { x: 0, y: 0, k: 1 };
  let scale = 1; // = cam.k, as the drawing code reads it
  let atFit = true;
  function applyCamera() {
    scale = cam.k;
    board.style.transform = `translate(${(-cam.x * cam.k).toFixed(2)}px, ${(-cam.y * cam.k).toFixed(2)}px) scale(${cam.k})`;
    const g = GRID * cam.k;
    const wrap = (v) => ((v % g) + g) % g;
    stage.style.backgroundSize = `${g}px ${g}px`;
    stage.style.backgroundPosition = `${wrap(-cam.x * cam.k).toFixed(2)}px ${wrap(-cam.y * cam.k).toFixed(2)}px`;
    zoomEl.hidden = atFit;
    zoomEl.textContent = `${Math.round(cam.k * 100)}%`;
    measure();
    drawCables();
  }
  // What "fit" shows: everything on the floor, and the lessons' area.
  function fitBox() {
    const b = bounds(patch);
    const x0 = Math.min(0, b.x),
      y0 = Math.min(0, b.y),
      x1 = Math.max(BOARD.w, b.x + b.w),
      y1 = Math.max(BOARD.h, b.y + b.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  let sharpen = 0;
  // The cards' drawings are redrawn at the new size once the fingers stop.
  const sharpenLater = () => {
    clearTimeout(sharpen);
    sharpen = setTimeout(() => board.querySelectorAll("canvas.sg-view").forEach(sizeCanvas), 140);
  };
  function fit() {
    if (!patch) return;
    const f = fitBox();
    const w = stage.clientWidth - 2 * PAD,
      h = stage.clientHeight - 2 * PAD;
    if (w <= 0 || h <= 0) return;
    cam.k = Math.max(0.3, Math.min(1, w / f.w, h / f.h));
    cam.x = f.x + f.w / 2 - stage.clientWidth / 2 / cam.k;
    cam.y = f.y + f.h / 2 - stage.clientHeight / 2 / cam.k;
    atFit = true;
    applyCamera();
    sharpenLater();
  }
  const unzoom = () => fit();
  // Where a point in the window is on the floor.
  const toWorld = (cx, cy) => {
    const r = stage.getBoundingClientRect();
    return [cam.x + (cx - r.left) / cam.k, cam.y + (cy - r.top) / cam.k];
  };
  // Zoom to a scale, keeping the point of the floor under (cx, cy) where it is (the stage's middle if left out).
  function zoomTo(next, cx, cy) {
    const r = stage.getBoundingClientRect();
    if (cx == null) ((cx = r.left + r.width / 2), (cy = r.top + r.height / 2));
    const [wx, wy] = toWorld(cx, cy);
    cam.k = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    cam.x = wx - (cx - r.left) / cam.k;
    cam.y = wy - (cy - r.top) / cam.k;
    atFit = false;
    applyCamera();
    sharpenLater();
  }
  // Move the floor by (dx, dy) of the stage's pixels.
  function panBy(dx, dy) {
    cam.x -= dx / cam.k;
    cam.y -= dy / cam.k;
    atFit = false;
    applyCamera();
  }
  // The part of the floor in view, in the board's units: where a new module goes.
  const viewRect = () => ({ x: cam.x, y: cam.y, w: stage.clientWidth / cam.k, h: stage.clientHeight / cam.k });
  // A pinch on a trackpad arrives as a wheel with Ctrl held (Safari sends gestures instead); ⌘-scroll zooms too.
  // Two fingers without a pinch move the floor.
  function onWheel(e) {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (e.ctrlKey || e.metaKey) return zoomTo(cam.k * Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.01), e.clientX, e.clientY);
    const dx = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
    panBy(-dx, -dy);
  }
  let gestureFrom = 1;
  const onGestureStart = (e) => (e.preventDefault(), (gestureFrom = cam.k));
  const onGestureChange = (e) => (e.preventDefault(), zoomTo(gestureFrom * e.scale, e.clientX, e.clientY));
  // Two fingers on a touch screen: a pinch zooms around their middle, and moving them moves the floor.
  const fingers = new Map(); // pointerId → [x, y]
  let pinch = null; // { d, k, mx, my }
  const isFloor = (t) => t === stage || t === board || (t.closest?.(".sg-cables, .sg-place") && !t.closest?.(".sg-cable"));
  const kindColor = (k) => `var(--sg-${k})`;
  function knobHTML(m, key, d) {
    const v = m.p[key];
    const t = toTravel(d, v);
    // The fill runs from the knob's zero: the left end, or the middle for a knob that goes both ways.
    const t0 = d.min < 0 && d.max > 0 ? toTravel(d, 0) : 0;
    const a0 = -135 + 270 * t0,
      a1 = -135 + 270 * t;
    const arc = (from, to) => {
      const r = 15,
        c = 18;
      const pt = (a) => [c + r * Math.sin((a * Math.PI) / 180), c - r * Math.cos((a * Math.PI) / 180)];
      const [x0, y0] = pt(from),
        [x1, y1] = pt(to);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };
    const tip = (() => {
      const a = (a1 * Math.PI) / 180;
      return `M${(18 + 11 * Math.sin(a)).toFixed(2)} ${(18 - 11 * Math.cos(a)).toFixed(2)}L${(18 + 15 * Math.sin(a)).toFixed(2)} ${(18 - 15 * Math.cos(a)).toFixed(2)}`;
    })();
    return `<div class="sg-knob" role="slider" tabindex="0" style="--t:${t.toFixed(4)}" data-mod="${m.id}" data-key="${key}" aria-label="${esc(MODULES[m.type].name)} ${esc(d.label)}" aria-valuemin="${d.min}" aria-valuemax="${d.max}" aria-valuenow="${v}" aria-valuetext="${esc(readOf(d, v))}" title="Drag up or down. Double-click to reset.">
      <svg viewBox="0 0 36 36" aria-hidden="true"><path class="sg-knob-track" d="${arc(-135, 135)}"/>${Math.abs(t - t0) > 0.002 ? `<path class="sg-knob-fill" d="${arc(Math.min(a0, a1), Math.max(a0, a1))}"/>` : ""}<path class="sg-knob-tip" d="${tip}"/></svg>
      <span class="sg-knob-label">${esc(d.label)}</span><span class="sg-knob-value">${esc(readOf(d, v))}</span></div>`;
  }
  function choiceHTML(m, key, d) {
    return `<div class="sg-choice" role="radiogroup" aria-label="${esc(MODULES[m.type].name)} ${esc(d.label)}">${d.options
      .map((o) => {
        const on = m.p[key] === o;
        const face = WAVE[o] ? `<svg viewBox="0 0 20 16" aria-hidden="true"><path d="${WAVE[o]}"/></svg>` : esc(d.names?.[o] || o);
        const name = WAVE_NAMES[o] || d.names?.[o] || o;
        return `<button type="button" role="radio" aria-checked="${on}" data-mod="${m.id}" data-key="${key}" data-val="${o}" aria-label="${esc(name)}" title="${esc(name)}">${face}</button>`;
      })
      .join("")}</div>`;
  }
  function paramsHTML(m) {
    const d = defOf(m.type);
    let choices = "",
      knobs = "";
    for (const [key, pd] of Object.entries(d.params)) {
      if (pd.text) continue;
      if (pd.when && !cablesInto(patch, m.id, pd.when).length) continue;
      if (isChoice(pd)) choices += choiceHTML(m, key, pd);
      else knobs += knobHTML(m, key, pd);
    }
    return choices + (knobs ? `<div class="sg-knobs">${knobs}</div>` : "");
  }
  // A card's buttons (the Looper's Record, Undo layer, Clear, Set the clock from it), worded for the module's state now.
  function actsButtons(m) {
    const st = engine?.state(m.id) || null;
    return actionsOf(m.type)
      .map((a) => {
        const label = a.id === "press" ? pressLabel(st?.mode || "idle", m.p.sync) : a.label;
        const off = (a.id === "undo" && !(st?.layers > 0)) || (a.id === "clear" && !(st?.layers > 0) && (st?.mode || "idle") === "idle") || (a.id === "clock" && !(st?.length > 0));
        return `<button type="button" data-act="modact" data-mod="${m.id}" data-action="${a.id}"${a.id === "press" ? ` data-mode="${st?.mode || "idle"}"` : ""}${off ? " disabled" : ""} title="${esc(a.label)}${a.key ? ` (${a.key})` : ""}">${esc(label)}${a.key ? `<kbd>${esc(a.key)}</kbd>` : ""}</button>`;
      })
      .join("");
  }
  const STATEFUL = new Set(["mic", "looper"]);
  function cardHTML(m, isHeard) {
    const d = defOf(m.type);
    const jack = (dir, port) =>
      `<button type="button" class="sg-jack" data-mod="${m.id}" data-dir="${dir}" data-port="${port.id}" data-kind="${port.kind}" aria-label="${esc(d.name)} ${esc(port.label)} ${dir === "in" ? "input" : "output"}" title="${esc(port.label)} (${port.kind})"></button>`;
    const port = (dir, pt) => `<li class="sg-port" data-dir="${dir}">${dir === "in" ? jack(dir, pt) : ""}<span>${esc(pt.label)}</span>${dir === "out" ? jack(dir, pt) : ""}</li>`;
    // A note has words where the others have a window (the newline after the tag is the one the parser drops).
    const view = d.note
      ? `<textarea class="sg-words" data-note="${m.id}" rows="1" placeholder="Write here" aria-label="Note">\n${esc(m.p.text)}</textarea>`
      : m.type === "keys"
        ? `<p class="sg-view sg-notes" data-view="${m.id}"></p>`
        : `<canvas class="sg-view" data-view="${m.id}" aria-hidden="true"></canvas>`;
    return `<section class="sg-mod${isHeard ? "" : " is-quiet"}" data-id="${m.id}" data-type="${m.type}" style="left:${m.x}px;top:${m.y}px" aria-label="${esc(d.name)}">
      <header class="sg-mod-head" title="${esc(d.line)}"><span class="sg-mod-name">${esc(d.name)}</span>${d.fixed ? "" : `<button type="button" class="sg-x" data-act="remove" data-mod="${m.id}" aria-label="Remove ${esc(d.name)}" title="Remove">${svg("x")}</button>`}</header>
      ${view}
      ${d.ins.length || d.outs.length ? `<div class="sg-ports"><ul class="sg-ins">${d.ins.map((pt) => port("in", pt)).join("")}</ul><ul class="sg-outs">${d.outs.map((pt) => port("out", pt)).join("")}</ul></div>` : ""}
      <div class="sg-params">${paramsHTML(m)}</div>
      ${STATEFUL.has(m.type) ? `<p class="sg-state" data-state="${m.id}"></p>` : ""}${actionsOf(m.type).length ? `<div class="sg-acts" data-acts="${m.id}">${actsButtons(m)}</div>` : ""}
    </section>`;
  }
  // A name on the floor: where a session of the master class arrived.
  const placeHTML = (pl) => `<p class="sg-place" data-place="${esc(pl.id)}" style="left:${pl.x}px;top:${pl.y}px">${esc(pl.name)}</p>`;
  const jacks = new Map(); // "mod.dir.port" → [x, y] in board units
  function render() {
    const focusKey = document.activeElement?.closest?.(".signal") ? keyOf(document.activeElement) : null;
    const isHeard = heardOf(patch);
    board.querySelectorAll(".sg-mod, .sg-place").forEach((n) => n.remove());
    board.insertAdjacentHTML("afterbegin", (patch.places || []).map(placeHTML).join("") + patch.modules.map((m) => cardHTML(m, isHeard.has(m.id) || m.type === "out" || !!defOf(m.type)?.note)).join(""));
    // While a Looper is on the board, L is its Record, not the piano's D.
    piano.classList.toggle("has-looper", patch.modules.some((m) => m.type === "looper"));
    for (const c of board.querySelectorAll("canvas.sg-view")) sizeCanvas(c);
    for (const t of board.querySelectorAll("textarea[data-note]")) growNote(t);
    for (const c of patch.cables) {
      board.querySelector(`.sg-jack[data-mod="${c.from[0]}"][data-dir="out"][data-port="${c.from[1]}"]`)?.classList.add("is-plugged");
      board.querySelector(`.sg-jack[data-mod="${c.to[0]}"][data-dir="in"][data-port="${c.to[1]}"]`)?.classList.add("is-plugged");
    }
    measure();
    drawCables();
    renderFront();
    renderLoop();
    renderPanel();
    renderMargin();
    if (focusKey) {
      const f = dialog.querySelector(focusKey);
      f?.focus({ preventScroll: true });
      if (f?.dataset.note) f.setSelectionRange(f.value.length, f.value.length);
    }
  }
  const keyOf = (el) => {
    if (el.dataset.note) return `textarea[data-note="${el.dataset.note}"]`;
    if (el.dataset.mod && el.dataset.key) return `[data-mod="${el.dataset.mod}"][data-key="${el.dataset.key}"]${el.dataset.val ? `[data-val="${el.dataset.val}"]` : ""}`;
    if (el.classList.contains("sg-jack")) return `.sg-jack[data-mod="${el.dataset.mod}"][data-dir="${el.dataset.dir}"][data-port="${el.dataset.port}"]`;
    if (el.dataset.side) return `[data-side="${el.dataset.side}"]`;
    return null;
  };
  function measure() {
    jacks.clear();
    const b = board.getBoundingClientRect();
    for (const j of board.querySelectorAll(".sg-jack")) {
      const r = j.getBoundingClientRect();
      jacks.set(`${j.dataset.mod}.${j.dataset.dir}.${j.dataset.port}`, [(r.left + r.width / 2 - b.left) / scale, (r.top + r.height / 2 - b.top) / scale]);
    }
  }
  const pathOf = ([x1, y1], [x2, y2]) => {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const sag = Math.min(110, dist * 0.22) + 18;
    const dx = Math.max(36, Math.abs(x2 - x1) * 0.35);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + dx).toFixed(1)} ${(y1 + sag).toFixed(1)} ${(x2 - dx).toFixed(1)} ${(y2 + sag).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  let pulling = null; // a cable being drawn: { from: [mod, port] | null, to: [mod, port] | null, kind, at: [x, y] }
  function drawCables() {
    let out = "";
    for (const c of patch.cables) {
      const a = jacks.get(`${c.from[0]}.out.${c.from[1]}`),
        b = jacks.get(`${c.to[0]}.in.${c.to[1]}`);
      if (!a || !b) continue;
      const d = pathOf(a, b);
      const k = kindOf(patch, c);
      out += `<g class="sg-cable" data-cable="${c.id}" data-kind="${k}"><path class="sg-cable-hit" d="${d}"/><path class="sg-cable-line" d="${d}" stroke="${kindColor(k)}"/></g>`;
    }
    if (pulling) {
      const fixed = pulling.from ? jacks.get(`${pulling.from[0]}.out.${pulling.from[1]}`) : jacks.get(`${pulling.to[0]}.in.${pulling.to[1]}`);
      if (fixed) out += `<path class="sg-cable-line is-pulling" d="${pulling.from ? pathOf(fixed, pulling.at) : pathOf(pulling.at, fixed)}" stroke="${kindColor(pulling.kind)}"/>`;
    }
    wires.innerHTML = out;
    // Cables run under the cards so every label stays readable; the one being pulled rides on top.
    board.classList.toggle("is-pulling", !!pulling);
  }
  // Each card's picture, drawn every frame from its analyser.
  function sizeCanvas(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 156,
      h = c.clientHeight || 46;
    c.width = Math.round(w * dpr * scale);
    c.height = Math.round(h * dpr * scale);
  }
  const hist = new Map();
  const freqs = (() => {
    const f = new Float32Array(72);
    for (let i = 0; i < f.length; i++) f[i] = 20 * 1000 ** (i / (f.length - 1));
    return f;
  })();
  const css = (name) => getComputedStyle(dialog).getPropertyValue(name).trim();
  let colors = {};
  const readColors = () => (colors = { ink: css("--sg-ink"), dim: css("--sg-dim"), line: css("--sg-line"), mod: css("--sg-mod"), audio: css("--sg-ink"), wash: css("--sg-wash"), rec: css("--sg-rec"), view: css("--sg-view-ink") || css("--sg-ink"), viewLine: css("--sg-view-line") || css("--sg-line"), viewDim: css("--sg-view-dim") || css("--sg-dim"), viewWash: css("--sg-view-wash") || css("--sg-wash") });
  const MIC_TEXT = { off: "Off", asking: "Asking the browser…", live: "Live", denied: "The browser said no. Allow the microphone for this site, then switch it on again.", none: "No microphone here." };
  const looperText = (st) => {
    if (!st || st.mode === "idle") return "Empty. Press L to record.";
    if (st.mode === "armed") return "Starting…";
    if (st.mode === "recording") return st.layers ? "Recording a layer…" : "Recording… press L to set the length.";
    return `${st.layers} layer${st.layers === 1 ? "" : "s"} · ${st.length.toFixed(1)} s${st.mode === "overdub" ? " · recording over it" : ""}`;
  };
  function drawViews() {
    for (const el of board.querySelectorAll("[data-state]")) {
      const m = moduleOf(patch, el.dataset.state);
      if (!m) continue;
      const st = engine.state(m.id);
      const text = m.type === "mic" ? MIC_TEXT[st?.status || "off"] || "" : looperText(st);
      if (el.textContent !== text) el.textContent = text;
    }
    for (const el of board.querySelectorAll("[data-view]")) {
      const m = moduleOf(patch, el.dataset.view);
      if (!m) continue;
      if (m.type === "keys") {
        const n = engine.notes();
        el.textContent = n.length ? n.map(noteName).join("  ") : keyed(patch) ? "Play A to ’ on your keyboard" : "Not plugged in";
        el.classList.toggle("is-on", n.length > 0);
        continue;
      }
      const g = el.getContext("2d");
      const W = el.width,
        H = el.height;
      g.clearRect(0, 0, W, H);
      g.lineWidth = Math.max(1, W / 156) * 1.4;
      g.lineJoin = "round";
      if (m.type === "env") drawEnv(g, W, H, m);
      else if (m.type === "lfo") drawTrace(g, W, H, m);
      else if (m.type === "filter") drawFilter(g, W, H, m);
      else drawWave(g, W, H, m);
      if (m.type === "looper") drawLooper(g, W, H, m);
    }
  }
  // Over the Looper's wave: how far round the loop is (a line along the top), red while it records.
  function drawLooper(g, W, H, m) {
    const st = engine.state(m.id);
    if (!st || !st.length) return;
    g.fillStyle = st.recording ? colors.rec : colors.mod;
    g.fillRect(0, 0, Math.max(2, W * st.position), Math.max(2, H / 16));
  }
  function drawWave(g, W, H, m) {
    const buf = engine.read(m.id, "wave");
    g.strokeStyle = colors.viewLine;
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
    if (!buf) return;
    let start = 0;
    for (let i = 1; i < 1024; i++)
      if (buf[i - 1] < 0 && buf[i] >= 0) {
        start = i;
        break;
      }
    const n = 820;
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(buf[start + i] || 0));
    if (peak < 0.0005) return;
    const k = peak > 1 ? 1 / peak : 1;
    g.strokeStyle = colors.view;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W,
        y = H / 2 - (buf[start + i] || 0) * k * H * 0.42;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
  function drawTrace(g, W, H, m) {
    const v = engine.read(m.id, "level");
    let h = hist.get(m.id);
    if (!h) hist.set(m.id, (h = []));
    if (v != null) h.push(v);
    if (h.length > 160) h.shift();
    g.strokeStyle = colors.viewLine;
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(W, H / 2);
    g.stroke();
    g.strokeStyle = colors.mod;
    g.beginPath();
    h.forEach((y, i) => {
      const x = W - (h.length - 1 - i) * (W / 159),
        yy = H / 2 - y * H * 0.4;
      i ? g.lineTo(x, yy) : g.moveTo(x, yy);
    });
    g.stroke();
  }
  // The envelope: its shape (attack, decay, a held stretch at the sustain, release), and a dot where the newest note is on it.
  function drawEnv(g, W, H, m) {
    const { a, d, s, r } = m.p;
    const scaleT = (t) => Math.log1p(t * 6) / Math.log1p(4 * 6);
    const pad = 3 * (W / 156),
      top = pad,
      bot = H - pad;
    const wa = Math.max(0.04, scaleT(a)) * W * 0.28,
      wd = Math.max(0.04, scaleT(d)) * W * 0.24,
      ws = W * 0.18,
      wr = Math.max(0.04, scaleT(r)) * W * 0.28;
    const total = wa + wd + ws + wr;
    const k = (W - 2 * pad) / total;
    const xs = [pad, pad + wa * k, pad + (wa + wd) * k, pad + (wa + wd + ws) * k, pad + total * k];
    const y = (v) => bot - v * (bot - top);
    g.strokeStyle = colors.viewDim;
    g.beginPath();
    g.moveTo(xs[0], y(0));
    g.lineTo(xs[1], y(1));
    // the decay curves down toward the sustain, as the sound does
    for (let i = 1; i <= 12; i++) g.lineTo(xs[1] + ((xs[2] - xs[1]) * i) / 12, y(s + (1 - s) * Math.exp((-3 * i) / 12)));
    g.lineTo(xs[3], y(s));
    for (let i = 1; i <= 12; i++) g.lineTo(xs[3] + ((xs[4] - xs[3]) * i) / 12, y(s * Math.exp((-4 * i) / 12)));
    g.stroke();
    const ph = engine.phase();
    const level = engine.read(m.id, "level");
    if (!ph || level == null || !cablesInto(patch, m.id, "gate").length) return;
    let x;
    const t = ph.now - ph.on;
    if (ph.off == null || ph.now < ph.off) x = t < a ? xs[0] + (xs[1] - xs[0]) * (t / a) : t < a + d * 2 ? xs[1] + (xs[2] - xs[1]) * Math.min(1, (t - a) / (d * 2)) : xs[2] + (xs[3] - xs[2]) * Math.min(1, (t - a - d * 2) / 2);
    else x = xs[3] + (xs[4] - xs[3]) * Math.min(1, (ph.now - ph.off) / (r * 1.6));
    g.fillStyle = colors.mod;
    g.beginPath();
    g.arc(x, y(Math.max(0, Math.min(1, level))), 3.2 * (W / 156), 0, Math.PI * 2);
    g.fill();
  }
  // The filter: the sound's frequencies (faint) under the filter's shape (what passes), on a log scale from 20 Hz to 20 kHz.
  function drawFilter(g, W, H, m) {
    const spec = engine.read(m.id, "spectrum");
    const nyq = engine.rate / 2;
    if (spec) {
      g.fillStyle = colors.viewWash;
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i < freqs.length; i++) {
        const bin = Math.min(spec.length - 1, Math.round((freqs[i] / nyq) * spec.length));
        const db = Math.max(-100, Math.min(-10, spec[bin]));
        g.lineTo((i / (freqs.length - 1)) * W, H - ((db + 100) / 90) * H);
      }
      g.lineTo(W, H);
      g.fill();
    }
    const mag = engine.response(m.id, freqs, m);
    if (!mag) return;
    g.strokeStyle = colors.view;
    g.beginPath();
    for (let i = 0; i < freqs.length; i++) {
      const db = 20 * Math.log10(Math.max(1e-5, mag[i]));
      const yy = H * 0.42 - (db / 30) * H * 0.42;
      const x = (i / (freqs.length - 1)) * W;
      i ? g.lineTo(x, Math.max(1, Math.min(H - 1, yy))) : g.moveTo(x, Math.max(1, Math.min(H - 1, yy)));
    }
    g.stroke();
  }
  let raf = 0;
  const frame = () => {
    drawViews();
    drawLoop();
    raf = requestAnimationFrame(frame);
  };

  // ---------- the loop: one row per voice, one cell per step ----------
  const toneOf = (v) => Pj.roleIndex(v.role) + 1;
  let cursor = { v: null, s: 0 }; // the step the keyboard is on, in the strip
  function renderFront() {
    const v = Pj.frontOf(project);
    frontEl.innerHTML = `<span class="sg-tone" data-tone="${toneOf(v)}"></span>${esc(v.name)}`;
  }
  function transportHTML() {
    const mode = seq.playing;
    return `<button type="button" class="sg-tbtn" data-act="play" aria-pressed="${mode === "loop"}">${mode === "loop" ? "Stop" : "Play"} <kbd>Space</kbd></button>
      <button type="button" class="sg-tbtn" data-act="rec" aria-pressed="${rec}">Record <kbd>R</kbd></button>
      <button type="button" class="sg-tbtn" data-act="song" aria-pressed="${mode === "song"}">${mode === "song" ? "Stop" : "Play all"} <kbd>⇧ Space</kbd></button>`;
  }
  function renderTransport() {
    const t = loopEl.querySelector(".sg-tplay");
    if (!t) return;
    const f = document.activeElement?.dataset?.act;
    t.innerHTML = transportHTML();
    if (f && t.querySelector(`[data-act="${f}"]`)) t.querySelector(`[data-act="${f}"]`).focus({ preventScroll: true });
    if (!seq.playing) loopEl.querySelectorAll(".sg-now").forEach((n) => (n.hidden = true));
  }
  function rowHTML(v, i, n) {
    const front = v.id === project.front;
    const notes = Pj.notesOf(project, v.id);
    if (!Pj.voiceOf(project, cursor.v)) cursor = { v: project.front, s: 0 };
    let cells = "";
    for (let s = 0; s < n; s++) {
      const here = notes.filter((x) => x.s <= s && s < x.s + x.l);
      cells += `<button type="button" class="sg-cell${s % Pj.STEPS === 0 ? " is-bar" : s % 4 === 0 ? " is-beat" : ""}" data-v="${v.id}" data-s="${s}" style="grid-column:${s + 1}" tabindex="${cursor.v === v.id && cursor.s === s ? 0 : -1}" aria-label="${esc(v.name)}, bar ${Math.floor(s / Pj.STEPS) + 1} step ${(s % Pj.STEPS) + 1}${here.length ? `: ${here.map((x) => noteName(x.n)).join(", ")}` : ""}"></button>`;
    }
    const starts = new Map();
    for (const x of notes) starts.set(x.s, [...(starts.get(x.s) || []), x]);
    let blocks = "";
    for (const x of notes) {
      const first = starts.get(x.s)[0] === x;
      const label = first && x.l >= 2 ? starts.get(x.s).map((y) => noteName(y.n)).join(" ") : "";
      blocks += `<span class="sg-note" style="grid-column:${x.s + 1} / span ${Math.min(x.l, n - x.s)}" aria-hidden="true">${label}</span>`;
    }
    return `<div class="sg-vrow${front ? " is-front" : ""}" data-v="${v.id}" data-tone="${toneOf(v)}">
      <button type="button" class="sg-vname" data-act="front" data-v="${v.id}" data-rename="voice:${v.id}" aria-pressed="${front}" title="Put ${esc(v.name)} on the board (${i + 1}). Double-click to rename."><span class="sg-tone"></span><span class="sg-vlabel">${esc(v.name)}</span><kbd>${i + 1}</kbd><canvas class="sg-vscope" data-vscope="${v.id}" aria-hidden="true"></canvas></button>
      <div class="sg-cells" role="group" aria-label="${esc(v.name)}’s steps">${cells}${blocks}<span class="sg-now" hidden></span></div>
      <span class="sg-vtools">${notes.length ? `<button type="button" class="sg-link" data-act="clearrow" data-v="${v.id}" title="Take every note out of this row">Clear</button>` : ""}${project.voices.length > 1 ? `<button type="button" class="sg-x" data-act="removevoice" data-v="${v.id}" aria-label="Remove ${esc(v.name)}" title="Remove this voice">${svg("x")}</button>` : ""}</span>
    </div>`;
  }
  function renderLoop() {
    const n = Pj.totalSteps(project);
    const act = document.activeElement;
    const focus = loopEl.contains(act) ? (act.classList.contains("sg-cell") ? `.sg-cell[data-v="${act.dataset.v}"][data-s="${act.dataset.s}"]` : act.dataset.act ? `[data-act="${act.dataset.act}"]${act.dataset.sec ? `[data-sec="${act.dataset.sec}"]` : ""}${act.dataset.bars ? `[data-bars="${act.dataset.bars}"]` : ""}${act.dataset.v ? `[data-v="${act.dataset.v}"]` : ""}` : act.dataset.input ? `[data-input="${act.dataset.input}"]` : null) : null;
    const secs = project.sections
      .map((s) => {
        const on = s.id === project.section;
        return `<span class="sg-sec${on ? " is-on" : ""}"><button type="button" role="tab" aria-selected="${on}" data-act="section" data-sec="${s.id}" data-rename="section:${s.id}" title="Double-click to rename">${esc(s.name)}</button><button type="button" class="sg-times" data-act="times" data-sec="${s.id}" aria-label="${esc(s.name)} plays ${s.times === 1 ? "once" : `${s.times} times`}" title="How many times it plays in Play all">×${s.times}</button>${on && project.sections.length > 1 ? `<button type="button" class="sg-x" data-act="removesection" data-sec="${s.id}" aria-label="Remove section ${esc(s.name)}" title="Remove this section">${svg("x")}</button>` : ""}</span>`;
      })
      .join("");
    loopEl.innerHTML = `
      <div class="sg-transport">
        <div class="sg-tplay">${transportHTML()}</div>
        <label class="sg-tempo"><span>Tempo</span><input type="number" data-input="tempo" min="${Pj.TEMPO.min}" max="${Pj.TEMPO.max}" step="1" value="${project.tempo}" aria-label="Tempo in beats a minute"><span>BPM</span></label>
        <div class="sg-bars" role="radiogroup" aria-label="Bars in the loop">${Pj.BAR_CHOICES.map((b) => `<button type="button" role="radio" aria-checked="${project.bars === b}" data-act="bars" data-bars="${b}">${b}</button>`).join("")}<span>bars</span></div>
        <div class="sg-sections" role="tablist" aria-label="Sections">${secs}<button type="button" class="sg-link" data-act="newsection">New section</button></div>
      </div>
      <div class="sg-rows" style="--n:${n}">
        ${project.voices.map((v, i) => rowHTML(v, i, n)).join("")}
      </div>
      <div class="sg-lfoot">${project.voices.length < Pj.MAX_VOICES ? `<button type="button" class="sg-link" data-act="addvoice">Add a voice</button>` : "<span></span>"}<p class="sg-pen">A click puts in <strong>${noteName(pen)}</strong>, the last note played. Alt-click takes a note out.</p></div>`;
    for (const c of loopEl.querySelectorAll("canvas.sg-vscope")) sizeScope(c);
    lastNow = null;
    if (focus) loopEl.querySelector(focus)?.focus({ preventScroll: true });
  }
  const updatePen = () => {
    const el = loopEl.querySelector(".sg-pen strong");
    if (el) el.textContent = noteName(pen);
  };
  function sizeScope(c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round((c.clientWidth || 36) * dpr);
    c.height = Math.round((c.clientHeight || 16) * dpr);
  }
  // Every frame: the playhead, and each voice's little picture of what it's playing.
  let lastNow = null;
  function drawLoop() {
    const w = seq.where();
    if (w && seq.playing === "song" && w.section !== project.section && Pj.sectionOf(project, w.section)?.id === w.section) {
      // Play all: the strip follows the section that's playing.
      project = Pj.setSection(project, w.section);
      renderLoop();
    }
    const key = w && w.section === project.section ? w.step : null;
    if (key !== lastNow) {
      lastNow = key;
      for (const el of loopEl.querySelectorAll(".sg-now")) {
        el.hidden = key == null;
        if (key != null) el.style.gridColumn = `${key + 1}`;
      }
    }
    for (const c of loopEl.querySelectorAll("canvas.sg-vscope")) {
      const e = engines.get(c.dataset.vscope);
      const g = c.getContext("2d");
      const W = c.width,
        H = c.height;
      g.clearRect(0, 0, W, H);
      const buf = e?.read("out", "wave");
      if (!buf) continue;
      let peak = 0;
      for (let i = 0; i < 600; i++) peak = Math.max(peak, Math.abs(buf[i] || 0));
      if (peak < 0.001) continue;
      const k = peak > 1 ? 1 / peak : 1;
      g.strokeStyle = colors.ink;
      g.lineWidth = Math.max(1, W / 36);
      g.beginPath();
      for (let i = 0; i < 600; i += 4) {
        const x = (i / 600) * W,
          y = H / 2 - (buf[i] || 0) * k * H * 0.45;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  }
  const wake = () => {
    const ac = clock();
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  };
  function startLoop(mode, at = null) {
    wake();
    if (!clock()) return say("This browser can’t play sound.");
    seq.start(mode, at);
    if (mode === "song") (counters.song++, check());
    renderTransport();
  }
  // The loop's bar lines, for a Looper set to whole bars: when the next bar starts and how long one is.
  // With the loop stopped, it starts the loop a moment from now, so the two keep time together.
  function grid() {
    const ac = clock();
    if (!ac) return null;
    const st = Pj.stepSeconds(project),
      bar = Pj.STEPS * st;
    const t = ac.currentTime;
    const w = seq.playing ? seq.where() : null;
    if (w) {
      const barStart = w.at - (w.step % Pj.STEPS) * st;
      return { next: barStart + bar * Math.ceil((t + 0.03 - barStart) / bar), bar };
    }
    const at = t + 0.12;
    startLoop("loop", at);
    return { next: at, bar };
  }
  // A card's button: the Looper's Record, Undo layer and Clear go to its engine; "Set the clock from it"
  // reads the loop's length as a tempo and a number of bars, and starts the loop again on the Looper's next round.
  function doAction(id, name) {
    wake();
    if (!clock()) return say("This browser can’t play sound.");
    const m = moduleOf(patch, id);
    if (!m || !engine) return;
    if (name === "clock") {
      const st = engine.state(id);
      const c = st?.length ? clockFromLoop(st.length, { min: Pj.TEMPO.min, max: Pj.TEMPO.max, near: project.tempo }) : null;
      if (!c) return say("Record a loop first.");
      commitProject(Pj.setBars(Pj.setTempo(project, c.tempo), c.bars));
      const t = studio.ac.currentTime;
      const next = st.start + st.length * Math.ceil((t + 0.05 - st.start) / st.length);
      seq.stop();
      startLoop("loop", next);
      return say(`${c.tempo} BPM, ${c.bars} bar${c.bars > 1 ? "s" : ""}: the loop now keeps time with yours.`);
    }
    engine.act(id, name);
    onChanged(id, engine);
  }
  // A module reported a change (a layer recorded, the microphone answered): its card follows, and the lesson is checked.
  const layersSeen = new Map(); // module id → layers, to count what was put on and taken off
  function onChanged(id, e) {
    if (e !== engine) return;
    const m = moduleOf(patch, id);
    if (!m) return;
    const st = e.state(id);
    if (st && "layers" in st) {
      const before = layersSeen.get(id) ?? 0;
      if (st.layers > before) counters.layers += st.layers - before;
      if (st.layers < before) counters.undos += before - st.layers;
      layersSeen.set(id, st.layers);
    }
    const el = board.querySelector(`[data-acts="${id}"]`);
    if (el) {
      const f = document.activeElement?.closest?.(`[data-acts="${id}"]`) ? document.activeElement.dataset.action : null;
      el.innerHTML = actsButtons(m);
      if (f) el.querySelector(`[data-action="${f}"]`)?.focus({ preventScroll: true });
    }
    check();
  }
  const looperId = () => patch?.modules.find((m) => m.type === "looper")?.id || null;
  function stopLoop() {
    seq.stop();
    rec = false;
    recording.clear();
    renderTransport();
    lastNow = null;
  }
  const toggle = (mode) => (seq.playing === mode ? stopLoop() : startLoop(mode));
  function toggleRec() {
    rec = !rec;
    if (rec && seq.playing !== "loop") startLoop("loop");
    renderTransport();
  }
  function bringFront(id) {
    if (!Pj.voiceOf(project, id) || id === project.front) return;
    liftAll();
    commitProject(Pj.setFront(project, id), { history: false });
  }
  // A short sound of the note just put in, through its voice.
  function preview(v, n) {
    if (seq.playing) return;
    wake();
    const ac = clock();
    engines.get(v)?.trigger(n, ac ? ac.currentTime + 0.01 : 0, 0.2);
  }
  // A click (or Enter) on a step: an empty step gets the note; a note there of the same pitch goes; another pitch takes the new one.
  function stepAct(v, s, { remove = false } = {}) {
    cursor = { v, s };
    let pr = Pj.setFront(project, v);
    const over = Pj.notesAt(pr, v, s);
    if (over.length) {
      const same = over.find((x) => x.n === pen);
      if (remove || same) return commitProject(Pj.removeNote(pr, v, (same || over[0]).s, (same || over[0]).n)), null;
      commitProject(Pj.repitch(pr, v, over[0].s, over[0].n, pen));
      preview(v, pen);
      return null;
    }
    if (remove) return null;
    commitProject(Pj.placeNote(pr, v, s, pen, 1));
    preview(v, pen);
    return { v, s, n: pen };
  }
  function onLoopKey(e) {
    const c = e.target.closest?.(".sg-cell");
    if (!c) return;
    const v = c.dataset.v,
      s = Number(c.dataset.s);
    const n = Pj.totalSteps(project);
    const vi = Pj.voiceIndex(project, v);
    let to = null;
    if (e.key === "ArrowRight") to = { v, s: (s + 1) % n };
    else if (e.key === "ArrowLeft") to = { v, s: (s - 1 + n) % n };
    else if (e.key === "ArrowDown") to = { v: project.voices[Math.min(project.voices.length - 1, vi + 1)].id, s };
    else if (e.key === "ArrowUp") to = { v: project.voices[Math.max(0, vi - 1)].id, s };
    else if (e.key === "Home") to = { v, s: 0 };
    else if (e.key === "End") to = { v, s: n - 1 };
    else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      stepAct(v, s);
      loopEl.querySelector(`.sg-cell[data-v="${v}"][data-s="${s}"]`)?.focus({ preventScroll: true });
      return;
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      stepAct(v, s, { remove: true });
      loopEl.querySelector(`.sg-cell[data-v="${v}"][data-s="${s}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (!to) return;
    e.preventDefault();
    e.stopPropagation();
    cursor = to;
    c.tabIndex = -1;
    const next = loopEl.querySelector(`.sg-cell[data-v="${to.v}"][data-s="${to.s}"]`);
    if (next) (next.tabIndex = 0), next.focus({ preventScroll: true });
  }
  // Renaming a voice or a section: double-click its name, type, Enter.
  function renameStart(el) {
    const [kind, id] = el.dataset.rename.split(":");
    const name = kind === "voice" ? Pj.voiceOf(project, id)?.name : Pj.sectionOf(project, id)?.name;
    if (name == null) return;
    const input = document.createElement("input");
    input.className = "sg-rename";
    input.value = name;
    input.maxLength = kind === "voice" ? 24 : 16;
    input.setAttribute("aria-label", kind === "voice" ? "Name of this voice" : "Name of this section");
    el.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (ok && v && v !== name) commitProject(kind === "voice" ? Pj.renameVoice(project, id, v) : Pj.renameSection(project, id, v), { board: kind === "voice" });
      else renderLoop();
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") (e.preventDefault(), finish(true));
      else if (e.key === "Escape") (e.preventDefault(), finish(false));
    });
    input.addEventListener("blur", () => finish(true));
  }

  // ---------- the Ghost Producer ----------
  let asking = null,
    askError = "",
    measuring = false;
  let doing = null; // the run under way (the hands, below)
  const runs = []; // this sitting's runs, for "Undo all of this"
  // The conversation with the producer, per project, kept on this device in Signal's own prefs (`chats`, so an
  // older build carries it along unread): [{ id, who: "you" | "producer" | "app", text, at, model, run }].
  // A run is written as plain data once it is over: { id, ask, say, steps: [{ did, why, state }], stopped }.
  let chat = [];
  const loadChat = () => {
    const list = p.chats && typeof p.chats === "object" ? p.chats[currentId] : null;
    chat = Array.isArray(list) ? list.filter((m) => m && typeof m === "object" && typeof m.text === "string").slice(-60) : [];
  };
  const saveChat = () => {
    if (!currentId) return;
    const plain = chat.slice(-60).map((m) => (m.run && m.run.steps ? { ...m, run: { id: m.run.id, ask: m.run.ask, say: m.run.say, stopped: !!m.run.stopped, steps: m.run.steps.map((st) => ({ did: st.did, why: st.why, state: st.state })) } } : m));
    p.chats = { ...(p.chats && typeof p.chats === "object" ? p.chats : {}), [currentId]: plain };
    keep({ chats: p.chats });
  };
  let chatScroll = false; // scroll to the newest line on the next render
  function post(who, text, extra = {}) {
    const m = { id: newId(), who, text: String(text || ""), at: new Date().toISOString(), ...extra };
    chat.push(m);
    if (chat.length > 60) chat.shift();
    saveChat();
    chatScroll = true;
    renderMargin();
    return m;
  }
  loadChat();
  const aiReady = () => !!ai?.ready?.();
  // The session the kid is in: the lesson's, or the one whose page is open.
  const sessionNow = () => (lesson ? sessionOfLesson(lesson.kind, lesson.id) : sessionView ? sessionOf(sessionView) : null);
  // The producer's notebook: the session's questions, read as they are when the AI isn't there.
  const GENERAL_ASKS = ["What would you take out before adding anything?", "Which part would you keep if you could keep only one?", "Is it done, or did you stop?", "Who is it for?"];
  const nbAt = new Map(); // session n (or 0) → which question shows
  function notebookQuestion(s = sessionNow()) {
    const list = s ? s.asks : GENERAL_ASKS;
    return list[(nbAt.get(s ? s.n : 0) || 0) % list.length];
  }
  // The column is a conversation, like any chat: the kid's lines to the right, the producer's to the left, and
  // when the producer has moves for the board they come as a card inside its reply. A run's card lists the
  // steps as they happen, with Stop while its hands work and "Undo all of this" after; an offer's card lists
  // the moves it would make, with "Do it" and "Show me"; nothing happens unless the kid takes it. With
  // nothing said yet, the producer opens with how it works and the session's question.
  const sayable = (t) => esc(t).replace(/\n+/g, "<br>");
  const stepsHTML = (steps, { offer = false } = {}) =>
    `<ol class="sg-did-steps">${steps.map((st) => `<li class="is-${offer ? "next" : st.state}"><strong>${esc(st.did || stepWords(st))}</strong>${st.why && st.state !== "skipped" ? esc(st.why) : ""}</li>`).join("")}</ol>`;
  const card = (title, sub, body, acts, { open = false } = {}) =>
    `<div class="sg-card"><details class="sg-card-steps" ${open ? "open" : ""}><summary><span class="sg-card-title">${esc(title)}</span>${sub ? `<span class="sg-card-sub">${esc(sub)}</span>` : ""}</summary>${body}</details>${acts ? `<p class="sg-msg-acts">${acts}</p>` : ""}</div>`;
  const runHTML = (r) => {
    const live = doing && r.id === doing.id;
    const mem = runs.find((x) => x.id === r.id);
    const steps = (live ? doing : r).steps;
    const now = steps.find((st) => st.state === "now");
    const n = steps.filter((st) => st.state === "done").length,
      sk = steps.filter((st) => st.state === "skipped").length;
    const title = live ? "Working on the board" : r.stopped ? "Stopped on the board" : "Done on the board";
    const sub = live ? (now ? now.did || stepWords(now) : "") : `${n} ${n === 1 ? "step" : "steps"}${sk ? `, ${sk} skipped` : ""}`;
    const acts = live
      ? `<button type="button" data-act="stopask">Stop</button>`
      : mem && mem.after && mem.after === project && mem.before !== mem.after
        ? `<button type="button" data-act="undoall" data-run="${r.id}">Undo all of this</button>`
        : "";
    return card(title, sub, stepsHTML(steps), acts, { open: !!live });
  };
  const offerHTML = (m) => {
    const n = m.offer.length;
    const acts = m.took || !aiReady() || asking || doing ? "" : `<button type="button" data-act="doit" data-msg="${m.id}">Do it</button><button type="button" data-act="showme" data-msg="${m.id}">Show me</button>`;
    return card(m.took ? "Taken to the board" : "It could do this on the board", `${n} ${n === 1 ? "move" : "moves"}`, stepsHTML(m.offer, { offer: true }), acts);
  };
  function chatHTML() {
    const ready = aiReady();
    const lines = chat.map((m) => {
      if (m.who === "you") return `<li class="sg-msg is-you"><p class="sg-msg-by">You</p><p class="sg-msg-text">${sayable(m.text)}</p></li>`;
      if (m.who === "app") return `<li class="sg-msg is-app"><p class="sg-msg-text">${sayable(m.text)}</p></li>`;
      return `<li class="sg-msg is-producer" data-id="${m.id}"><p class="sg-msg-by">${GHOST}</p>${m.text ? `<p class="sg-msg-text">${sayable(m.text)}</p>` : ""}${m.run ? runHTML(m.run) : ""}${m.offer?.length ? offerHTML(m) : ""}</li>`;
    });
    if (!chat.length) {
      const s = sessionNow();
      const how = ready
        ? "Ask anything about this board, or say the sound you want and it gets built here in front of you, step by step. Every step can be undone."
        : `${esc(ai?.needs?.() || "The Ghost Producer needs Subtextual AI or your own key.")}${ai?.setup ? ` <button type="button" class="sg-link" data-act="setup">Set it up</button>` : ""}`;
      lines.push(`<li class="sg-msg is-producer"><p class="sg-msg-by">${GHOST}</p><p class="sg-msg-text">${how}</p></li>`);
      lines.push(`<li class="sg-msg is-producer"><p class="sg-msg-by">${GHOST}</p><p class="sg-msg-text">${esc(notebookQuestion(s))}</p></li>`);
    }
    if (asking) lines.push(`<li class="sg-msg is-app" role="status"><p class="sg-msg-text">Reading the project… <button type="button" class="sg-link" data-act="stopask">Stop</button></p></li>`);
    else if (askError) lines.push(`<li class="sg-msg is-app" role="alert"><p class="sg-msg-text">${esc(askError)}</p></li>`);
    return `<ol class="sg-chat">${lines.join("")}</ol>`;
  }
  function marginHTML() {
    const ready = aiReady();
    const off = !ready || !!asking || !!doing;
    const fresh = !chat.some((m) => m.who === "you");
    const model = ready ? ai.model?.() || "" : "";
    return `
      <h3 class="sg-mtitle">${GHOST}${model ? ` <span class="sg-model">${esc(model)}</span>` : ""}</h3>
      ${chatHTML()}
      ${doing ? `<p class="sg-sr" role="status">${esc(stepStatus())}</p>` : ""}
      <div class="sg-compose">
        ${fresh ? `<div class="sg-asks">${ready ? ASKS.map((a) => `<button type="button" data-act="ask" data-ask="${a.id}" ${off ? "disabled" : ""}>${esc(a.label)}</button>`).join("") : ""}<button type="button" data-act="measure" ${measuring ? "disabled" : ""}>${measuring ? "Measuring…" : "Measure the sound"}</button></div>` : ""}
        <form class="sg-own" data-form="ask"><label class="sg-sr" for="sg-own">Say something to the ${GHOST}</label><div class="sg-row"><input id="sg-own" name="q" type="text" maxlength="200" autocomplete="off" placeholder="${ready ? "Ask the producer" : "Needs a key"}" ${off ? "disabled" : ""}><button type="submit" ${off ? "disabled" : ""}>Send</button></div></form>
      </div>`;
  }
  function renderMargin() {
    const into = wideMQ.matches ? marginEl.querySelector(".sg-ghost") : side === "notes" ? panel : null;
    if (!into) return;
    if (into === panel) return renderPanel();
    const open = new Set([...into.querySelectorAll(".sg-card-steps[open]")].map((d) => d.closest(".sg-msg")?.dataset.id).filter(Boolean));
    const f = into.contains(document.activeElement) ? document.activeElement.dataset.act || (document.activeElement.id ? `#${document.activeElement.id}` : null) : null;
    const list = into.querySelector(".sg-chat");
    const atEnd = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    into.innerHTML = marginHTML();
    for (const id of open) into.querySelector(`.sg-msg[data-id="${id}"] .sg-card-steps`)?.setAttribute("open", "");
    const next = into.querySelector(".sg-chat");
    if (next && (chatScroll || atEnd)) next.scrollTop = next.scrollHeight;
    chatScroll = false;
    if (f) (f.startsWith("#") ? into.querySelector(f) : into.querySelector(`[data-act="${f}"]:not([disabled])`))?.focus({ preventScroll: true });
  }
  async function doMeasure() {
    if (measuring) return numbers;
    measuring = true;
    renderMargin();
    try {
      numbers = await measureSound(project);
    } catch {
      numbers = null;
      say("The numbers couldn’t be measured in this browser.");
    }
    measuring = false;
    renderMargin();
    check();
    return numbers;
  }
  const numbersLine = () => {
    if (!numbers) return "";
    const rows = numbers.voices.map((v) => `${v.name}: ${v.silent ? "silent" : `${v.centroid >= 1000 ? `${(v.centroid / 1000).toFixed(1)} kHz` : `${v.centroid} Hz`}, fills ${v.fill}%`}`);
    const m = numbers.mix;
    return `Measured. ${rows.join("; ")}.${m && !m.silent ? ` All together: peak ${m.peak.toFixed(1)} dB${m.clips ? ", and it clips" : ", no clipping"}; loudest bar ${m.loudest}.` : ""}`;
  }
  async function askGhost(question, session = sessionNow(), { hands = true, said = question } = {}) {
    if (!aiReady()) return renderMargin();
    if (asking || doing) return;
    const controller = new AbortController();
    asking = controller;
    askError = "";
    if (said) post("you", said);
    else renderMargin();
    await doMeasure();
    if (asking !== controller) return;
    let text = null;
    try {
      const s = session;
      const history = chat.filter((m) => m.who !== "app" && !m.opening).slice(-9, -1);
      text = await ai.ask({ system: systemFor(s, { looping: !!looperId(), hands }), user: userFor(project, numbers, question, s, history), maxTokens: hands ? 1400 : 700, signal: controller.signal });
    } catch (e) {
      asking = null;
      if (e?.name !== "AbortError") {
        ai.failed?.(e);
        askError = e?.message || "The Ghost Producer didn’t answer. Try again.";
      }
      return renderMargin();
    }
    if (asking !== controller) return;
    asking = null;
    // The app opened its own sheet to set the AI up: Signal steps aside for it.
    if (text == null) return close();
    // From the kid's own words the answer may be steps for the board (the hands), notes, or both.
    const reply = hands ? parseReply(text, project, question) : { say: "", steps: [], notes: parseNotes(text, project) };
    const notes = reply.notes;
    if (!reply.steps.length && !notes.length && !reply.say && !reply.offer?.length) {
      askError = "No notes this time. Ask again, or ask another way.";
      return renderMargin();
    }
    const model = ai.model?.() || "";
    const words = [reply.steps.length ? "" : reply.say, ...notes.map((n) => n.text)].filter(Boolean).join("\n");
    if (!reply.steps.length) return void post("producer", words, { model, ...(reply.offer?.length ? { offer: reply.offer } : {}) });
    const run = makeRun(question, reply.say, reply.steps, model);
    post("producer", [reply.say, ...notes.map((n) => n.text)].filter(Boolean).join("\n"), { model, run });
    perform(run);
  }
  const makeRun = (ask, say, steps, model) => ({ id: newId(), ask, say, steps: steps.map((st) => ({ ...st, state: "next", did: "" })), model, before: project, after: null, stopped: false, controller: new AbortController(), handles: new Map() });
  // The kid takes an offer: its moves are done on the board (no second ask), or only pointed at.
  function takeOffer(id, { show = false } = {}) {
    const m = chat.find((x) => x.id === id && x.offer?.length);
    if (!m || m.took || asking || doing) return;
    let steps = m.offer;
    if (show) {
      const seen = new Set();
      steps = [];
      for (const st of m.offer) {
        const mod = st.do === "add" ? null : st.do === "connect" || st.do === "disconnect" ? st.to[0] : st.module;
        const k = `${mod}.${st.do === "set" || st.do === "show" ? st.param || "" : ""}`;
        if (!mod || seen.has(k)) continue;
        seen.add(k);
        steps.push({ do: "show", module: mod, ...(st.do === "set" || st.do === "show" ? (st.param ? { param: st.param } : {}) : {}), why: st.why });
      }
      if (!steps.length) return void post("app", "Nothing on the board to point at yet: the moves add new modules.");
    } else m.took = true;
    post("you", show ? "Show me." : "Do it.");
    const run = makeRun(show ? "Show me." : "Do it.", "", steps, m.model || "");
    post("producer", "", { model: m.model || "", run });
    perform(run);
  }

  // ---------- the hands ----------
  // Asked for a sound, the producer answers with steps, and the board does them in front of the kid: the
  // hand glides to the spot, the step happens (a card arrives, a knob turns, a cable is pulled from jack to
  // jack), its reason shows beside the hand and in the column, and the next step waits a moment so the
  // reason can be read. Each step is one change for undo; Stop leaves what is done; "Undo all of this"
  // puts the project back as it was before the run. The hands never take the Keyboard or the Speaker,
  // never touch a Note, and act only on an ask. The kid can play the keys the whole time.
  const GLIDE = "cubic-bezier(0.32, 0.72, 0, 1)",
    GLIDE_MS = 320;
  const wait = (ms, signal) =>
    new Promise((r) => {
      if (signal?.aborted) return r();
      const t = setTimeout(r, ms);
      signal?.addEventListener("abort", () => (clearTimeout(t), r()), { once: true });
    });
  // The glide's curve, for what can't be left to CSS (the cable being pulled).
  const glideAt = (() => {
    const [x1, y1, x2, y2] = [0.32, 0.72, 0, 1];
    const bx = (t) => 3 * x1 * (1 - t) ** 2 * t + 3 * x2 * (1 - t) * t * t + t ** 3;
    const by = (t) => 3 * y1 * (1 - t) ** 2 * t + 3 * y2 * (1 - t) * t * t + t ** 3;
    return (x) => {
      let lo = 0,
        hi = 1,
        t = x;
      for (let i = 0; i < 24; i++) ((t = (lo + hi) / 2), bx(t) < x ? (lo = t) : (hi = t));
      return by(t);
    };
  })();
  // Where an element is on the floor, in the board's units.
  function centerOf(el) {
    const b = board.getBoundingClientRect(),
      r = el.getBoundingClientRect();
    return [(r.left + r.width / 2 - b.left) / scale, (r.top + r.height / 2 - b.top) / scale];
  }
  // Bring a point of the floor into view, with room around it, gliding the camera there.
  async function showPoint([x, y], signal) {
    const v = viewRect(),
      m = Math.min(140 / cam.k, v.w / 4, v.h / 4);
    let dx = 0,
      dy = 0;
    if (x < v.x + m) dx = x - m - v.x;
    else if (x > v.x + v.w - m) dx = x + m - (v.x + v.w);
    if (y < v.y + m) dy = y - m - v.y;
    else if (y > v.y + v.h - m) dy = y + m - (v.y + v.h);
    if (!dx && !dy) return;
    const from = board.style.transform;
    cam.x += dx;
    cam.y += dy;
    atFit = false;
    if (reduced || signal?.aborted || !board.animate) return applyCamera();
    const to = `translate(${(-cam.x * cam.k).toFixed(2)}px, ${(-cam.y * cam.k).toFixed(2)}px) scale(${cam.k})`;
    const a = board.animate([{ transform: from }, { transform: to }], { duration: GLIDE_MS, easing: GLIDE, fill: "forwards" });
    await a.finished.catch(() => {});
    a.cancel();
    applyCamera();
  }
  const handSay = (text) => (hand.querySelector(".sg-hand-say").innerHTML = text ? `<b>${GHOST}</b>${esc(text)}` : "");
  function handTo([x, y], text, { jump = false } = {}) {
    if (jump) hand.style.transition = "none";
    hand.style.left = `${x.toFixed(1)}px`;
    hand.style.top = `${y.toFixed(1)}px`;
    // The words sit to the right of the hand, or to the left near the right edge of what is in view.
    const v = viewRect();
    hand.classList.toggle("is-left", x + 300 / cam.k > v.x + v.w);
    if (jump) (void hand.offsetWidth, (hand.style.transition = ""));
    hand.classList.add("is-on");
    if (text != null) handSay(text);
  }
  // A module's name as the kid sees it, with its place among others of its kind when there are several.
  const nameOf = (id) => {
    const m = moduleOf(patch, id);
    if (!m) return id;
    const d = defOf(m.type);
    const kin = patch.modules.filter((x) => x.type === m.type);
    return kin.length > 1 ? `${d.name} ${kin.indexOf(m) + 1}` : d.name;
  };
  const portLabel = (id, dir, port) => portOf(moduleOf(patch, id)?.type, dir, port)?.label || port;
  const flash = (id) => {
    const card = board.querySelector(`.sg-mod[data-id="${id}"]`);
    if (!card) return;
    card.classList.add("is-new");
    setTimeout(() => card.classList.remove("is-new"), 1200);
  };
  // A step in words before it is done (the column lists the whole plan).
  // A step's words before it is done: the module's name where it is on the board (the producer's handle for
  // one it would add, otherwise), the knob's label, and the value as the knob reads it.
  const stepWords = (st) => {
    const name = (ref) => (moduleOf(patch, ref) ? nameOf(ref) : ref);
    const knob = (ref, key) => defOf(moduleOf(patch, ref)?.type)?.params?.[key];
    if (st.do === "add") return `Add ${/^[aeiou]/i.test(defOf(st.type)?.name || st.type) ? "an" : "a"} ${defOf(st.type)?.name || st.type}`;
    if (st.do === "set") {
      const pd = knob(st.module, st.param);
      const v = pd && typeof st.value === "number" && pd.read ? pd.read(st.value) : pd && isChoice(pd) ? (pd.names?.[st.value] ?? st.value) : st.value;
      return `${name(st.module)}: ${pd?.label || st.param} to ${v}`;
    }
    if (st.do === "connect") return `${name(st.from[0])} ${portLabel(st.from[0], "out", st.from[1])} to ${name(st.to[0])} ${portLabel(st.to[0], "in", st.to[1])}`;
    if (st.do === "disconnect") return `Take the cable out of ${name(st.to[0])} ${portLabel(st.to[0], "in", st.to[1])}`;
    if (st.do === "show") return `Look at ${name(st.module)}${st.param ? `: ${knob(st.module, st.param)?.label || st.param}` : ""}`;
    return `Remove ${name(st.module)}`;
  };
  const stepStatus = () => {
    if (!doing) return "";
    const i = doing.steps.findIndex((st) => st.state === "now");
    const st = doing.steps[i];
    return st ? `Step ${i + 1} of ${doing.steps.length}: ${st.did || stepWords(st)}` : "Working on the board…";
  };
  const done = (st, text) => ((st.state = "done"), (st.did = text), handSay(st.why || text), renderMargin());
  const skip = (st, why) => ((st.state = "skipped"), (st.did = why), handSay(why), renderMargin());
  // One step, checked against the board as it is now. A handle the producer chose for a module it added
  // stands for that module's id in later steps.
  async function doStep(st, run) {
    const signal = run.controller.signal;
    const idOf = (ref) => run.handles.get(ref) || (moduleOf(patch, ref) ? ref : null);
    const look = async (pt, words) => {
      await showPoint(pt, signal);
      handTo(pt, words);
      await wait(GLIDE_MS + 160, signal);
    };
    if (st.do === "add") {
      const d = defOf(st.type);
      if (!d || d.note) return skip(st, "There is no module of that kind.");
      const have = d.single && patch.modules.find((m) => m.type === st.type);
      if (have) return st.as && run.handles.set(st.as, have.id), skip(st, `A board has one ${d.name}, and it is here.`);
      const spot = freeSpot(patch, viewRect());
      await look([spot.x + CARD / 2, spot.y + 19], st.why);
      if (signal.aborted) return;
      const r = addModule(patch, st.type, spot);
      commit(r.patch);
      if (st.as) run.handles.set(st.as, r.id);
      flash(r.id);
      return done(st, `Added ${d.name === nameOf(r.id) ? "a" : "another"} ${d.name}.`);
    }
    if (st.do === "set") {
      const id = idOf(st.module);
      const m = id && moduleOf(patch, id);
      if (!m) return skip(st, "There is no such module on the board.");
      const pd = defOf(m.type).params[st.param];
      if (!pd || pd.text) return skip(st, `${nameOf(id)} has no ${st.param} knob.`);
      if (isChoice(pd) ? !pd.options.includes(st.value) : !Number.isFinite(Number(st.value))) return skip(st, `${pd.label} can't be set to ${st.value}.`);
      const v = tidy(pd, st.value);
      const el = board.querySelector(`.sg-knob[data-mod="${id}"][data-key="${st.param}"]`) || board.querySelector(`[data-mod="${id}"][data-key="${st.param}"][data-val="${esc(String(v))}"]`) || board.querySelector(`.sg-mod[data-id="${id}"]`);
      await look(centerOf(el), st.why);
      if (signal.aborted) return;
      if (m.p[st.param] === v) return done(st, `${nameOf(id)}: ${pd.label} was already ${readOf(pd, v)}.`);
      if (el.classList.contains("sg-knob")) knobTo(el, v, { history: true });
      else if (el.dataset.val != null) el.click();
      else commit(setParam(patch, id, st.param, v));
      flash(id);
      return done(st, `${nameOf(id)}: ${pd.label} to ${readOf(pd, v)}.`);
    }
    if (st.do === "connect" || st.do === "disconnect") {
      const a = idOf(st.from[0]),
        b = idOf(st.to[0]);
      if (!a || !b) return skip(st, "There is no such module on the board.");
      const from = [a, st.from[1]],
        to = [b, st.to[1]];
      const j1 = jacks.get(`${a}.out.${from[1]}`),
        j2 = jacks.get(`${b}.in.${to[1]}`);
      if (!j1 || !j2) return skip(st, "There are no such jacks.");
      if (st.do === "disconnect") {
        const c = patch.cables.find((c) => c.from[0] === a && c.from[1] === from[1] && c.to[0] === b && c.to[1] === to[1]);
        if (!c) return skip(st, "There is no such cable.");
        await look(j2, st.why);
        if (signal.aborted) return;
        commit(disconnect(patch, c.id));
        return done(st, `Took the cable out of ${nameOf(b)} ${portLabel(b, "in", to[1])}.`);
      }
      if (!canConnect(patch, from, to)) return skip(st, patch.cables.some((c) => c.from[0] === a && c.from[1] === from[1] && c.to[0] === b && c.to[1] === to[1]) ? "That cable is already there." : "Those jacks don't fit.");
      await look(j1, st.why);
      if (signal.aborted) return;
      // The cable is pulled from the output to the input, the hand with it.
      pulling = { from, to: null, kind: portOf(moduleOf(patch, a).type, "out", from[1]).kind, at: [...j1] };
      markTargets();
      await showPoint(j2, signal);
      const ms = reduced ? 0 : 420,
        t0 = performance.now();
      hand.style.transition = "none";
      await new Promise((res) => {
        const tick = () => {
          const u = ms ? Math.min(1, (performance.now() - t0) / ms) : 1;
          const k = u >= 1 ? 1 : glideAt(u);
          const at = [j1[0] + (j2[0] - j1[0]) * k, j1[1] + (j2[1] - j1[1]) * k];
          if (pulling) pulling.at = at;
          handTo(at);
          drawCables();
          if (u < 1 && !signal.aborted) requestAnimationFrame(tick);
          else res();
        };
        tick();
      });
      hand.style.transition = "";
      pulling = null;
      clearTargets();
      if (signal.aborted) return drawCables();
      commit(connect(patch, from, to).patch);
      return done(st, `${nameOf(a)} ${portLabel(a, "out", from[1])} to ${nameOf(b)} ${portLabel(b, "in", to[1])}.`);
    }
    if (st.do === "show") {
      const id = idOf(st.module);
      const m = id && moduleOf(patch, id);
      if (!m) return skip(st, "There is no such module on the board.");
      const el = (st.param && board.querySelector(`[data-mod="${id}"][data-key="${st.param}"]`)) || board.querySelector(`.sg-mod[data-id="${id}"] .sg-mod-head`) || board.querySelector(`.sg-mod[data-id="${id}"]`);
      await look(centerOf(el), st.why);
      if (signal.aborted) return;
      flash(id);
      return done(st, `${nameOf(id)}${st.param && defOf(m.type).params[st.param] ? `: ${defOf(m.type).params[st.param].label}` : ""}.`);
    }
    if (st.do === "remove") {
      const id = idOf(st.module);
      const m = id && moduleOf(patch, id);
      if (!m) return skip(st, "There is no such module on the board.");
      const d = defOf(m.type);
      if (d.fixed || m.type === "keys") return skip(st, `The ${d.name} stays.`);
      if (d.note) return skip(st, "The notes on the floor are yours.");
      const name = nameOf(id);
      const el = board.querySelector(`.sg-mod[data-id="${id}"] .sg-x`) || board.querySelector(`.sg-mod[data-id="${id}"]`);
      await look(centerOf(el), st.why);
      if (signal.aborted) return;
      commit(removeModule(patch, id));
      return done(st, `Removed ${name}.`);
    }
    return skip(st, "That isn't a step the board can do.");
  }
  async function perform(run) {
    doing = run;
    runs.unshift(run);
    runs.length = Math.min(runs.length, 8);
    dialog.classList.add("is-performing");
    renderMargin();
    const signal = run.controller.signal;
    const v = viewRect();
    handTo([v.x + v.w / 2, v.y + v.h / 2], run.say || "", { jump: true });
    await wait(run.say ? 1600 : 500, signal);
    for (const st of run.steps) {
      if (signal.aborted) break;
      st.state = "now";
      renderMargin();
      try {
        await doStep(st, run);
      } catch {
        skip(st, "That step didn't work.");
      }
      if (st.state === "now") st.state = signal.aborted ? "next" : "skipped";
      if (signal.aborted) break;
      await wait(1100, signal);
    }
    if (signal.aborted) ((run.stopped = true), handSay("Stopped. What was done stays, and each step can be undone."));
    else handSay("Done. Play it; each step can be undone.");
    pulling = null;
    clearTargets();
    drawCables();
    run.after = project;
    dialog.classList.remove("is-performing");
    doing = null;
    saveChat();
    renderMargin();
    await wait(reduced ? 800 : 1600);
    if (!doing) hand.classList.remove("is-on");
  }

  // ---------- the projects ----------
  function miniBar(row) {
    const pr = row.id === currentId ? project : Pj.parseProject(row.data);
    if (!pr) return "";
    let r = "";
    pr.voices.forEach((v, i) => {
      for (const x of Pj.notesOf(pr, v.id, pr.sections[0].id)) if (x.s < Pj.STEPS) r += `<rect x="${x.s * 4}" y="${i * 4 + 0.5}" width="${Math.max(2, Math.min(x.l, Pj.STEPS - x.s) * 4 - 1)}" height="3" rx="1"/>`;
    });
    return `<svg class="sg-mini" viewBox="0 0 64 16" aria-hidden="true">${r}</svg>`;
  }
  function projectsHTML() {
    const list = p.projects.some((x) => x.id === currentId) ? p.projects : [{ id: currentId, name: project.name, at: new Date().toISOString(), data: "" }, ...p.projects];
    return `<div class="sg-patches sg-projects">
      <form class="sg-keep" data-form="rename"><label class="sg-label" for="sg-pname">This project</label><div class="sg-row"><input id="sg-pname" name="name" type="text" maxlength="40" value="${esc(project.name)}" autocomplete="off" spellcheck="false"><button type="submit">Rename</button></div></form>
      <p class="sg-quiet">${project.voices.length} voice${project.voices.length > 1 ? "s" : ""}, ${project.sections.length} section${project.sections.length > 1 ? "s" : ""}, ${Pj.songBars(project)} bars at ${project.tempo} BPM.</p>
      <p class="sg-exports">Export <button type="button" class="sg-link" data-act="wav" aria-label="Export .wav">.wav</button> · <button type="button" class="sg-link" data-act="json" aria-label="Export .signal.json">.signal.json</button> · <button type="button" class="sg-link" data-act="copytext">Copy as text</button></p>
      <h3>Yours</h3>
      <ul class="sg-list">${list.map((x) => `<li><button type="button" class="sg-open" data-act="openproject" data-project="${esc(x.id)}"${x.id === currentId ? ' aria-current="true"' : ""}><strong>${esc(x.id === currentId ? project.name : x.name)}</strong><small>${x.id === currentId ? "Open now" : esc(when(x.at))}</small>${miniBar(x)}</button>${x.id !== currentId ? `<button type="button" class="sg-x" data-act="forgetproject" data-project="${esc(x.id)}" aria-label="Delete ${esc(x.name)}" title="Delete">${svg("x")}</button>` : ""}</li>`).join("")}</ul>
      <div class="sg-row sg-wrap"><button type="button" data-act="newproject">New project</button><button type="button" data-act="import">Open a .signal.json</button></div>
      <input type="file" accept=".json,application/json" hidden data-input="import">
    </div>`;
  }
  function download(blob, name) {
    if (saveFile) return saveFile(blob, name);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    dialog.appendChild(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 4000);
  }
  async function exportWav() {
    say("Making the .wav…");
    try {
      const buf = await renderSound(project, { what: "song" });
      download(wav(buf), fileName(project.name, ".wav"));
      say("The .wav is in your downloads.");
    } catch {
      say("The .wav couldn’t be made in this browser.");
    }
  }
  function importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      const pr = Pj.parseProject(String(r.result || ""));
      if (!pr) return say("That file isn’t a Signal project.");
      openProject(newId(), () => pr);
      side = "projects";
      renderPanel();
    };
    r.readAsText(file);
  }

  // ---------- the panel: lessons and patches ----------
  let side = ["patches", "projects", "notes"].includes(p.side) ? p.side : "lessons";
  if (side === "notes" && wideMQ.matches) side = "lessons";
  let listing = false; // the list of sessions, rather than the lesson being taken
  let sessionView = null; // a session's own page (its builds, the playground, the piece, the question, Logic Pro)
  function renderPanel() {
    for (const b of dialog.querySelectorAll("[data-side]")) b.setAttribute("aria-selected", String(b.dataset.side === side));
    panel.innerHTML = side === "lessons" ? lessonsHTML() : side === "projects" ? projectsHTML() : side === "notes" ? marginHTML() : patchesHTML();
    if (!dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
  }
  const defOfLesson = (l = lesson) => (l ? (l.kind === "compose" ? courseOf(l.id) : l.kind === "voice" ? voiceLessonOf(l.id) : lessonOf(l.id)) : null);
  const homeOf = (kind) => (kind === "compose" ? COURSE_ID : kind === "voice" ? VOICE_ID : PRACTICE);
  const homeName = (kind) => (kind === "compose" ? `“${esc(COURSE_NAME)}”` : kind === "voice" ? `“${esc(VOICE_NAME)}”` : "Practice");
  const makeHome = (kind) => (kind === "compose" ? newCourse : kind === "voice" ? newVoiceRig : () => Pj.newProject({ name: "Practice", voiceName: "Sound" }));
  const stepText = (st) => (typeof st.do === "function" ? st.do(ctx()) : st.do);
  const row = (n, title, line, mark, attrs) => `<li><button type="button" ${attrs}><span class="sg-n">${n}</span><span><strong>${esc(title)}</strong><small>${esc(line)}</small></span>${mark ? `<em>${mark}</em>` : ""}</button></li>`;
  // The twelve sessions, in their four parts.
  function sessionsListHTML() {
    const cur = sessionNow();
    return `<p class="sg-quiet sg-course-line">Twelve sessions in four parts. Each is a few builds the board ticks off, a playground, a piece to keep, and a question from the producer.</p>${PARTS.map(
      (part, pi) =>
        `<h3 class="sg-course">Part ${pi + 1} · ${esc(part.name)}</h3><ol class="sg-lessons sg-sessions">${sessionsOf(part.id)
          .map((s) => row(s.n, s.title, s.line, sessionDone(s, p.done) ? "Done" : s.soon ? "Soon" : "", `data-act="session" data-session="${s.n}"${cur && cur.n === s.n ? ' aria-current="true"' : ""}`))
          .join("")}</ol>`,
    ).join("")}`;
  }
  // One session's page: its builds, the playground, the piece, the producer's question, where it lives in Logic Pro.
  function sessionHTML(n) {
    const s = sessionOf(n);
    if (!s) return sessionsListHTML();
    const part = partOf(s.part);
    const done = new Set(p.done);
    const builds = s.builds
      .map((x, i) => {
        const L = buildDef(x);
        const now = lesson && lesson.kind === x.kind && lesson.id === x.id;
        return L ? row(i + 1, L.title, L.line, done.has(x.id) ? "Done" : "", `data-act="lesson" data-kind="${x.kind}" data-lesson="${x.id}"${now ? ' aria-current="true"' : ""}`) : "";
      })
      .join("");
    return `<div class="sg-session">
      <p class="sg-of"><button type="button" class="sg-link" data-act="lessons">Sessions</button> · Part ${PARTS.indexOf(part) + 1}, ${esc(part.name)}</p>
      <h3>${s.n}. ${esc(s.title)}</h3>
      <p class="sg-quiet sg-sline">${esc(s.line)}</p>
      <h4 class="sg-h">Build</h4>
      ${s.builds.length ? `<ol class="sg-lessons sg-builds">${builds}</ol>` : `<p class="sg-quiet sg-p">Not built yet. It comes with a later release.</p>`}
      <h4 class="sg-h">Playground</h4><p class="sg-p">${esc(s.playground)}</p>
      <h4 class="sg-h">The piece</h4><p class="sg-p">${esc(s.piece)}</p>
      <h4 class="sg-h">The producer asks</h4><p class="sg-p sg-nb">${esc(notebookQuestion(s))}</p>
      <p class="sg-row sg-quiet sg-nbrow"><button type="button" class="sg-link" data-act="another" data-session="${s.n}">Another question</button>${aiReady() ? `<button type="button" class="sg-link" data-act="asksession" data-session="${s.n}">Ask the ${GHOST}</button>` : ""}</p>
      <h4 class="sg-h">In Logic Pro</h4><p class="sg-p">${esc(s.logic)}</p>
    </div>`;
  }
  function lessonsHTML() {
    if (sessionView) return sessionHTML(sessionView);
    const L = defOfLesson();
    if (!L || listing) return sessionsListHTML();
    const s = sessionOfLesson(lesson.kind, lesson.id);
    const i = s ? s.builds.findIndex((x) => x.kind === lesson.kind && x.id === lesson.id) : 0;
    const away = currentId !== homeOf(lesson.kind);
    const steps = L.steps
      .slice(0, lesson.step + 1)
      .map((st, k) => {
        const ok = k < lesson.step;
        return `<li class="${ok ? "is-done" : "is-now"}"><p class="sg-do">${esc(stepText(st))}</p>${ok ? `<p class="sg-why">${esc(st.why)}</p>` : ""}</li>`;
      })
      .join("");
    const finished = lesson.step >= L.steps.length;
    const nextBuild = s ? s.builds[i + 1] : null;
    const nextL = nextBuild ? buildDef(nextBuild) : null;
    return `<div class="sg-lesson">
      <p class="sg-of"><button type="button" class="sg-link" data-act="lessons">Sessions</button>${s ? ` · <button type="button" class="sg-link" data-act="session" data-session="${s.n}">Session ${s.n}</button> · Build ${i + 1} of ${s.builds.length}` : ""}</p>
      <h3>${esc(L.title)}</h3>
      ${away ? `<p class="sg-quiet">This lesson is in ${homeName(lesson.kind)}. <button type="button" class="sg-link" data-act="lessonback">Go back to it</button></p>` : ""}
      <ol class="sg-steps">${steps}</ol>
      ${
        finished
          ? `<p class="sg-end">${nextL ? "That’s the lesson." : "That’s the last lesson of this session. The playground is yours."}</p><div class="sg-row">${
              nextL
                ? `<button type="button" class="sg-primary" data-act="lesson" data-kind="${nextBuild.kind}" data-lesson="${nextBuild.id}">Next: ${esc(nextL.title)}</button>`
                : s
                  ? `<button type="button" class="sg-primary" data-act="session" data-session="${s.n}">Session ${s.n}: the playground</button>`
                  : `<button type="button" class="sg-primary" data-side="projects">Your projects</button>`
            }${lesson.kind !== "compose" ? `<button type="button" data-act="keep">Keep this patch</button>` : ""}</div>`
          : `<p class="sg-row sg-quiet"><button type="button" class="sg-link" data-act="restart">Start this lesson again</button></p>`
      }
    </div>`;
  }
  let keeping = false; // the name field for keeping the board is out
  function patchesHTML() {
    const mine = p.patches || [];
    return `<div class="sg-patches">
      ${
        keeping
          ? `<form class="sg-keep" data-form="keep"><label class="sg-label" for="sg-name">Name this patch</label><div class="sg-row"><input id="sg-name" name="name" type="text" maxlength="40" placeholder="Name it" autocomplete="off" spellcheck="false"><button type="submit">Keep</button><button type="button" class="sg-link" data-act="keepcancel">Cancel</button></div></form>`
          : `<p class="sg-row"><button type="button" data-act="keep">Keep this board as a patch</button></p>`
      }
      <h3>Yours</h3>
      ${mine.length ? `<ul class="sg-list">${mine.map((x) => `<li><button type="button" class="sg-open" data-act="open" data-patch="${esc(x.id)}">${esc(x.name)}</button><button type="button" class="sg-x" data-act="forget" data-patch="${esc(x.id)}" aria-label="Delete ${esc(x.name)}" title="Delete">${svg("x")}</button></li>`).join("")}</ul>` : `<p class="sg-quiet">None kept yet.</p>`}
      <h3>Starting points</h3>
      <ul class="sg-list sg-presets">${PRESETS.map((x) => `<li><button type="button" class="sg-open" data-act="preset" data-preset="${x.id}"><strong>${esc(x.name)}</strong><small>${esc(x.line)}</small></button></li>`).join("")}</ul>
      <p class="sg-row"><button type="button" class="sg-link" data-act="clear">Empty the board</button></p>
    </div>`;
  }

  // ---------- lessons ----------
  // A patching lesson plays on the Practice project's one voice; a composing lesson builds up "My first
  // track"; a voice session arrives on the "Your voice" board and adds to what is there.
  function startLesson(id, kind = "patch") {
    const L = defOfLesson({ kind, id });
    if (!L) return;
    lesson = { kind, id, step: 0 };
    counters = fresh();
    listing = false;
    sessionView = null;
    side = "lessons";
    keep({ side });
    if (kind === "compose") {
      openProject(COURSE_ID, newCourse);
      commitProject(L.start(project), { board: true });
    } else if (kind === "voice") {
      openProject(VOICE_ID, newVoiceRig);
      commit(L.start(patch));
    } else {
      openProject(PRACTICE, () => Pj.newProject({ name: "Practice", voiceName: "Sound" }));
      commit(L.start());
    }
    render();
    fit(); // a lesson opens with everything in view
    check();
    save();
  }
  const tried = (type, key) => {
    const s = new Set();
    for (const m of patch.modules) if (m.type === type) for (const v of counters.tried.get(`${m.id}.${key}`) || []) s.add(v);
    return s;
  };
  const ctx = () =>
    lesson?.kind === "compose"
      ? {
          project,
          voice: (r) => Pj.voiceByRole(project, r),
          patch: (r) => Pj.voiceByRole(project, r)?.patch || null,
          notes: (r) => {
            const v = Pj.voiceByRole(project, r);
            return v ? Pj.notesOf(project, v.id) : [];
          },
          loops: counters.loops,
          song: counters.song,
          numbers,
          tried,
        }
      : lesson?.kind === "voice"
        ? {
            patch,
            notes: counters.notes,
            tried,
            state: (type) => {
              const m = patch.modules.find((x) => x.type === type);
              return m && engine ? engine.state(m.id) : null;
            },
            layers: counters.layers,
            undos: counters.undos,
            orders: counters.orders,
          }
        : { patch, notes: counters.notes, tried };
  function check() {
    if (!lesson || currentId !== homeOf(lesson.kind)) return;
    const L = defOfLesson();
    if (lesson.kind === "voice") {
      // Which pedals the sound passes, in order: a swap is heard as a second order in the same step.
      const o = pedalOrder(patch);
      if (o.split(">").length >= 2) counters.orders.add(o);
    }
    let moved = false;
    while (L && lesson.step < L.steps.length && L.steps[lesson.step].done(ctx())) {
      lesson.step++;
      counters = fresh();
      moved = true;
    }
    if (moved) {
      save();
      if (lesson.step >= L.steps.length && !p.done.includes(L.id)) {
        p.done = [...p.done, L.id];
        keep({ done: p.done });
      }
      renderPanel();
      const li = panel.querySelector(".sg-steps li:last-child");
      if (li && !reduced) li.classList.add("is-new");
    }
  }
  const triedKnob = (id, key, v) => {
    const k = `${id}.${key}`;
    if (!counters.tried.has(k)) counters.tried.set(k, new Set());
    counters.tried.get(k).add(v);
  };

  // ---------- the sound switch ----------
  function soundButton() {
    const b = $('[data-act="sound"]');
    b.innerHTML = svg(p.muted ? "muted" : "sound");
    b.setAttribute("aria-label", p.muted ? "Sound is off" : "Sound is on");
    b.title = p.muted ? "Turn the sound on" : "Turn the sound off";
    b.setAttribute("aria-pressed", String(!p.muted));
  }

  // ---------- the keyboard ----------
  let octave = Math.min(7, Math.max(1, p.octave | 0 || 4));
  const down = new Map(); // code or pointer → note
  function drawPiano() {
    const whites = PIANO.filter(([, , s]) => !BLACK.has(s % 12));
    piano.style.setProperty("--whites", whites.length);
    piano.innerHTML = PIANO.map(([code, label, s]) => {
      const black = BLACK.has(s % 12);
      const wi = PIANO.slice(0, PIANO.findIndex((x) => x[0] === code)).filter(([, , q]) => !BLACK.has(q % 12)).length;
      const n = 12 * (octave + 1) + s;
      return `<button type="button" class="sg-key${black ? " is-black" : ""}" data-code="${code}" data-s="${s}" style="--i:${black ? wi - 0.5 : wi}" aria-label="${noteName(n)}" tabindex="-1"><span>${esc(label)}</span>${s % 12 === 0 ? `<small>${noteName(n)}</small>` : ""}</button>`;
    }).join("");
    $("[data-oct]").textContent = `Octave ${octave}`;
  }
  function play(id, s) {
    const n = 12 * (octave + 1) + s;
    if (down.has(id)) return;
    down.set(id, n);
    wake();
    engine.noteOn(n);
    piano.querySelector(`[data-s="${s}"]`)?.classList.add("is-down");
    counters.notes++;
    pen = n;
    updatePen();
    // Recording: the note goes into the step nearest to when the key went down, as long as it's held.
    if (rec && seq.playing && keyed(patch)) {
      const w = seq.where();
      if (w) recording.set(id, { s: Math.round(w.step + w.frac) % Pj.totalSteps(project), n, section: w.section, t: studio.ac.currentTime });
    }
    if (!keyed(patch) && patch.modules.some((m) => m.type === "keys")) say("The keyboard isn’t plugged into anything yet.");
    check();
  }
  function lift(id) {
    const n = down.get(id);
    if (n == null) return;
    down.delete(id);
    if (![...down.values()].includes(n)) {
      engine.noteOff(n);
      piano.querySelector(`[data-s="${n - 12 * (octave + 1)}"]`)?.classList.remove("is-down");
    }
    const r = recording.get(id);
    if (r) {
      recording.delete(id);
      const l = Math.max(1, Math.round((studio.ac.currentTime - r.t) / Pj.stepSeconds(project)));
      commitProject(Pj.placeNote(project, project.front, r.s, r.n, l, r.section));
    }
  }
  function liftAll() {
    for (const id of [...down.keys()]) lift(id);
    engine?.allOff();
    piano.querySelectorAll(".is-down").forEach((k) => k.classList.remove("is-down"));
  }
  function shiftOctave(by) {
    const o = Math.min(7, Math.max(1, octave + by));
    if (o === octave) return;
    liftAll();
    octave = o;
    keep({ octave });
    drawPiano();
  }

  // ---------- events ----------
  const typing = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (e.target?.dataset?.note || e.target?.id === "sg-own") return e.target.blur();
      if (e.target?.id === "sg-name") return ((keeping = false), renderPanel());
      if (!menu.hidden) return closeMenu();
      if (pulling || armed) return ((pulling = null), disarm(), drawCables(), say("No cable made."));
      if (side === "lessons" && listing && lesson) return ((listing = false), renderPanel());
      return close();
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "z" && !typing(e.target)) {
      e.preventDefault();
      return e.shiftKey ? restore(redo, undo) : restore(undo, redo);
    }
    // ⌘0 fits the board; ⌘= and ⌘- zoom in and out from the middle.
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !typing(e.target) && ["0", "=", "+", "-"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "0") return unzoom();
      return zoomTo(scale * (e.key === "-" ? 1 / 1.25 : 1.25));
    }
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    if (!menu.hidden) return;
    // The loop: Space plays it (with Shift, the whole track), R records, 1 to 4 put a voice on the board.
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat) toggle(e.shiftKey ? "song" : "loop");
      return;
    }
    if (e.code === "KeyR") {
      e.preventDefault();
      if (!e.repeat) toggleRec();
      return;
    }
    const vi = VOICE_KEYS.indexOf(e.code);
    if (vi >= 0) {
      e.preventDefault();
      const v = project.voices[vi];
      if (v) bringFront(v.id);
      return;
    }
    // With a Looper on the board, L records (and Shift L takes the last layer off).
    if (e.code === "KeyL" && looperId()) {
      e.preventDefault();
      if (!e.repeat) doAction(looperId(), e.shiftKey ? "undo" : "press");
      return;
    }
    const k = PIANO.find(([code]) => code === e.code);
    if (k) {
      e.preventDefault();
      if (!e.repeat) play(e.code, k[2]);
      return;
    }
    if (e.code === "KeyZ" || e.code === "KeyX") {
      e.preventDefault();
      if (!e.repeat) shiftOctave(e.code === "KeyZ" ? -1 : 1);
    }
  }
  function onKeyUp(e) {
    if (down.has(e.code)) lift(e.code);
  }
  const onBlur = () => liftAll();

  // A knob: dragged up and down, the arrow keys, Home and End, a double-click for its default.
  function knobTo(el, value, { history = false } = {}) {
    const id = el.dataset.mod,
      key = el.dataset.key;
    const m = moduleOf(patch, id);
    const d = defOf(m.type).params[key];
    const next = setParam(patch, id, key, value);
    if (next === patch) return;
    if (history) remember();
    put(next);
    const v = moduleOf(patch, id).p[key];
    engine.set(id, key, v, patch);
    triedKnob(id, key, v);
    el.outerHTML = knobHTML(moduleOf(patch, id), key, d);
    save();
    check();
    return board.querySelector(`.sg-knob[data-mod="${id}"][data-key="${key}"]`);
  }
  let drag = null;
  // The column's width: dragged at its left edge, kept in Signal's prefs (240 to 560 px).
  const MARGIN_MIN = 240,
    MARGIN_MAX = 560;
  const setMargin = (w) => {
    const v = Math.round(Math.max(MARGIN_MIN, Math.min(MARGIN_MAX, w)));
    bodyEl.style.setProperty("--sg-margin", `${v}px`);
    return v;
  };
  function startResize(e) {
    e.preventDefault();
    const h = e.target.closest(".sg-resize");
    const startX = e.clientX,
      startW = marginEl.getBoundingClientRect().width;
    let w = startW;
    h.setPointerCapture?.(e.pointerId);
    h.classList.add("is-dragging");
    const move = (ev) => (w = setMargin(startW + (startX - ev.clientX)));
    const up = () => {
      h.removeEventListener("pointermove", move);
      h.removeEventListener("pointerup", up);
      h.removeEventListener("pointercancel", up);
      h.classList.remove("is-dragging");
      p.margin = w === 264 ? 0 : w;
      keep({ margin: p.margin });
      drawCables();
    };
    h.addEventListener("pointermove", move);
    h.addEventListener("pointerup", up);
    h.addEventListener("pointercancel", up);
  }
  function onPointerDown(e) {
    wake();
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest(".sg-resize")) return startResize(e);
    const key = e.target.closest(".sg-key");
    if (key) {
      e.preventDefault();
      key.setPointerCapture?.(e.pointerId);
      play(`p${e.pointerId}`, Number(key.dataset.s));
      return;
    }
    const cell = e.target.closest(".sg-cell");
    if (cell) {
      e.preventDefault();
      cell.focus({ preventScroll: true });
      const painting = stepAct(cell.dataset.v, Number(cell.dataset.s), { remove: e.altKey });
      // Dragging on from a new note makes it longer.
      if (painting) (drag = { kind: "paint", ...painting, l: 1 }), dialog.setPointerCapture?.(e.pointerId);
      return;
    }
    const knob = e.target.closest(".sg-knob");
    if (knob) {
      e.preventDefault();
      knob.focus({ preventScroll: true });
      const m = moduleOf(patch, knob.dataset.mod);
      const d = defOf(m.type).params[knob.dataset.key];
      drag = { kind: "knob", id: knob.dataset.mod, key: knob.dataset.key, y: e.clientY, t: toTravel(d, m.p[knob.dataset.key]), before: project, d };
      dialog.setPointerCapture?.(e.pointerId);
      dialog.classList.add("is-turning");
      return;
    }
    const jack = e.target.closest(".sg-jack");
    if (jack) {
      e.preventDefault();
      // A jack was clicked first: this one is its other end (or, clicked again, the same jack lets go).
      if (armed) {
        if (jack.classList.contains("is-target")) return finishPull(jack);
        if (jack === armed.jack || jack.classList.contains("is-armed")) return disarm(), say("No cable made.");
        disarm();
      }
      return startPull(jack, e);
    }
    const head = e.target.closest(".sg-mod-head");
    if (head && !e.target.closest("button")) {
      e.preventDefault();
      const card = head.closest(".sg-mod");
      const m = moduleOf(patch, card.dataset.id);
      drag = { kind: "move", id: m.id, card, x: e.clientX, y: e.clientY, mx: m.x, my: m.y, moved: false };
      dialog.setPointerCapture?.(e.pointerId);
      card.classList.add("is-moving");
      return;
    }
    // The floor itself: drag to move it; a second finger makes it a pinch.
    if (isFloor(e.target)) {
      e.preventDefault();
      if (e.pointerType === "touch") {
        fingers.set(e.pointerId, [e.clientX, e.clientY]);
        if (fingers.size === 2) {
          const [a, b] = [...fingers.values()];
          pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, k: cam.k, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
          drag = null;
          stage.classList.remove("is-panning");
          return;
        }
      }
      drag = { kind: "pan", x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
      dialog.setPointerCapture?.(e.pointerId);
      stage.classList.add("is-panning");
    }
  }
  function boardPoint(e) {
    const b = board.getBoundingClientRect();
    return [(e.clientX - b.left) / scale, (e.clientY - b.top) / scale];
  }
  function startPull(jack, e) {
    const { mod, dir, port } = jack.dataset;
    let from = null,
      to = null,
      picked = false,
      kind = jack.dataset.kind;
    if (dir === "out") from = [mod, port];
    else {
      const ins = cablesInto(patch, mod, port);
      if (ins.length) {
        // Pulling a plugged input takes its newest cable off, still held at its other end.
        const c = ins[ins.length - 1];
        from = [...c.from];
        kind = kindOf(patch, c);
        remember();
        put(disconnect(patch, c.id));
        engine.load(patch);
        picked = true;
      } else to = [mod, port];
    }
    pulling = { from, to, kind, at: boardPoint(e), x: e.clientX, y: e.clientY, jack };
    drag = { kind: "pull", picked, moved: false };
    dialog.setPointerCapture?.(e.pointerId);
    markTargets();
    drawCables();
  }
  function markTargets() {
    for (const j of board.querySelectorAll(".sg-jack")) {
      const { mod, dir, port, kind } = j.dataset;
      let ok = false;
      if (pulling.from && dir === "in") ok = mod !== pulling.from[0] && fits(pulling.kind, kind);
      if (pulling.to && dir === "out") ok = mod !== pulling.to[0] && fits(kind, pulling.kind);
      j.classList.toggle("is-target", ok);
    }
    board.classList.add("is-pulling");
  }
  function clearTargets() {
    board.classList.remove("is-pulling");
    board.querySelectorAll(".is-target, .is-over").forEach((j) => j.classList.remove("is-target", "is-over"));
  }
  function onPointerMove(e) {
    if (pinch && fingers.has(e.pointerId)) {
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      const [a, b] = [...fingers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const mx = (a[0] + b[0]) / 2,
        my = (a[1] + b[1]) / 2;
      zoomTo(pinch.k * (d / pinch.d), mx, my);
      panBy(mx - pinch.mx, my - pinch.my);
      pinch.mx = mx;
      pinch.my = my;
      return;
    }
    if (!drag) {
      const over = e.target.closest?.(".sg-cable");
      wires.querySelectorAll(".is-hover").forEach((g) => g !== over && g.classList.remove("is-hover"));
      over?.classList.add("is-hover");
      return;
    }
    if (drag.kind === "pan") {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 2) drag.moved = true;
      cam.x = drag.cx - (e.clientX - drag.x) / cam.k;
      cam.y = drag.cy - (e.clientY - drag.y) / cam.k;
      if (drag.moved) atFit = false;
      applyCamera();
      return;
    }
    if (drag.kind === "paint") {
      const c = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(`.sg-cell[data-v="${drag.v}"]`);
      if (!c) return;
      const l = Math.max(1, Number(c.dataset.s) - drag.s + 1);
      if (l !== drag.l) (drag.l = l), commitProject(Pj.placeNote(project, drag.v, drag.s, drag.n, l), { history: false });
      return;
    }
    if (drag.kind === "knob") {
      const fine = e.shiftKey ? 900 : 180;
      const t = drag.t + (drag.y - e.clientY) / fine;
      const el = board.querySelector(`.sg-knob[data-mod="${drag.id}"][data-key="${drag.key}"]`);
      if (el) knobTo(el, toValue(drag.d, t))?.focus({ preventScroll: true });
    } else if (drag.kind === "move") {
      const dx = (e.clientX - drag.x) / scale,
        dy = (e.clientY - drag.y) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      const nx = Math.round(drag.mx + dx),
        ny = Math.round(drag.my + dy);
      drag.card.style.left = `${nx}px`;
      drag.card.style.top = `${ny}px`;
      drag.at = [nx, ny];
      measure();
      drawCables();
    } else if (drag.kind === "pull" && pulling) {
      if (Math.abs(e.clientX - pulling.x) + Math.abs(e.clientY - pulling.y) > 4) drag.moved = true;
      pulling.at = boardPoint(e);
      board.querySelectorAll(".is-over").forEach((j) => j.classList.remove("is-over"));
      const j = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".sg-jack.is-target");
      j?.classList.add("is-over");
      drawCables();
    }
  }
  function onPointerUp(e) {
    if (down.has(`p${e.pointerId}`)) return lift(`p${e.pointerId}`);
    if (fingers.has(e.pointerId)) {
      fingers.delete(e.pointerId);
      if (fingers.size < 2) pinch = null;
    }
    if (drag?.kind === "pan") {
      drag = null;
      stage.classList.remove("is-panning");
      return;
    }
    if (!drag) {
      // A click on a cable takes it out.
      const g = e.target.closest?.(".sg-cable");
      if (g) {
        commit(disconnect(patch, g.dataset.cable));
        cableGone = performance.now();
      }
      return;
    }
    const d = drag;
    drag = null;
    dialog.classList.remove("is-turning");
    if (d.kind === "paint") return;
    if (d.kind === "knob") {
      if (project !== d.before) (undo.push(d.before), (redo.length = 0));
      return;
    }
    if (d.kind === "move") {
      d.card.classList.remove("is-moving");
      if (d.moved && d.at) commit(moveModule(patch, d.id, d.at[0], d.at[1]), { rebuild: false }), measure();
      return;
    }
    if (d.kind === "pull" && pulling) {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest?.(".sg-jack.is-target");
      if (!target && !d.moved && !d.picked) {
        // A click on a jack, not a drag: it waits for the other end, which is clicked next.
        armed = pulling;
        pulling = null;
        clearTargets();
        armed.jack.classList.add("is-armed");
        markArmed();
        drawCables();
        say(armed.from ? "Now choose an input for it." : "Now choose an output for it.");
        return;
      }
      finishPull(target, d.picked);
    }
  }
  let armed = null;
  function disarm() {
    armed = null;
    clearTargets();
    board.querySelectorAll(".is-armed").forEach((j) => j.classList.remove("is-armed"));
  }
  function markArmed() {
    pulling = armed;
    markTargets();
    pulling = null;
  }
  function finishPull(target, picked = false) {
    const pl = pulling || armed;
    pulling = null;
    disarm();
    if (target && pl) {
      const t = [target.dataset.mod, target.dataset.port];
      const r = connect(patch, pl.from || t, pl.to || t);
      // A cable picked up from one input and put into another is one change, for undo.
      if (r.id) return commit(r.patch, { history: !picked });
    }
    // Dropped nowhere: a picked-up cable stays out (that is how one is taken off), else nothing changes.
    if (picked) (render(), save(), check());
    else drawCables();
  }
  function onClick(e) {
    const t = e.target.closest("button, [data-side]");
    if (!t) return;
    if (t.classList.contains("sg-jack")) {
      if (e.detail === 0 && armed && t.classList.contains("is-target")) finishPull(t);
      else if (e.detail === 0) {
        // The keyboard's Enter or Space on a jack: arm it, then pick the other end the same way.
        if (armed) disarm();
        const { mod, dir, port, kind } = t.dataset;
        armed = { from: dir === "out" ? [mod, port] : null, to: dir === "in" ? [mod, port] : null, kind, jack: t };
        t.classList.add("is-armed");
        markArmed();
        say(armed.from ? "Now choose an input for it." : "Now choose an output for it.");
      }
      return;
    }
    if (armed && !t.closest(".sg-mod")) disarm();
    if (t.dataset.side) {
      side = t.dataset.side;
      listing = false;
      keep({ side });
      renderPanel();
      dialog.querySelector(`.sg-seg [data-side="${side}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (t.dataset.val != null && t.dataset.key) {
      const id = t.dataset.mod,
        key = t.dataset.key;
      const next = setParam(patch, id, key, t.dataset.val);
      triedKnob(id, key, t.dataset.val);
      if (next !== patch) {
        remember();
        put(next);
        engine.set(id, key, t.dataset.val, patch);
        const card = board.querySelector(`.sg-mod[data-id="${id}"] .sg-params`);
        if (card) card.innerHTML = paramsHTML(moduleOf(patch, id));
        board.querySelector(`[data-mod="${id}"][data-key="${key}"][data-val="${t.dataset.val}"]`)?.focus({ preventScroll: true });
        save();
      }
      check();
      return;
    }
    const act = t.dataset.act;
    if (act === "close") return close();
    if (act === "undo") return restore(undo, redo);
    if (act === "fit") return fit();
    if (act === "modact") return doAction(t.dataset.mod, t.dataset.action);
    // The master class.
    if (act === "session") {
      sessionView = Number(t.dataset.session) || null;
      listing = false;
      side = "lessons";
      keep({ side });
      renderPanel();
      panel.querySelector("h3")?.scrollIntoView?.({ block: "start" });
      return;
    }
    if (act === "another") {
      // The page's own session when asked from a session page, else the session of the lesson under way.
      const s = t.dataset.session ? sessionOf(Number(t.dataset.session)) : sessionNow();
      const key = s ? s.n : 0;
      nbAt.set(key, (nbAt.get(key) || 0) + 1);
      renderPanel();
      return renderMargin();
    }
    if (act === "asksession") {
      const s = sessionOf(Number(t.dataset.session)) || sessionNow();
      return askGhost(notebookQuestion(s), s, { said: "" });
    }
    if (act === "doit") return takeOffer(t.dataset.msg);
    if (act === "showme") return takeOffer(t.dataset.msg, { show: true });
    if (act === "sound") {
      p.muted = !p.muted;
      keep({ muted: p.muted });
      if (studio.master) studio.master.gain.setTargetAtTime(p.muted ? 0 : 0.9, studio.ac.currentTime, 0.03);
      soundButton();
      return;
    }
    // The loop.
    if (act === "play") return toggle("loop");
    if (act === "song") return toggle("song");
    if (act === "rec") return toggleRec();
    if (act === "bars") return commitProject(Pj.setBars(project, t.dataset.bars));
    if (act === "front") return bringFront(t.dataset.v);
    if (act === "addvoice") return commitProject(Pj.addVoice(project, (r) => rolePatch(r, "full")).project);
    if (act === "removevoice") return commitProject(Pj.removeVoice(project, t.dataset.v));
    if (act === "clearrow") return commitProject(Pj.clearVoice(project, t.dataset.v));
    if (act === "section") return commitProject(Pj.setSection(project, t.dataset.sec), { history: false });
    if (act === "newsection") return commitProject(Pj.addSection(project));
    if (act === "removesection") return commitProject(Pj.removeSection(project, t.dataset.sec));
    if (act === "times") {
      const s = Pj.sectionOf(project, t.dataset.sec);
      return commitProject(Pj.setTimes(project, s.id, Pj.TIMES[(Pj.TIMES.indexOf(s.times) + 1) % Pj.TIMES.length]));
    }
    // The Ghost Producer.
    if (act === "ask") {
      const a = ASKS.find((x) => x.id === t.dataset.ask);
      return a && askGhost(a.ask(drawCard()), sessionNow(), { said: a.label });
    }
    if (act === "stopask") {
      asking?.abort();
      asking = null;
      doing?.controller.abort();
      return renderMargin();
    }
    if (act === "undoall") {
      const r = runs.find((x) => x.id === t.dataset.run);
      if (!r || r.after !== project) return;
      r.after = null;
      commitProject(r.before, { board: true });
      return void post("app", "Put back as it was.");
    }

    if (act === "measure") return doMeasure().then((n) => n && post("app", numbersLine()));
    if (act === "resize") return;
    if (act === "setup") return (close(), ai?.setup?.());
    // The projects.
    if (act === "wav") return exportWav();
    if (act === "json") return download(new Blob([JSON.stringify(JSON.parse(Pj.serializeProject(project)), null, 1)], { type: "application/json" }), fileName(project.name, ".signal.json"));
    if (act === "copytext")
      return navigator.clipboard?.writeText(projectText(project, numbers, { ai: true })).then(
        () => say("The project is copied as text."),
        () => say("Copying didn’t work here."),
      );
    if (act === "import") return panel.querySelector('[data-input="import"]')?.click();
    if (act === "newproject") {
      const n = p.projects.length + 1;
      openProject(newId(), () => Pj.newProject({ name: `Project ${n}`, patch: rolePatch("pulse", "full") }));
      side = "projects";
      return renderPanel();
    }
    if (act === "openproject") {
      openProject(t.dataset.project);
      return renderPanel();
    }
    if (act === "forgetproject") {
      p.projects = p.projects.filter((x) => x.id !== t.dataset.project);
      keep({ projects: p.projects });
      return renderPanel();
    }
    if (act === "lessonback") {
      const l = lesson;
      openProject(homeOf(l.kind), makeHome(l.kind));
      fit();
      return renderPanel();
    }
    if (act === "add") return !menu.hidden && menuFor === t ? closeMenu() : openMenu();
    if (act === "paper") return !menu.hidden && menuFor === t ? closeMenu() : openPaperMenu();
    if (act === "setpaper") {
      const paper = PAPERS.includes(t.dataset.paper) ? t.dataset.paper : "";
      p.paper = paper;
      keep({ paper });
      applyTheme();
      readColors();
      closeMenu();
      return say(paper ? `${PAPER_NAMES[paper]} paper.` : "The paper follows the system.");
    }
    if (act === "addmod") {
      const type = t.dataset.type;
      closeMenu(false);
      const r = addModule(patch, type, freeSpot(patch, viewRect()));
      commit(r.patch);
      const card = board.querySelector(`.sg-mod[data-id="${r.id}"]`);
      if (card) {
        card.classList.add("is-new");
        setTimeout(() => card.classList.remove("is-new"), 1200);
        (card.querySelector("textarea[data-note]") || card.querySelector(".sg-jack, .sg-knob, button"))?.focus({ preventScroll: true });
      }
      return;
    }
    if (act === "remove") {
      commit(removeModule(patch, t.dataset.mod));
      return;
    }
    if (act === "lesson") return startLesson(t.dataset.lesson, t.dataset.kind || "patch");
    if (act === "lessons") return ((listing = true), (sessionView = null), renderPanel(), panel.querySelector("button")?.focus({ preventScroll: true }));
    if (act === "restart") return startLesson(lesson.id, lesson.kind);
    if (act === "keepcancel") return ((keeping = false), renderPanel());
    if (act === "keep") {
      side = "patches";
      keeping = true;
      renderPanel();
      const input = panel.querySelector("#sg-name");
      if (input) (input.value = defOfLesson()?.title || ""), input.focus(), input.select();
      return;
    }
    if (act === "preset") {
      const pr = presetOf(t.dataset.preset);
      lesson = null;
      commit(pr.patch());
      return;
    }
    if (act === "open") {
      const x = (p.patches || []).find((y) => y.id === t.dataset.patch);
      if (!x) return;
      lesson = null;
      commit(parse(x.patch));
      return;
    }
    if (act === "forget") {
      p.patches = (p.patches || []).filter((y) => y.id !== t.dataset.patch);
      keep({ patches: p.patches });
      renderPanel();
      return;
    }
    if (act === "clear") {
      lesson = null;
      commit(empty());
      return;
    }
  }
  function onSubmit(e) {
    const ask = e.target.closest("form[data-form=ask]");
    if (ask) {
      e.preventDefault();
      const q = String(new FormData(ask).get("q") || "").trim();
      if (q) askGhost(q, sessionNow(), { hands: true });
      return;
    }
    const rn = e.target.closest("form[data-form=rename]");
    if (rn) {
      e.preventDefault();
      const name = String(new FormData(rn).get("name") || "").trim().slice(0, 40);
      if (name) (project = { ...project, name }), flush(), renderPanel();
      return;
    }
    const f = e.target.closest("form[data-form=keep]");
    if (!f) return;
    e.preventDefault();
    const name = String(new FormData(f).get("name") || "").trim() || `Patch ${(p.patches || []).length + 1}`;
    const list = (p.patches || []).filter((x) => x.name !== name);
    p.patches = [{ id: `p${Date.now().toString(36)}`, name, at: new Date().toISOString(), patch: serialize(patch) }, ...list].slice(0, 60);
    keep({ patches: p.patches });
    keeping = false;
    renderPanel();
    say(`Kept as “${name}”.`);
  }
  function onKnobKey(e) {
    const el = e.target.closest?.(".sg-knob");
    if (!el) return;
    const m = moduleOf(patch, el.dataset.mod);
    const d = defOf(m.type).params[el.dataset.key];
    const t = toTravel(d, m.p[el.dataset.key]);
    const stepT = d.step ? (d.step / (d.max - d.min)) * (e.shiftKey ? 5 : 1) : e.shiftKey ? 0.1 : 0.02;
    let v = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") v = d.step && d.curve !== "sq" && d.curve !== "exp" ? m.p[el.dataset.key] + d.step * (e.shiftKey ? 5 : 1) : toValue(d, t + stepT);
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") v = d.step && d.curve !== "sq" && d.curve !== "exp" ? m.p[el.dataset.key] - d.step * (e.shiftKey ? 5 : 1) : toValue(d, t - stepT);
    else if (e.key === "Home") v = d.min;
    else if (e.key === "End") v = d.max;
    if (v == null) return;
    e.preventDefault();
    e.stopPropagation();
    knobTo(el, v, { history: true })?.focus({ preventScroll: true });
  }
  let cableGone = 0;
  function onDblClick(e) {
    const r = e.target.closest("[data-rename]");
    if (r) return renameStart(r);
    // The floor: a double-click goes to full size there, or back to everything in view.
    if (isFloor(e.target) && performance.now() - cableGone > 500) return atFit ? zoomTo(1, e.clientX, e.clientY) : fit();
    const el = e.target.closest(".sg-knob");
    if (!el) return;
    const m = moduleOf(patch, el.dataset.mod);
    knobTo(el, defOf(m.type).params[el.dataset.key].def, { history: true })?.focus({ preventScroll: true });
  }

  // ---------- the menus: Add (a module for the board) and Paper (what the instrument lies on) ----------
  let menuFor = null; // the button the open menu belongs to
  function showMenu(button, label) {
    menuFor?.setAttribute("aria-expanded", "false");
    menuFor = button;
    menu.setAttribute("aria-label", label);
    const b = button.getBoundingClientRect();
    menu.style.top = `${b.bottom + 6}px`;
    menu.style.right = `${Math.max(12, innerWidth - b.right)}px`;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    (menu.querySelector('[aria-checked="true"]') || menu.querySelector("button:not([disabled])"))?.focus();
  }
  function openMenu() {
    const has = new Set(patch.modules.map((m) => m.type));
    menu.innerHTML = GROUPS.map(
      (g) =>
        `<p class="sg-menu-h" role="presentation">${esc(g.name)}</p>` +
        g.types
          .map((type) => {
            const d = MODULES[type];
            const off = d.single && has.has(type);
            return `<button type="button" role="menuitem" data-act="addmod" data-type="${type}" ${off ? 'aria-disabled="true" disabled' : ""}><strong>${esc(d.name)}</strong><small>${off ? "Already on the board." : esc(d.line)}</small></button>`;
          })
          .join(""),
    ).join("");
    showMenu($(".sg-add"), "Add a module");
  }
  function openPaperMenu() {
    const on = chosenPaper();
    const item = (id, name, line) =>
      `<button type="button" role="menuitemradio" aria-checked="${String(id === on)}" data-act="setpaper" data-paper="${id}"><i class="sg-swatch" data-paper="${id || "system"}" aria-hidden="true"></i><span><strong>${name}</strong>${line ? `<small>${line}</small>` : ""}</span></button>`;
    menu.innerHTML = item("", "As the system", "Stone when it is light, slate when it is dark.") + PAPERS.map((id) => item(id, PAPER_NAMES[id], "")).join("");
    showMenu($(".sg-paper"), "Paper");
  }
  function closeMenu(refocus = true) {
    menu.hidden = true;
    menuFor?.setAttribute("aria-expanded", "false");
    if (refocus) menuFor?.focus();
    menuFor = null;
  }
  function onMenuKey(e) {
    if (menu.hidden || !menu.contains(e.target)) return;
    const items = [...menu.querySelectorAll("button:not([disabled])")];
    const i = items.indexOf(e.target);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }
  const onOutside = (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('[aria-haspopup="menu"]')) closeMenu(false);
  };

  // ---------- open ----------
  dialog.addEventListener("keydown", onMenuKey);
  dialog.addEventListener("keydown", onKnobKey, true);
  // On the window, not the dialog: a click that redraws a panel can leave the focus on the page's body.
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  dialog.addEventListener("pointerdown", onOutside, true);
  dialog.addEventListener("pointerdown", onPointerDown);
  dialog.addEventListener("pointermove", onPointerMove);
  dialog.addEventListener("pointerup", onPointerUp);
  dialog.addEventListener("pointercancel", (e) => (down.has(`p${e.pointerId}`) ? lift(`p${e.pointerId}`) : ((drag = null), (pulling = null), (pinch = null), fingers.delete(e.pointerId), stage.classList.remove("is-panning"), clearTargets(), drawCables())));
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("dblclick", onDblClick);
  dialog.addEventListener("submit", onSubmit);
  dialog.addEventListener("keydown", onLoopKey, true);
  // A note's words: the card grows with them, and one burst of typing is one step of undo.
  function growNote(t) {
    t.style.height = "auto";
    t.style.height = `${t.scrollHeight}px`;
  }
  let noteBurst = null; // { id, timer }
  function onInput(e) {
    const t = e.target;
    const id = t.dataset?.note;
    if (!id) return;
    const first = noteBurst?.id !== id;
    clearTimeout(noteBurst?.timer);
    noteBurst = { id, timer: setTimeout(() => (noteBurst = null), 1500) };
    growNote(t);
    const next = setParam(patch, id, "text", t.value);
    if (next === patch) return;
    if (first) remember();
    put(next);
    engine.set(id, "text", t.value, patch);
    save();
  }
  dialog.addEventListener("input", onInput);
  dialog.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset?.input === "tempo") commitProject(Pj.setTempo(project, t.value));
    else if (t.dataset?.input === "import" && t.files?.[0]) importFile(t.files[0]);
  });
  const onWide = () => {
    if (wideMQ.matches && side === "notes") side = "lessons";
    renderPanel();
    renderMargin();
    if (wideMQ.matches) marginEl.hidden = false;
    else ((marginEl.querySelector(".sg-ghost").innerHTML = ""), (marginEl.hidden = true));
  };
  wideMQ.addEventListener?.("change", onWide);
  dialog.addEventListener("cancel", (e) => e.preventDefault());
  window.addEventListener("blur", onBlur);
  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("gesturestart", onGestureStart);
  stage.addEventListener("gesturechange", onGestureChange);
  const ro = new ResizeObserver(() => (atFit ? fit() : applyCamera(), board.querySelectorAll("canvas.sg-view").forEach(sizeCanvas)));
  ro.observe(stage);

  soundButton();
  drawPiano();
  readColors();
  // The first time, lesson one; after that, the board as it was left (and the lesson, at its step).
  if (!project) {
    const L = LESSONS[0];
    lesson = { kind: "patch", id: L.id, step: 0 };
    currentId = PRACTICE;
    project = Pj.newProject({ name: "Practice", patch: L.start(), voiceName: "Sound" });
    patch = Pj.frontOf(project).patch;
  } else if (p.lesson) {
    const kind = p.lesson.kind === "compose" || p.lesson.kind === "voice" ? p.lesson.kind : "patch";
    const L = defOfLesson({ kind, id: p.lesson.id });
    if (L) lesson = { kind, id: L.id, step: Math.min(L.steps.length, Math.max(0, p.lesson.step | 0)) };
  }
  syncEngines();
  onWide();
  render();
  fit();
  flush();
  darkMQ.addEventListener?.("change", readColors);
  raf = requestAnimationFrame(frame);
  dialog.focus({ preventScroll: true });

  function close() {
    if (!current) return;
    current = null;
    doing?.controller.abort();
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    darkMQ.removeEventListener?.("change", onScheme);
    darkMQ.removeEventListener?.("change", readColors);
    wideMQ.removeEventListener?.("change", onWide);
    flush();
    seq.stop();
    for (const e of engines.values()) e.close();
    engines.clear();
    releaseMic();
    try {
      studio.ac?.close();
    } catch {}
    const gone = () => {
      try {
        dialog.close();
      } catch {}
      dialog.remove();
      back?.focus?.({ preventScroll: true });
      onClose?.();
    };
    if (reduced) gone();
    else (dialog.classList.add("is-closing"), setTimeout(gone, 140));
  }
  const api = {
    close,
    get patch() {
      return patch;
    },
    get lesson() {
      return lesson ? { ...lesson } : null;
    },
    get engine() {
      return engine;
    },
    get project() {
      return project;
    },
    get numbers() {
      return numbers;
    },
    get playing() {
      return seq.playing;
    },
    // For tests and the try-it page: drive it as a person would, without the pointer.
    play: (mode = "loop") => (seq.playing === mode ? null : startLoop(mode)),
    stop: () => stopLoop(),
    where: () => seq.where(),
    step: (v, s, n) => ((pen = n ?? pen), stepAct(v, s)),
    front: (id) => bringFront(id),
    measure: () => doMeasure(),
    ask: (q, o) => askGhost(q, sessionNow(), o),
    get doing() {
      return doing;
    },
    get runs() {
      return runs;
    },
    render: (o) => renderSound(project, o),
    flush,
    connect: (from, to) => {
      const r = connect(patch, from, to);
      if (r.id) commit(r.patch);
      return r.id;
    },
    disconnect: (id) => commit(disconnect(patch, id)),
    act: (id, name) => doAction(id, name),
    state: (id) => engine?.state(id) || null,
    get camera() {
      return { ...cam, fit: atFit };
    },
    fit,
    zoom: (k, x, y) => zoomTo(k, x, y),
    pan: (dx, dy) => panBy(dx, dy),
    get session() {
      return sessionNow()?.n ?? null;
    },
    openSession: (n) => ((sessionView = n), (listing = false), renderPanel()),
    set: (id, key, v) => {
      const el = board.querySelector(`.sg-knob[data-mod="${id}"][data-key="${key}"]`);
      if (el) return knobTo(el, v, { history: true }), moduleOf(patch, id).p[key];
      const b = board.querySelector(`[data-mod="${id}"][data-key="${key}"][data-val="${v}"]`);
      b?.click();
      return moduleOf(patch, id)?.p[key];
    },
    add: (type) => {
      const r = addModule(patch, type, freeSpot(patch, viewRect()));
      commit(r.patch);
      return r.id;
    },
    lessonStart: (id, kind) => startLesson(id, kind),
    freq: (n) => midiHz(n),
    free: FREE_HZ,
    portOf,
  };
  dialog.signal = api;
  current = api;
  return api;
}
