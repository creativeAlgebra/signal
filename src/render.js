// The studio made into sound without the speakers: an OfflineAudioContext plays the same patches
// and the same notes as the live loop, as fast as it can. Two uses: a .wav of the whole track, and
// the few numbers the Ghost Producer is given (it never hears the sound itself).
import { createEngine } from "./audio.js";
import { sectionOf, notesOf, totalSteps, stepSeconds, STEPS } from "./project.js";

const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;

// Which sections play, in order: "song" is all of them, each its number of times; otherwise one section once.
function plan(pr, what) {
  if (what === "song") return pr.sections.flatMap((s) => Array.from({ length: s.times }, () => s.id));
  return [sectionOf(pr, what === "loop" ? pr.section : what).id];
}

// Render: { what: "song" | "loop" | sectionId, voices: [ids] (all if left out), rate, channels, tail (s), compress }.
export async function render(pr, { what = "song", voices = null, rate = 44100, channels = 2, tail = 3, compress = true } = {}) {
  const C = OAC();
  if (!C) throw new Error("This browser can't render sound offline.");
  const order = plan(pr, what);
  const st = stepSeconds(pr);
  const loopLen = totalSteps(pr) * st;
  const seconds = order.length * loopLen + tail;
  const ac = new C(channels, Math.ceil(seconds * rate), rate);
  let bus = ac.destination;
  if (compress) {
    // The same last stage as the live sound.
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const g = ac.createGain();
    g.gain.value = 0.9;
    g.connect(comp).connect(ac.destination);
    bus = g;
  }
  for (const v of pr.voices) {
    if (voices && !voices.includes(v.id)) continue;
    const e = createEngine({ context: ac, out: bus, offline: true });
    e.load(v.patch);
    order.forEach((sid, k) => {
      for (const n of notesOf(pr, v.id, sid)) e.trigger(n.n, k * loopLen + n.s * st, n.l * st - 0.004);
    });
  }
  return ac.startRendering();
}

// A 16-bit .wav, as a Blob.
export function wav(buffer) {
  const ch = buffer.numberOfChannels,
    n = buffer.length,
    rate = buffer.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  data.setUint32(4, 36 + n * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, "data");
  data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buffer.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  return new Blob([data], { type: "audio/wav" });
}

// ---------- the numbers ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len,
      wr = Math.cos(a),
      wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k],
          ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci,
          vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}
// The average power at each frequency over the whole sound.
function spectrum(x, rate, N = 2048) {
  const P = new Float64Array(N / 2),
    re = new Float64Array(N),
    im = new Float64Array(N);
  const win = Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  let frames = 0;
  for (let o = 0; o + N <= x.length; o += N) {
    for (let i = 0; i < N; i++) ((re[i] = x[o + i] * win[i]), (im[i] = 0));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k];
    frames++;
  }
  return { P, hz: rate / N, frames };
}
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const round = (v, to = 10) => Math.round(v / to) * to;
// Brightness (the spectral centroid), where most of the energy lies (the middle 60% of it), and how loud.
function describe(x, rate) {
  const { P, hz } = spectrum(x, rate);
  let total = 0,
    weighted = 0;
  for (let k = 1; k < P.length; k++) ((total += P[k]), (weighted += P[k] * k * hz));
  let rms = 0,
    peak = 0;
  for (let i = 0; i < x.length; i++) ((rms += x[i] * x[i]), (peak = Math.max(peak, Math.abs(x[i]))));
  rms = Math.sqrt(rms / Math.max(1, x.length));
  if (total <= 0 || rms < 1e-5) return { silent: true };
  let acc = 0,
    lo = 0,
    hi = 0;
  for (let k = 1; k < P.length; k++) {
    acc += P[k];
    if (!lo && acc >= total * 0.2) lo = k * hz;
    if (!hi && acc >= total * 0.8) hi = k * hz;
  }
  return { silent: false, centroid: round(weighted / total), low: round(lo), high: round(hi), rms: db(rms), peak: db(peak) };
}
// The numbers for the section in front: each voice alone, then all of them together.
export async function measure(pr) {
  const rate = 22050;
  const out = { section: sectionOf(pr).name, voices: [], mix: null };
  const steps = totalSteps(pr);
  for (const v of pr.voices) {
    const notes = notesOf(pr, v.id);
    const covered = new Set();
    for (const n of notes) for (let s = n.s; s < Math.min(steps, n.s + n.l); s++) covered.add(s);
    const buf = await render(pr, { what: "loop", voices: [v.id], rate, channels: 1, tail: 0.5, compress: false });
    out.voices.push({ id: v.id, name: v.name, notes: notes.length, fill: Math.round((covered.size / steps) * 100), ...describe(buf.getChannelData(0), rate) });
  }
  const mix = await render(pr, { what: "loop", rate, channels: 1, tail: 0.5, compress: false });
  const x = mix.getChannelData(0);
  const d = describe(x, rate);
  // Loudest and quietest bar.
  const per = Math.round(STEPS * stepSeconds(pr) * rate);
  const bars = [];
  for (let b = 0; b < pr.bars; b++) {
    let s = 0;
    for (let i = b * per; i < Math.min(x.length, (b + 1) * per); i++) s += x[i] * x[i];
    bars.push(db(Math.sqrt(s / per)));
  }
  const loud = bars.indexOf(Math.max(...bars)),
    quiet = bars.indexOf(Math.min(...bars));
  out.mix = { ...d, clips: !d.silent && d.peak > -0.1, loudest: loud + 1, quietest: quiet + 1, bars: bars.map((v) => (Number.isFinite(v) ? Math.round(v) : null)) };
  return out;
}
