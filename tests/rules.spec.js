import { test, expect } from "@playwright/test";
import { fits, toValue, toTravel, tidy, MODULES, defaults, ADDABLE, GROUPS, PEDALS, actionsOf } from "../src/modules.js";
import { build, connect, disconnect, canConnect, parse, serialize, addModule, removeModule, setParam, wired, chain, keyed, heard, empty, freeSpot, addPlace, nextPlace, bounds, placeOf, BOARD, COL, ROW } from "../src/patch.js";
import { LESSONS } from "../src/lessons.js";
import { PRESETS, rolePatch, ROLE_PATCHES } from "../src/presets.js";
import * as Pj from "../src/project.js";
import { COURSE, newCourse } from "../src/course.js";
import { DECK, SYSTEM, STANCE, systemFor, ASKS, parseNotes, parseReply, projectText, userFor } from "../src/ghost.js";
import { VOICE_LESSONS, newVoiceRig, pedalOrder } from "../src/voice.js";
import { SESSIONS, PARTS, sessionOfLesson, buildDef, sessionDone } from "../src/sessions.js";
import { MODES, afterPress, afterUndo, clockFromLoop, layerOffset, placeLayer, pressLabel } from "../src/looper.js";
import { echoesCard } from "../src/ghost-cards.js";

test.describe("Signal's rules", () => {
  test("an output fits an input of its own kind; audio also fits a mod input (FM), nothing else crosses", () => {
    expect(fits("audio", "audio")).toBe(true);
    expect(fits("audio", "mod")).toBe(true);
    expect(fits("mod", "mod")).toBe(true);
    expect(fits("mod", "audio")).toBe(false);
    expect(fits("pitch", "mod")).toBe(false);
    expect(fits("gate", "pitch")).toBe(false);
  });

  test("a knob's travel follows its curve both ways; values are kept in range and on their step", () => {
    const cut = MODULES.filter.params.cutoff;
    expect(toValue(cut, 0)).toBe(40);
    expect(toValue(cut, 1)).toBe(16000);
    expect(toValue(cut, 0.5)).toBeCloseTo(800, -1); // the middle of an exponential knob is the geometric middle
    expect(toTravel(cut, toValue(cut, 0.3))).toBeCloseTo(0.3, 3);
    const tune = MODULES.osc.params.tune;
    expect(toValue(tune, 0.5)).toBe(0);
    expect(toValue(tune, 2)).toBe(24);
    expect(Number.isInteger(toValue(tune, 0.37))).toBe(true);
  });

  test("cables: kinds must fit, never into itself, never twice; a pitch or gate input takes one; removing a module takes its cables", () => {
    let p = build({ keys: [0, 0], osc: [0, 0], osc2: [0, 0], env: [0, 0], out: [0, 0] });
    expect(canConnect(p, ["osc", "out"], ["out", "in"])).toBe(true);
    expect(canConnect(p, ["osc", "out"], ["osc", "mod"])).toBe(false);
    expect(canConnect(p, ["env", "out"], ["out", "in"])).toBe(false);
    expect(canConnect(p, ["osc", "out"], ["osc2", "mod"])).toBe(true);
    p = connect(p, ["osc", "out"], ["out", "in"]).patch;
    expect(connect(p, ["osc", "out"], ["out", "in"]).id).toBe(null);
    p = connect(p, ["osc2", "out"], ["out", "in"]).patch;
    expect(p.cables.filter((c) => c.to[0] === "out")).toHaveLength(2);
    p = connect(p, ["keys", "gate"], ["env", "gate"]).patch;
    expect(keyed(p)).toBe(true);
    p = connect(p, ["keys", "pitch"], ["osc", "pitch"]).patch;
    expect(wired(p, "keys.pitch", "osc.pitch")).toBe(true);
    expect(removeModule(p, "out")).toBe(p); // the speaker stays
    const q = removeModule(p, "keys");
    expect(q.cables.some((c) => c.from[0] === "keys")).toBe(false);
    expect(keyed(q)).toBe(false);
    expect(disconnect(p, p.cables[0].id).cables).toHaveLength(p.cables.length - 1);
  });

  test("one keyboard and one speaker; a new module goes to a free place on the grid; knobs are tidied", () => {
    let p = empty();
    const a = addModule(p, "keys");
    p = a.patch;
    expect(addModule(p, "keys").patch).toBe(p);
    const spot = freeSpot(p);
    expect(p.modules.some((m) => m.x === spot.x && m.y === spot.y)).toBe(false);
    p = addModule(p, "filter").patch;
    expect(setParam(p, "filter1", "cutoff", 99999).modules.find((m) => m.id === "filter1").p.cutoff).toBe(16000);
    expect(setParam(p, "filter1", "type", "comb").modules.find((m) => m.id === "filter1").p.type).toBe("lowpass");
  });

  test("a kept patch reads back the same; what isn't understood is left out, never a reason to lose the rest", () => {
    const p = PRESETS[0].patch();
    expect(parse(serialize(p))).toEqual(p);
    const odd = parse({
      v: 9,
      modules: [
        { id: "osc", type: "osc", x: 10, y: 10, p: { wave: "sawtooth", tune: 99, later: 1 } },
        { id: "w", type: "wavetable", x: 0, y: 0 },
      ],
      cables: [
        { from: ["osc", "out"], to: ["out", "in"] },
        { from: ["w", "out"], to: ["out", "in"] },
        { from: ["osc"], to: "x" },
      ],
    });
    expect(odd.modules.map((m) => m.type).sort()).toEqual(["osc", "out"]);
    expect(odd.modules.find((m) => m.id === "osc").p).toEqual({ ...defaults("osc"), wave: "sawtooth", tune: 24 });
    expect(odd.cables).toHaveLength(1);
    expect(parse("not json")).toEqual(empty());
  });

  test("each lesson starts from a patch where its first step isn't done yet, and each step can be done", () => {
    for (const l of LESSONS) {
      const p = l.start();
      expect(parse(serialize(p))).toEqual(p);
      expect(l.steps[0].done({ patch: p, notes: 0, tried: () => new Set() }), l.id).toBe(false);
    }
    // Lesson one, done the way a person would.
    const L = LESSONS[0];
    let p = L.start();
    p = connect(p, ["osc", "out"], ["out", "in"]).patch;
    expect(L.steps[0].done({ patch: p, notes: 0, tried: () => new Set() })).toBe(true);
    expect(L.steps[1].done({ patch: p, notes: 0, tried: () => new Set([0, 1, 2, 3]) })).toBe(true);
    // Lesson four: the amp in the path, the envelope on its level, the keyboard's gate on the envelope.
    const E = LESSONS.find((l) => l.id === "envelope");
    p = E.start();
    p = addModule(p, "amp").patch;
    p = addModule(p, "env").patch;
    p = disconnect(p, p.cables.find((c) => c.to[0] === "out").id);
    for (const [a, b] of [["osc.out", "amp1.in"], ["amp1.out", "out.in"], ["env1.out", "amp1.level"], ["keys.gate", "env1.gate"]]) p = connect(p, a.split("."), b.split(".")).patch;
    expect(chain(p, "osc", "amp", "out")).toBe(true);
    const c = { patch: p, notes: 2, tried: () => new Set() };
    expect(E.steps.slice(0, 3).every((s) => s.done(c))).toBe(true);
  });

  test("every starting point reaches the speaker with all its modules; all but Wind are played from the keys", () => {
    for (const pr of PRESETS) {
      const p = pr.patch();
      const h = heard(p);
      expect(p.modules.every((m) => h.has(m.id)), pr.id).toBe(true);
      expect(keyed(p), pr.id).toBe(pr.id !== "wind");
    }
  });

  test("the voice and the pedals: audio in, audio out, shared by every voice; one Microphone to a board; the Add menu lists every module once, in three groups; only the Looper has buttons", () => {
    for (const t of ["drive", "reverb", "chorus", "trem", "wah", "pitch", "looper"]) {
      const d = MODULES[t];
      expect(d.ins.map((i) => i.kind), t).toEqual(["audio"]);
      expect(d.outs.map((o) => o.kind), t).toEqual(["audio"]);
      expect(d.global, t).toBe(true);
    }
    expect(MODULES.mic.ins).toEqual([]);
    expect(MODULES.mic.single).toBe(true);
    expect(MODULES.mic.params.on.def).toBe("off"); // never listening until it's switched on
    let p = empty();
    p = addModule(p, "mic").patch;
    expect(addModule(p, "mic").patch).toBe(p);
    p = addModule(p, "looper").patch;
    p = addModule(p, "drive").patch;
    p = connect(p, ["mic1", "out"], ["looper1", "in"]).patch;
    p = connect(p, ["looper1", "out"], ["drive1", "in"]).patch;
    p = connect(p, ["drive1", "out"], ["out", "in"]).patch;
    expect(chain(p, "mic", "looper", "drive", "out")).toBe(true);
    expect(canConnect(p, ["drive1", "out"], ["drive1", "in"])).toBe(false);
    expect([...heard(p)].sort()).toEqual(["drive1", "looper1", "mic1", "out"]);
    expect(GROUPS.flatMap((g) => g.types).sort()).toEqual([...ADDABLE].sort());
    expect(new Set(ADDABLE).size).toBe(ADDABLE.length);
    expect(GROUPS.map((g) => g.name)).toEqual(["The synthesizer", "The voice", "Pedals", "The floor"]);
    for (const t of GROUPS[2].types) expect(PEDALS.has(t), t).toBe(true);
    expect(actionsOf("looper").map((a) => a.id)).toEqual(["press", "undo", "clear", "clock"]);
    expect(ADDABLE.filter((t) => actionsOf(t).length)).toEqual(["looper"]);
    // Pedal orders, as the lesson reads them: the pedals the sound passes from the Looper to the Speaker.
    expect(pedalOrder(p)).toBe("drive");
    p = addModule(p, "reverb").patch;
    p = disconnect(p, p.cables.find((c) => c.from[0] === "drive1").id);
    p = connect(p, ["drive1", "out"], ["reverb1", "in"]).patch;
    p = connect(p, ["reverb1", "out"], ["out", "in"]).patch;
    expect(pedalOrder(p)).toBe("drive>reverb");
    expect(pedalOrder(empty())).toBe("");
  });

  test("places on the floor: written once by name, kept and read back, left out of a patch without any; the next sits to the right; the floor has no edges", () => {
    let p = build({ osc: [COL[1], 180], out: [COL[3], 180] }, [["osc.out", "out.in"]]);
    expect(serialize(p)).not.toContain("places"); // a patch without places reads exactly as it always did
    const first = nextPlace(p);
    expect(first).toEqual({ x: COL[0], y: ROW[0] - 12 }); // the first names the board as it is
    p = addPlace(p, "8 · Your voice is an instrument", first.x, first.y);
    expect(addPlace(p, "8 · Your voice is an instrument", 500, 500)).toBe(p);
    expect(placeOf(p, "pl1").name).toBe("8 · Your voice is an instrument");
    const second = nextPlace(p);
    expect(second.x).toBeGreaterThan(bounds(p).x + bounds(p).w);
    expect(second.y).toBe(first.y);
    p = addPlace(p, "9 · Pedals", second.x, second.y);
    const back = parse(serialize(p));
    expect(back).toEqual(p);
    expect(back.places.map((pl) => pl.name)).toEqual(["8 · Your voice is an instrument", "9 · Pedals"]);
    // What isn't a place is left out; a name is trimmed; at most forty.
    const odd = parse({ v: 1, modules: [], cables: [], places: [{ name: "  far  ", x: 99999999, y: -99999999 }, { name: "" }, 7, { id: "x", name: "ok", x: "1", y: "2" }] });
    expect(odd.places).toEqual([
      { id: "pl1", name: "far", x: 60000, y: -60000 },
      { id: "x", name: "ok", x: 1, y: 2 },
    ]);
    // A module can sit anywhere on the floor, well outside the lessons' area; a new one lands in the part of the floor in view.
    const far = addModule(p, "lfo", { x: 5000, y: -3000 }).patch;
    expect(far.modules.find((m) => m.type === "lfo")).toMatchObject({ x: 5000, y: -3000 });
    const b = bounds(far);
    expect(b.x).toBeLessThanOrEqual(COL[0]);
    expect(b.x + b.w).toBeGreaterThanOrEqual(5000 + 196);
    const spot = freeSpot(p, { x: 3000, y: 3000, w: 900, h: 600 });
    expect(spot.x).toBeGreaterThanOrEqual(3000);
    expect(spot.y).toBeGreaterThanOrEqual(3000);
    expect(BOARD).toEqual({ w: 1164, h: 660 });
  });

  test("the Looper's rules: press by press, undo by layer, a loop's length read as a tempo, and a layer placed where it began", () => {
    expect(MODES).toEqual(["idle", "armed", "recording", "playing", "overdub"]);
    // Free: press, press sets the length; then every press pair is a layer.
    let m = "idle";
    expect((m = afterPress(m))).toBe("recording");
    expect((m = afterPress(m))).toBe("playing");
    expect((m = afterPress(m))).toBe("overdub");
    expect((m = afterPress(m))).toBe("playing");
    // Whole bars: the first press waits for the bar; a press while waiting lets go; the recording ends by itself.
    expect(afterPress("idle", "2")).toBe("armed");
    expect(afterPress("armed", "2")).toBe("idle");
    expect(afterPress("recording", "2")).toBe("recording");
    expect(afterUndo("playing", 1)).toBe("playing");
    expect(afterUndo("overdub", 1)).toBe("playing");
    expect(afterUndo("playing", 0)).toBe("idle");
    expect(pressLabel("idle")).toBe("Record");
    expect(pressLabel("recording", "free")).toBe("Set the length");
    expect(pressLabel("recording", "1")).toBe("Recording");
    expect(pressLabel("armed")).toBe("Waiting for the bar");
    expect(pressLabel("playing")).toBe("Overdub");
    expect(pressLabel("overdub")).toBe("Done");
    // The clock from the loop: bars and a tempo in range, the nearest to the tempo now.
    expect(clockFromLoop(1.5)).toEqual({ tempo: 160, bars: 1 });
    expect(clockFromLoop(4.8, { near: 100 })).toEqual({ tempo: 100, bars: 2 });
    expect(clockFromLoop(4.8, { near: 50 })).toEqual({ tempo: 50, bars: 1 });
    expect(clockFromLoop(0.6)).toEqual({ tempo: 180, bars: 1 }); // too short for any bar: the fastest the loop goes
    expect(clockFromLoop(0)).toBe(null);
    // A layer begun 1.2 s into a 2 s loop starts 1.2 s in (less the output's latency), wrapping round.
    expect(layerOffset(11.2, 10, 2)).toBeCloseTo(1.2, 9);
    expect(layerOffset(13.7, 10, 2, 0.1)).toBeCloseTo(1.6, 9);
    const placed = placeLayer(new Float32Array([1, 2, 3]), 4, 3);
    expect([...placed]).toEqual([2, 3, 0, 1]);
    const summed = placeLayer(new Float32Array([1, 1, 1, 1, 1, 1]), 4, 0); // longer than the loop: it wraps and adds
    expect([...summed]).toEqual([2, 2, 1, 1]);
  });
  test("a note on the floor: words only, no jacks and no sound; the text is kept through serialize and parse, capped, and anything but a string reads as empty", () => {
    const d = MODULES.note;
    expect(d.note).toBe(true);
    expect(d.ins).toEqual([]);
    expect(d.outs).toEqual([]);
    expect(GROUPS.at(-1)).toEqual({ id: "floor", name: "The floor", types: ["note"] });
    expect(tidy(d.params.text, 42)).toBe("");
    expect(tidy(d.params.text, "x".repeat(3000))).toHaveLength(2000);
    const r = addModule(empty(), "note", { x: 40, y: 40 });
    expect(r.id).toBe("note1");
    const p = setParam(r.patch, r.id, "text", "Hook: the second chorus lifts\nand the bass drops out");
    expect(parse(serialize(p))).toEqual(p);
    expect(parse(serialize(p)).modules.find((m) => m.type === "note").p.text).toBe("Hook: the second chorus lifts\nand the bass drops out");
    expect(heard(p).has("note1")).toBe(false);
    expect(canConnect(p, ["note1", "out"], ["out", "in"])).toBeFalsy();
  });
});

test.describe("Signal's studio", () => {
  test("a note goes in a step; the same pitch where it runs is replaced, other pitches make a chord; a shorter loop hides notes and keeps them", () => {
    let pr = Pj.newProject({ patch: rolePatch("pulse") });
    const v = pr.front;
    pr = Pj.placeNote(pr, v, 0, 48, 4);
    pr = Pj.placeNote(pr, v, 0, 52, 4);
    pr = Pj.placeNote(pr, v, 2, 48, 1); // runs into the first C: replaces it
    expect(Pj.notesOf(pr, v)).toEqual([
      { s: 0, n: 52, l: 4 },
      { s: 2, n: 48, l: 1 },
    ]);
    expect(Pj.notesAt(pr, v, 3).map((n) => n.n)).toEqual([52]);
    pr = Pj.repitch(pr, v, 2, 48, 55);
    expect(Pj.notesAt(pr, v, 2).map((n) => n.n).sort()).toEqual([52, 55]);
    pr = Pj.placeNote(pr, v, 30, 60, 8); // runs past the end of two bars: cut to fit
    expect(Pj.notesOf(pr, v).at(-1)).toEqual({ s: 30, n: 60, l: 2 });
    const short = Pj.setBars(pr, 1);
    expect(Pj.notesOf(short, v).map((n) => n.s)).toEqual([0, 2]);
    expect(Pj.notesOf(Pj.setBars(short, 2), v).map((n) => n.s)).toEqual([0, 2, 30]);
    expect(Pj.removeNote(pr, v, 30, 60).sections[0].notes[v]).toHaveLength(2);
  });

  test("four voices at most, each its own part; sections copy the one in front and come after it; removing a voice takes its notes", () => {
    let pr = Pj.newProject({ patch: rolePatch("pulse") });
    for (let i = 0; i < 4; i++) pr = Pj.addVoice(pr, (r) => rolePatch(r)).project;
    expect(pr.voices.map((v) => v.name)).toEqual(["Pulse", "Floor", "Voice", "Hit"]);
    expect(pr.front).toBe(pr.voices[3].id);
    pr = Pj.placeNote(pr, pr.voices[1].id, 0, 48, 16);
    pr = Pj.addSection(pr);
    expect(pr.sections.map((s) => s.name)).toEqual(["A", "B"]);
    expect(pr.section).toBe(pr.sections[1].id);
    expect(Pj.notesOf(pr, pr.voices[1].id)).toHaveLength(1);
    pr = Pj.setSection(pr, pr.sections[0].id);
    pr = Pj.addSection(pr);
    expect(pr.sections.map((s) => s.name)).toEqual(["A", "C", "B"]);
    pr = Pj.setTimes(pr, pr.sections[0].id, 4);
    expect(Pj.songBars(pr)).toBe(4 * 2 + 2 + 2);
    const gone = Pj.removeVoice(pr, pr.voices[1].id);
    expect(gone.voices).toHaveLength(3);
    expect(gone.sections.every((s) => !(pr.voices[1].id in s.notes))).toBe(true);
    // Every part a voice can start as is played from the keys and reaches the speaker whole.
    for (const role of Object.keys(ROLE_PATCHES))
      for (const kind of ["full", "plain"]) {
        const p = rolePatch(role, kind);
        expect(keyed(p), `${role} ${kind}`).toBe(true);
        expect(p.modules.every((m) => heard(p).has(m.id)), `${role} ${kind}`).toBe(true);
      }
  });

  test("a kept project reads back the same; what isn't understood is left out; only the notes kept from the Ghost Producer are written", () => {
    let pr = Pj.newProject({ name: "Night drive", patch: rolePatch("pulse") });
    pr = Pj.addVoice(pr, (r) => rolePatch(r)).project;
    pr = Pj.placeNote(pr, pr.voices[0].id, 0, 36, 2);
    pr = Pj.addGhost(pr, [
      { about: "Pulse", move: "question", text: "Which one is the bass?", at: "2026-11-06T01:00:00.000Z", model: "Haiku", kept: false },
      { about: "loop", move: "structure", text: "Let one part enter late.", at: "2026-11-06T01:00:00.000Z", model: "Haiku", kept: false },
    ]);
    pr = Pj.keepGhost(pr, pr.ghost[1].id);
    const back = Pj.parseProject(Pj.serializeProject(pr));
    expect(back.ghost.map((g) => g.text)).toEqual(["Let one part enter late."]);
    expect({ ...back, ghost: [] }).toEqual({ ...pr, ghost: [] });
    const odd = Pj.parseProject({
      name: "x",
      tempo: 9000,
      bars: 3,
      voices: [{ id: "a", role: "theremin", patch: { modules: [{ id: "w", type: "wavetable" }] } }, { id: "a" }, "no"],
      sections: [{ id: "s", notes: { a: [{ s: 2, n: 40, l: 3 }, { s: "x" }, null], zz: [{ s: 0, n: 1, l: 1 }] } }],
    });
    expect(odd.tempo).toBe(Pj.TEMPO.max);
    expect(odd.bars).toBe(2);
    expect(odd.voices).toHaveLength(1);
    expect(odd.voices[0].patch.modules.map((m) => m.type)).toEqual(["out"]);
    expect(odd.sections[0].notes).toEqual({ a: [{ s: 2, n: 40, l: 3 }] });
    expect(Pj.parseProject("nope")).toBe(null);
    // The text form says what's there, and marks the kept notes as the AI's.
    const text = projectText(pr);
    expect(text).toContain("Voice “Pulse” (pulse):");
    expect(text).toContain("C2 at bar 1 step 1 for 2 steps");
    expect(text).toContain("[AI] Let one part enter late.");
  });

  test("the composing course: each lesson's first step isn't done when it starts, starts never take away the kid's work, and steps are ticked by the project", () => {
    let pr = newCourse();
    const ctx = (pr, extra = {}) => ({
      project: pr,
      voice: (r) => Pj.voiceByRole(pr, r),
      patch: (r) => Pj.voiceByRole(pr, r)?.patch || null,
      notes: (r) => (Pj.voiceByRole(pr, r) ? Pj.notesOf(pr, Pj.voiceByRole(pr, r).id) : []),
      loops: 0,
      song: 0,
      numbers: null,
      tried: () => new Set(),
      ...extra,
    });
    for (const l of COURSE) {
      const next = l.start(pr);
      expect(l.steps[0].done(ctx(next)), l.id).toBe(false);
      // Whatever was there is still there.
      for (const v of pr.voices) expect(Pj.voiceOf(next, v.id)?.patch, l.id).toBe(v.patch);
      pr = next;
    }
    expect(pr.voices.map((v) => v.role)).toEqual(["pulse", "floor", "voice", "hit"]);
    // The pulse: eight of one note, then one changed.
    const P = COURSE[0];
    let q = P.start(newCourse());
    for (let i = 0; i < 8; i++) q = Pj.placeNote(q, q.front, i * 2, 36, 1);
    expect(P.steps[0].done(ctx(q))).toBe(true);
    q = Pj.repitch(q, q.front, 6, 36, 39);
    expect(P.steps[1].done(ctx(q))).toBe(true);
    expect(P.steps[2].done(ctx(q, { loops: 2 }))).toBe(true);
    // Arrivals: four sections, each with one more part.
    const A = COURSE.find((l) => l.id === "arrivals");
    let r = pr;
    pr.voices.forEach((v, i) => (r = Pj.placeNote(r, v.id, i, 48, 1)));
    for (let i = 0; i < 3; i++) r = Pj.addSection(r);
    expect(A.steps[1].done(ctx(r))).toBe(false);
    r.sections.forEach((s, k) => r.voices.forEach((v, i) => i > k && (r = Pj.clearVoice(r, v.id, s.id))));
    expect(r.sections.map((s) => Pj.activeVoices(r, s.id).length)).toEqual([1, 2, 3, 4]);
    expect(A.steps[1].done(ctx(r))).toBe(true);
    // The mix is read from the numbers.
    const M = COURSE.find((l) => l.id === "mix");
    const nums = (c) => ({ section: "A", voices: pr.voices.map((v, i) => ({ id: v.id, name: v.name, silent: false, centroid: c[i] })), mix: { silent: false, peak: -3, clips: false } });
    expect(M.steps[1].done(ctx(pr, { numbers: nums([200, 900, 3000, 1500]) }))).toBe(true);
    expect(M.steps[1].done(ctx(pr, { numbers: nums([900, 200, 3000, 1500]) }))).toBe(false);
    expect(M.steps[2].done(ctx(pr, { numbers: nums([200, 900, 3000, 1500]) }))).toBe(true);
  });

  test("the master class: twelve sessions in four parts, every build a lesson that exists; the voice sessions arrive on one board, each writes its name once and takes nothing away; no artist is named anywhere", () => {
    expect(SESSIONS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(PARTS.map((p) => p.id)).toEqual(["sound", "time", "voice", "piece"]);
    for (const s of SESSIONS) {
      expect(PARTS.some((p) => p.id === s.part), s.title).toBe(true);
      for (const x of s.builds) expect(buildDef(x), `${s.n} ${x.id}`).not.toBe(null);
      expect(s.asks.length, s.title).toBeGreaterThanOrEqual(4);
      for (const q of s.asks) expect(echoesCard(q), q).toBe(false);
      expect(s.logic.length, s.title).toBeGreaterThan(40); // the bridge line, under the "In Logic Pro" heading
      if (!s.soon) expect(s.builds.length, s.title).toBeGreaterThan(0);
    }
    // Every lesson of the three courses is in exactly one session.
    const all = [...LESSONS.map((l) => ["patch", l.id]), ...COURSE.map((l) => ["compose", l.id]), ...VOICE_LESSONS.map((l) => ["voice", l.id])];
    for (const [kind, id] of all) expect(SESSIONS.filter((s) => s.builds.some((x) => x.kind === kind && x.id === id)).length, `${kind} ${id}`).toBe(1);
    expect(sessionOfLesson("voice", "mic").n).toBe(8);
    expect(sessionDone(SESSIONS[0], ["signal", "shape", "keys"])).toBe(true);
    expect(sessionDone(SESSIONS[0], ["signal", "shape"])).toBe(false);
    expect(sessionDone(SESSIONS[10], [])).toBe(false);
    // The voice sessions, one after the other on the same board.
    const rig = newVoiceRig();
    expect(rig.name).toBe("Your voice");
    expect(rig.voices[0].patch.modules.map((m) => m.type)).toEqual(["out"]);
    let p = rig.voices[0].patch;
    const ctx = (patch, extra = {}) => ({ patch, notes: 0, tried: () => new Set(), state: () => null, layers: 0, undos: 0, orders: new Set(), ...extra });
    for (const L of VOICE_LESSONS) {
      const before = p;
      p = L.start(p);
      expect(L.steps[0].done(ctx(p)), L.id).toBe(false);
      for (const m of before.modules) expect(p.modules.find((x) => x.id === m.id), `${L.id} keeps ${m.id}`).toEqual(m);
      for (const c of before.cables) expect(p.cables).toContainEqual(c);
      expect(L.start(p), `${L.id} again`).toEqual(p); // starting it again adds nothing
    }
    expect(p.places.map((pl) => pl.name)).toEqual(["8 · Your voice is an instrument", "9 · Pedals", "10 · Pitch"]);
    expect(p.places[1].x).toBeGreaterThan(p.places[0].x);
    expect(p.places[2].x).toBeGreaterThan(p.places[1].x);
    expect(p.modules.map((m) => m.type).sort()).toEqual(["drive", "mic", "out", "pitch"]);
    expect(parse(serialize(p))).toEqual(p);
    // Session 8, the way a person would: the mic live, wired, a Looper between, layers on and off.
    const M = VOICE_LESSONS[0];
    let q = M.start(rig.voices[0].patch);
    expect(M.steps[0].done(ctx(q, { state: (t) => (t === "mic" ? { status: "live" } : null) }))).toBe(true);
    q = connect(q, ["mic1", "out"], ["out", "in"]).patch;
    expect(M.steps[1].done(ctx(q))).toBe(true);
    q = addModule(q, "looper").patch;
    q = disconnect(q, q.cables[0].id);
    q = connect(q, ["mic1", "out"], ["looper1", "in"]).patch;
    q = connect(q, ["looper1", "out"], ["out", "in"]).patch;
    expect(M.steps[2].done(ctx(q))).toBe(true);
    const st = (layers) => (t) => (t === "looper" ? { mode: "playing", layers, length: 2 } : null);
    expect(M.steps[3].done(ctx(q, { state: st(0) }))).toBe(false);
    expect(M.steps[3].done(ctx(q, { state: st(1) }))).toBe(true);
    expect(M.steps[4].done(ctx(q, { state: st(2) }))).toBe(true);
    expect(M.steps[5].done(ctx(q, { state: st(2), undos: 0 }))).toBe(false);
    expect(M.steps[5].done(ctx(q, { state: st(2), undos: 1 }))).toBe(true);
    // Session 9's last step hears two orders of the same pedals.
    const P9 = VOICE_LESSONS[1];
    expect(P9.steps[4].done(ctx(q, { orders: new Set(["drive>reverb"]) }))).toBe(false);
    expect(P9.steps[4].done(ctx(q, { orders: new Set(["drive>reverb", "reverb>drive"]) }))).toBe(true);
    // Session 10 wants the Pitch before the Looper, so each layer is printed at its own pitch.
    const P10 = VOICE_LESSONS[2];
    let r = P10.start(q);
    expect(P10.steps[0].done(ctx(r))).toBe(false);
    r = disconnect(r, r.cables.find((c) => c.to[0] === "looper1").id);
    r = connect(r, ["mic1", "out"], ["pitch1", "in"]).patch;
    r = connect(r, ["pitch1", "out"], ["looper1", "in"]).patch;
    expect(P10.steps[0].done(ctx(r))).toBe(true);
    expect(P10.steps[1].done(ctx(r, { layers: 1 }))).toBe(true); // Shift starts at −12
    expect(P10.steps[2].done(ctx(r, { layers: 1 }))).toBe(false);
    expect(P10.steps[2].done(ctx(setParam(r, "pitch1", "semis", 7), { layers: 1 }))).toBe(true);
    // The words: no artist, no published card, anywhere a kid reads.
    const words = JSON.stringify([SESSIONS, PARTS, VOICE_LESSONS.map((l) => [l.title, l.line, l.steps.map((s) => [s.do, s.why])]), STANCE, systemFor(SESSIONS[8]), MODULES]);
    expect(words).not.toMatch(/\b(rubin|watts|eno|jarre|oblique)\b/i);
    expect(echoesCard(STANCE)).toBe(false);
    for (const s of SESSIONS) expect(echoesCard(systemFor(s)), s.title).toBe(false);
    // The producer's prompt knows the session it is in, and the craft of the voice only there (or when a Looper is on the board).
    expect(systemFor(SESSIONS[8])).toContain('session 9 of a master class, "Pedals"');
    expect(systemFor(SESSIONS[8])).toContain("pedals read in order");
    expect(systemFor(SESSIONS[3])).not.toContain("pedals read in order");
    expect(systemFor(SESSIONS[3], { looping: true })).toContain("pedals read in order");
    expect(systemFor(null)).toBe(SYSTEM);
    expect(SYSTEM).toContain(STANCE);
    expect(SYSTEM).toContain('"verdict"');
    expect(ASKS.map((a) => a.id)).toEqual(["muddy", "first", "constraint", "going", "done"]);
    expect(userFor(Pj.newProject({}), null, "Is it done?", SESSIONS[7])).toContain('They are in session 8, "Your voice is an instrument".');
    expect(parseNotes(JSON.stringify([{ about: "loop", move: "verdict", text: "Stopped. The last layer ends before the loop does." }]), Pj.newProject({}))).toEqual([{ about: "loop", move: "verdict", text: "Stopped. The last layer ends before the loop does." }]);
  });

  test("the Ghost Producer: its own deck and its prompt keep clear of the published cards and the record; notes that name an artist, echo a card or only praise are dropped", () => {
    for (const c of DECK) expect(echoesCard(c.card), c.card).toBe(false);
    for (const a of ASKS) expect(echoesCard(a.ask(DECK[0])), a.id).toBe(false);
    expect(SYSTEM).toContain("Never name any artist, band, album or song");
    expect(SYSTEM).toContain("Never quote or paraphrase published aphorisms or creative-prompt cards.");
    expect(SYSTEM).toContain("you cannot hear it");
    expect(SYSTEM).not.toMatch(/jarre|oxyg/i);
    let pr = Pj.newProject({ patch: rolePatch("pulse") });
    pr = Pj.addVoice(pr, (r) => rolePatch(r)).project;
    const reply = `Here you go: ${JSON.stringify([
      { about: "floor", move: "question", text: "The Pulse and the Floor both sit between 200 and 400 Hz. Which one is the bass?" },
      { about: "bar 99", move: "structure", text: "Everything arrives in bar 1. Pick one part to enter at bar 2." },
      { about: "loop", move: "example", text: "Make it sound like Jarre's Oxygène." },
      { about: "loop", move: "counter", text: "Repetition is a form of change." },
      { about: "loop", move: "question", text: "Great job!" },
    ])}`;
    expect(parseNotes(reply, pr)).toEqual([
      { about: "Floor", move: "question", text: "The Pulse and the Floor both sit between 200 and 400 Hz. Which one is the bass?" },
      { about: "bar 2", move: "structure", text: "Everything arrives in bar 1. Pick one part to enter at bar 2." },
    ]);
    // Plain lines, if that's what comes back, are still notes about the whole loop.
    expect(parseNotes("- **What** carries the rhythm?\n- #tag Try a rest in bar 2.", pr)).toEqual([
      { about: "loop", move: "", text: "What carries the rhythm?" },
      { about: "loop", move: "", text: "tag Try a rest in bar 2." },
    ]);
    // JSON that doesn't parse is read note by note, and never shown raw: a quote inside a note
    // doesn't cut it short, and a note cut off at the end is left out.
    const broken = '```json\n[{"about":"Pulse","move":"question","text":"If you raised the cutoff, what would the "pulse" lose?"},\n{"about":"loop","move":"example","text":"Try the filter at 1.2 kHz and pl';
    const read = parseNotes(broken, pr);
    expect(read).toEqual([{ about: "Pulse", move: "question", text: 'If you raised the cutoff, what would the "pulse" lose?' }]);
    for (const n of parseNotes('[{"about": "loop", "text": "Half', pr)) expect(n.text).not.toMatch(/[{}]|"\w+"\s*:/);
    expect(SYSTEM).toContain("never double quotes");
  });

  test("the producer's hands: the modules and the hands' rules go in the prompt only for the kid's own words; a reply with steps is read step by step, twelve at most; a name the kid said may be said back and any other is dropped", () => {
    const hands = systemFor(null, { hands: true });
    expect(hands).toContain("Hands.");
    for (const t of ADDABLE.filter((x) => x !== "note")) expect(hands).toContain(`- ${t}: ${MODULES[t].name}.`);
    expect(hands).not.toContain("- note:");
    expect(hands).toContain("Keep the Keyboard and the Speaker, and leave every Note alone.");
    expect(hands).toContain("cutoff 40..16000 =2000 (reads 40.0 Hz to 16 kHz)");
    expect(systemFor(null)).not.toContain("Hands.");
    expect(echoesCard(hands)).toBe(false);
    const pr = Pj.newProject({ patch: rolePatch("pulse") });
    const r = parseReply(
      `Here: {"say":"Two saws, a filter.","steps":[{"do":"add","type":"osc","as":"pad","why":"Body."},{"do":"set","module":"pad","param":"fine","value":7,"why":"Width."},{"do":"set","module":"pad","param":"wave","value":"sawtooth","why":"Edge."},{"do":"connect","from":"pad.out","to":"out.in","why":"Heard."},{"do":"disconnect","from":"osc1.out","to":"out.in","why":"Make room."},{"do":"remove","module":"noise1","why":"Great job!"},{"do":"fly","why":"no"},{"do":"connect","from":"pad","to":"out.in"}],"notes":[{"about":"loop","move":"question","text":"Which one leads?"}]}`,
      pr,
      "a warm pad",
    );
    expect(r.say).toBe("Two saws, a filter.");
    expect(r.steps).toEqual([
      { do: "add", type: "osc", as: "pad", why: "Body." },
      { do: "set", module: "pad", param: "fine", value: 7, why: "Width." },
      { do: "set", module: "pad", param: "wave", value: "sawtooth", why: "Edge." },
      { do: "connect", from: ["pad", "out"], to: ["out", "in"], why: "Heard." },
      { do: "disconnect", from: ["osc1", "out"], to: ["out", "in"], why: "Make room." },
      { do: "remove", module: "noise1", why: "" },
    ]);
    expect(r.notes).toEqual([{ about: "loop", move: "question", text: "Which one leads?" }]);
    // Only notes, or plain words: no steps.
    expect(parseReply('[{"about":"loop","move":"question","text":"Why so loud?"}]', pr)).toEqual({ say: "", steps: [], offer: [], notes: [{ about: "loop", move: "question", text: "Why so loud?" }] });
    expect(parseReply("Take the noise out first.", pr)).toEqual({ say: "", steps: [], offer: [], notes: [{ about: "loop", move: "", text: "Take the noise out first." }] });
    expect(parseReply(JSON.stringify({ say: "ok", steps: Array.from({ length: 20 }, () => ({ do: "remove", module: "x", why: "y" })) }), pr).steps).toHaveLength(12);
    expect(parseReply('{"say":"Kraftwerk used square waves.","steps":[]}', pr, "a sound like Kraftwerk").say).toBe("Kraftwerk used square waves.");
    expect(parseReply('{"say":"Kraftwerk used square waves.","steps":[]}', pr, "an eighties sound").say).toBe("");
    // An offer: the same moves, kept apart from the steps; with steps present, the offer is dropped.
    const offered = parseReply('{"say":"Try a slower filter.","offer":[{"do":"set","module":"filter","param":"cutoff","value":600,"why":"Slower."}]}', pr);
    expect(offered.steps).toEqual([]);
    expect(offered.offer).toEqual([{ do: "set", module: "filter", param: "cutoff", value: 600, why: "Slower." }]);
    expect(parseReply('{"say":"x","steps":[{"do":"remove","module":"filter"}],"offer":[{"do":"remove","module":"amp"}]}', pr).offer).toEqual([]);
    expect(parseReply("[]", pr).offer).toEqual([]);
    // "Show me": a step that points and changes nothing.
    expect(parseReply('{"say":"","steps":[{"do":"show","module":"filter1","param":"cutoff","why":"This is the knob."},{"do":"show","module":"osc1","why":"And this."}]}', pr).steps).toEqual([
      { do: "show", module: "filter1", param: "cutoff", why: "This is the knob." },
      { do: "show", module: "osc1", why: "And this." },
    ]);
    // The conversation so far goes with the question, the kid's lines as theirs and the producer's as its own.
    const u = userFor(pr, null, "and the floor?", null, [
      { who: "you", text: "What's muddy?" },
      { who: "producer", text: "The pulse and the floor\nshare a range." },
    ]);
    expect(u).toContain("The conversation so far:\nThey: What's muddy?\nYou: The pulse and the floor share a range.\n\nTheir question: and the floor?");
    expect(userFor(pr, null, "q")).not.toContain("The conversation so far");
  });
});
