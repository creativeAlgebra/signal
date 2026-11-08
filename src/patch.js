// A patch: the modules on the board and the cables between them. Plain data, so it can be kept,
// copied and undone: { v: 1, modules: [{ id, type, x, y, p: { knob: value } }], cables: [{ id, from: [module, jack], to: [module, jack] }],
// places: [{ id, name, x, y }] }. A place is a name written on the floor where a session of the
// master class arrived; the board has no edges, so places and modules sit anywhere.
// Every change makes a new patch; nothing here touches sound or the page.
import { MODULES, defOf, portOf, fits, defaults, tidy } from "./modules.js";

export const VERSION = 1;
export const BOARD = { w: 1164, h: 660 }; // the area a lesson's starting patch is laid out in (the board itself has no edges)
// The loose grid modules sit on: five columns, two rows (a card is 196 wide, about 300 tall).
export const COL = [28, 256, 484, 712, 940];
export const ROW = [24, 330];
export const CARD = 196;
export const CARD_H = 300;
const FAR = 60000; // the floor's limit either way: far beyond anything a hand would drag to
export const empty = () => ({ v: VERSION, modules: [{ id: "out", type: "out", x: COL[4], y: ROW[0], p: defaults("out") }], cables: [], places: [] });

const nextId = (list, prefix) => {
  let n = 1;
  const used = new Set(list.map((x) => x.id));
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};
export const moduleOf = (patch, id) => patch.modules.find((m) => m.id === id) || null;
export const ofType = (patch, type) => patch.modules.filter((m) => m.type === type);

export function addModule(patch, type, at = null, params = null) {
  const d = defOf(type);
  if (!d) return { patch, id: null };
  if (d.single && ofType(patch, type).length) return { patch, id: ofType(patch, type)[0].id };
  const id = type === "out" ? "out" : nextId(patch.modules, type);
  const spot = at || freeSpot(patch);
  const m = { id, type, x: clampX(spot.x), y: clampY(spot.y), p: { ...defaults(type), ...(params || {}) } };
  return { patch: { ...patch, modules: [...patch.modules, m] }, id };
}
export function removeModule(patch, id) {
  const m = moduleOf(patch, id);
  if (!m || defOf(m.type)?.fixed) return patch;
  return { ...patch, modules: patch.modules.filter((x) => x.id !== id), cables: patch.cables.filter((c) => c.from[0] !== id && c.to[0] !== id) };
}
export function moveModule(patch, id, x, y) {
  return { ...patch, modules: patch.modules.map((m) => (m.id === id ? { ...m, x: clampX(x), y: clampY(y) } : m)) };
}
export function setParam(patch, id, key, value) {
  const m = moduleOf(patch, id);
  const d = m && defOf(m.type)?.params[key];
  if (!d) return patch;
  const v = tidy(d, value);
  if (m.p[key] === v) return patch;
  return { ...patch, modules: patch.modules.map((x) => (x.id === id ? { ...x, p: { ...x.p, [key]: v } } : x)) };
}
const clampX = (x) => Math.round(Math.min(FAR, Math.max(-FAR, Number(x) || 0)));
const clampY = clampX;
const taken = (patch, x, y) => patch.modules.some((m) => Math.abs(m.x - x) < CARD - 20 && Math.abs(m.y - y) < 200);
// Where a new module goes: the first free spot on the lessons' loose grid (continued across the whole
// floor) inside the part of the floor in view ({ x, y, w, h } in the board's units), else the grid the
// lessons use, else to the right of everything.
export function freeSpot(patch, view = null) {
  if (view && view.w > CARD && view.h > 120) {
    const sx = COL[1] - COL[0],
      sy = ROW[1] - ROW[0];
    const x0 = COL[0] + Math.ceil((view.x - COL[0]) / sx) * sx, // the first grid column at or right of the view's left edge
      y0 = ROW[0] + Math.ceil((view.y - ROW[0]) / sy) * sy;
    for (let y = y0; y + CARD_H * 0.6 < view.y + view.h; y += sy) for (let x = x0; x + CARD <= view.x + view.w; x += sx) if (!taken(patch, x, y)) return { x, y };
  }
  for (const y of ROW) for (const x of COL) if (!taken(patch, x, y)) return { x, y };
  const b = bounds(patch);
  return { x: b.x + b.w + 60, y: b.y };
}
// The box around everything on the floor (modules and places), in the board's units; the lessons' area when it is empty.
export function bounds(patch) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const m of patch.modules) ((x0 = Math.min(x0, m.x)), (y0 = Math.min(y0, m.y)), (x1 = Math.max(x1, m.x + CARD)), (y1 = Math.max(y1, m.y + CARD_H)));
  for (const pl of patch.places || []) ((x0 = Math.min(x0, pl.x)), (y0 = Math.min(y0, pl.y - 24)), (x1 = Math.max(x1, pl.x + 260)), (y1 = Math.max(y1, pl.y)));
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: BOARD.w, h: BOARD.h };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
// A name on the floor. A session of the master class writes one where it arrives; the same name is written once.
export function addPlace(patch, name, x, y, id = null) {
  const places = patch.places || [];
  if (places.some((pl) => pl.name === name)) return patch;
  return { ...patch, places: [...places, { id: id || nextId(places, "pl"), name: String(name).slice(0, 60), x: clampX(x), y: clampY(y) }] };
}
export const placeOf = (patch, id) => (patch.places || []).find((pl) => pl.id === id || pl.name === id) || null;
// Where the next session's place goes: the first names the board as it is (12 above its top-left card);
// each one after sits to the right of everything, on the same line as the last name, with its cards beneath it.
export const PLACE_GAP = 120;
export const nextPlace = (patch) => {
  const places = patch.places || [];
  if (!places.length) return { x: Math.min(COL[0], ...patch.modules.map((m) => m.x)), y: Math.min(ROW[0], ...patch.modules.map((m) => m.y)) - 12 };
  const b = bounds(patch);
  return { x: b.x + b.w + PLACE_GAP, y: places[places.length - 1].y };
};

// Can this output go to this input? The kinds must fit, a module doesn't feed itself, and the same cable isn't made twice.
export function canConnect(patch, from, to) {
  const a = moduleOf(patch, from[0]),
    b = moduleOf(patch, to[0]);
  if (!a || !b || a.id === b.id) return false;
  const o = portOf(a.type, "out", from[1]),
    i = portOf(b.type, "in", to[1]);
  if (!o || !i || !fits(o.kind, i.kind)) return false;
  return !patch.cables.some((c) => same(c.from, from) && same(c.to, to));
}
const same = (x, y) => x[0] === y[0] && x[1] === y[1];
export function connect(patch, from, to) {
  if (!canConnect(patch, from, to)) return { patch, id: null };
  // A pitch or gate input takes one cable: the new one replaces the old.
  const kind = portOf(moduleOf(patch, to[0]).type, "in", to[1]).kind;
  const cables = kind === "pitch" || kind === "gate" ? patch.cables.filter((c) => !same(c.to, to)) : patch.cables;
  const id = nextId(patch.cables, "c");
  return { patch: { ...patch, cables: [...cables, { id, from: [...from], to: [...to] }] }, id };
}
export const disconnect = (patch, id) => ({ ...patch, cables: patch.cables.filter((c) => c.id !== id) });
export const cablesInto = (patch, id, jack) => patch.cables.filter((c) => c.to[0] === id && (jack == null || c.to[1] === jack));
export const cablesFrom = (patch, id, jack) => patch.cables.filter((c) => c.from[0] === id && (jack == null || c.from[1] === jack));
export const kindOf = (patch, cable) => {
  const m = moduleOf(patch, cable.from[0]);
  return (m && portOf(m.type, "out", cable.from[1])?.kind) || "audio";
};

// Is the keyboard plugged into anything? Without it, the patch plays on its own, all the time.
export const keyed = (patch) => patch.modules.some((m) => m.type === "keys" && cablesFrom(patch, m.id).length > 0);
// The modules whose signal reaches the speaker, along audio cables and into mod inputs.
export function heard(patch) {
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const c of cablesInto(patch, id)) walk(c.from[0]);
  };
  if (moduleOf(patch, "out")) walk("out");
  return seen;
}

// Kept and read back. Anything not understood (an unknown module or jack, a knob out of range) is
// left out of what plays, never a reason to lose the rest; the speaker is always there.
export function parse(raw) {
  let d = raw;
  if (typeof raw === "string") {
    try {
      d = JSON.parse(raw);
    } catch {
      return empty();
    }
  }
  if (!d || typeof d !== "object" || !Array.isArray(d.modules)) return empty();
  const modules = [];
  const places = [];
  for (const pl of Array.isArray(d.places) ? d.places.slice(0, 40) : [])
    if (pl && typeof pl === "object" && typeof pl.name === "string" && pl.name.trim()) places.push({ id: typeof pl.id === "string" ? pl.id : `pl${places.length + 1}`, name: pl.name.trim().slice(0, 60), x: clampX(pl.x), y: clampY(pl.y) });
  for (const m of d.modules) {
    if (!m || typeof m !== "object" || !MODULES[m.type] || typeof m.id !== "string" || modules.some((x) => x.id === m.id)) continue;
    if (MODULES[m.type].single && modules.some((x) => x.type === m.type)) continue;
    const p = defaults(m.type);
    for (const [k, def] of Object.entries(defOf(m.type).params)) if (m.p && k in m.p) p[k] = tidy(def, m.p[k]);
    modules.push({ id: m.type === "out" ? "out" : m.id, type: m.type, x: clampX(Number(m.x) || 0), y: clampY(Number(m.y) || 0), p });
  }
  let patch = { v: VERSION, modules, cables: [], places };
  if (!moduleOf(patch, "out")) patch = { ...patch, modules: [...modules, empty().modules[0]] };
  for (const c of Array.isArray(d.cables) ? d.cables : []) if (c && Array.isArray(c.from) && Array.isArray(c.to)) patch = connect(patch, c.from.map(String), c.to.map(String)).patch;
  return patch;
}
// Places are written only when there are any, so a patch without them reads exactly as it always did.
export const serialize = (patch) => JSON.stringify({ v: VERSION, modules: patch.modules, cables: patch.cables, ...(patch.places?.length ? { places: patch.places } : {}) });

// Builds a patch from a short description, for the lessons and the starting points:
// build({ osc: [x, y, { wave: "sawtooth" }], out: [x, y] }, [["osc.out", "out.in"]]).
export function build(mods, wires = []) {
  let patch = { v: VERSION, modules: [], cables: [], places: [] };
  for (const [id, [x, y, p]] of Object.entries(mods)) {
    const type = id.replace(/\d+$/, "");
    patch.modules.push({ id, type, x, y, p: { ...defaults(type), ...(p || {}) } });
  }
  if (!moduleOf(patch, "out")) patch.modules.push(empty().modules[0]);
  for (const [a, b] of wires) patch = connect(patch, a.split("."), b.split(".")).patch;
  return patch;
}

// Questions the lessons ask of a patch.
// Is there a cable from a module of this type's jack to a module of that type's jack? ("osc.out", "out.in")
export function wired(patch, from, to, pick = () => true) {
  const [ft, fj] = from.split("."),
    [tt, tj] = to.split(".");
  return patch.cables.some((c) => {
    const a = moduleOf(patch, c.from[0]),
      b = moduleOf(patch, c.to[0]);
    return a && b && a.type === ft && c.from[1] === fj && b.type === tt && c.to[1] === tj && pick(a, b);
  });
}
// Does audio run through modules of these types, in this order, with nothing else between? ("osc", "filter", "amp", "out")
export function chain(patch, ...types) {
  const reach = (fromIds, k) => {
    if (k === types.length) return true;
    const next = new Set();
    for (const id of fromIds)
      for (const c of cablesFrom(patch, id)) {
        const b = moduleOf(patch, c.to[0]);
        const i = b && portOf(b.type, "in", c.to[1]);
        if (b && b.type === types[k] && i && i.kind === "audio") next.add(b.id);
      }
    return next.size > 0 && reach(next, k + 1);
  };
  return reach(new Set(ofType(patch, types[0]).map((m) => m.id)), 1);
}
