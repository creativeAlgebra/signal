// The Looper's rules, with no sound in them: which state a press leads to, how a loop's length
// becomes a tempo, and where a layer recorded mid-loop lands. The engine (audio.js) does the
// recording and the playing; this is what it follows, and what the spec can check on its own.
//
// States: "idle" (nothing recorded), "armed" (waiting for the bar line, synced only), "recording"
// (the first loop, its length not yet set), "playing", "overdub" (recording a layer over the loop).

export const MODES = ["idle", "armed", "recording", "playing", "overdub"];

// The state after one press of the pedal. `sync` is the Length knob: "free", or bars as a string.
export function afterPress(mode, sync = "free") {
  switch (mode) {
    case "idle":
      return sync === "free" ? "recording" : "armed";
    case "armed":
      return "idle"; // a second press before the bar line changes its mind
    case "recording":
      return sync === "free" ? "playing" : "recording"; // a synced loop ends by itself, on the bar
    case "playing":
      return "overdub";
    case "overdub":
      return "playing";
  }
  return "idle";
}
// After the last layer is taken off: a loop with no layers is no loop.
export const afterUndo = (mode, layersLeft) => (layersLeft > 0 ? (mode === "overdub" ? "playing" : mode) : "idle");

// A free loop sets the clock: the bars (1, 2 or 4) and the tempo (50 to 180) that make the loop
// a whole number of bars, the choice nearest a walking tempo. One bar is four beats.
export function clockFromLoop(seconds, { min = 50, max = 180, near = 110 } = {}) {
  if (!(seconds > 0.2)) return null;
  let best = null;
  for (const bars of [1, 2, 4]) {
    const tempo = (240 * bars) / seconds;
    if (tempo < min || tempo > max) continue;
    if (!best || Math.abs(tempo - near) < Math.abs(best.tempo - near)) best = { bars, tempo: Math.round(tempo) };
  }
  if (best) return best;
  // Nothing fits exactly: the nearest edge, so there is always a clock.
  const tempo = Math.min(max, Math.max(min, 240 / seconds));
  return { bars: 1, tempo: Math.round(tempo) };
}

// Where a layer recorded from `at` lands in a loop that began at `start` and is `length` long:
// the offset into the loop, in seconds, after taking back the `latency` the layer arrived with.
export const layerOffset = (at, start, length, latency = 0) => {
  if (!(length > 0)) return 0;
  const o = (at - latency - start) % length;
  return o < 0 ? o + length : o;
};

// A layer's samples put into a loop-length buffer at its offset, wrapping round (a layer longer than
// the loop adds onto itself, as it does on a pedal). Pure arithmetic on Float32Arrays.
export function placeLayer(samples, loopFrames, offsetFrames) {
  const out = new Float32Array(loopFrames);
  if (!loopFrames) return out;
  let j = ((offsetFrames % loopFrames) + loopFrames) % loopFrames;
  for (let i = 0; i < samples.length; i++) {
    out[j] += samples[i];
    if (++j === loopFrames) j = 0;
  }
  return out;
}

// What the Record button should say in each state.
export const pressLabel = (mode, sync = "free") => ({ idle: "Record", armed: "Waiting for the bar", recording: sync === "free" ? "Set the length" : "Recording", playing: "Overdub", overdub: "Done" })[mode] || "Record";
