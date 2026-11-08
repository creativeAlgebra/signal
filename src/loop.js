// The loop's clock: it reads the project as it is at each step and hands the notes to each voice's
// engine a little ahead of time, on the AudioContext's own clock (a timer only wakes it up; the
// sound never waits on the timer). Two ways to play: "loop" goes round the section in front until
// stopped (a different section chosen meanwhile starts at the next turn), "song" plays every
// section in order, each its number of times, and stops at the end.
import { sectionOf, notesOf, totalSteps, stepSeconds } from "./project.js";

const AHEAD = 0.12; // seconds scheduled in advance
const WAKE = 25; // ms between looks

// clock(): the AudioContext. project(): the project now. engineOf(voiceId): that voice's engine.
// on: { step(sectionId, step), turn(), end() } called as things happen (on time, roughly).
export function createSequencer({ clock, project, engineOf, on = {} }) {
  let timer = 0,
    playing = null; // { mode, section, order, index, pass, step, t }
  const queue = []; // [{ t, section, step }] what was scheduled, to tell where the playhead is

  // `at`: a moment on the clock to start on (a little ahead, if left out).
  function start(mode = "loop", at = null) {
    const ac = clock();
    if (!ac) return false;
    stop();
    const pr = project();
    const order = mode === "song" ? pr.sections.map((s) => s.id) : [pr.section];
    playing = { mode, order, index: 0, pass: 0, section: order[0], step: 0, t: at != null && at > ac.currentTime ? at : ac.currentTime + 0.06, turns: 0 };
    tick();
    timer = setInterval(tick, WAKE);
    return true;
  }
  function stop() {
    clearInterval(timer);
    timer = 0;
    playing = null;
    queue.length = 0;
  }
  function tick() {
    const ac = clock();
    if (!ac || !playing) return;
    const pr = project();
    while (playing && playing.t < ac.currentTime + AHEAD) {
      const st = stepSeconds(pr);
      const sec = sectionOf(pr, playing.section);
      if (!sec) return stop();
      for (const v of pr.voices) {
        const e = engineOf(v.id);
        if (!e) continue;
        for (const n of notesOf(pr, v.id, sec.id)) if (n.s === playing.step) e.trigger(n.n, playing.t, n.l * st - 0.004);
      }
      queue.push({ t: playing.t, section: sec.id, step: playing.step });
      if (queue.length > 64) queue.shift();
      playing.t += st;
      playing.step++;
      if (playing.step >= totalSteps(pr)) advance(pr);
    }
  }
  function advance(pr) {
    playing.step = 0;
    playing.turns++;
    const after = playing.t;
    setTimeout(() => on.turn?.(), Math.max(0, (after - clock().currentTime) * 1000));
    if (playing.mode === "loop") {
      // The section in front now is the one that plays next.
      playing.section = pr.sections.some((s) => s.id === pr.section) ? pr.section : pr.sections[0].id;
      return;
    }
    const sec = sectionOf(pr, playing.section);
    playing.pass++;
    if (playing.pass < (sec?.times || 1)) return;
    playing.pass = 0;
    playing.index++;
    const ids = pr.sections.map((s) => s.id);
    // Sections may have been changed while it played: carry on from where this one is now.
    const at = ids.indexOf(playing.section);
    const next = at >= 0 ? ids[at + 1] : ids[playing.index];
    if (!next) {
      const end = playing.t;
      timer && clearInterval(timer);
      timer = 0;
      const p = playing;
      setTimeout(() => {
        if (playing === p) (stop(), on.end?.());
      }, Math.max(0, (end - clock().currentTime) * 1000));
      playing.t = Infinity;
      return;
    }
    playing.section = next;
  }
  // Where the playhead is at this moment: the section and the step, with how far into the step (0..1).
  function where(t = clock()?.currentTime) {
    if (!playing || t == null) return null;
    let last = null;
    for (const q of queue) if (q.t <= t) last = q;
    if (!last) return null;
    const st = stepSeconds(project());
    return { section: last.section, step: last.step, frac: Math.min(1, (t - last.t) / st), at: last.t };
  }
  return {
    start,
    stop,
    where,
    get playing() {
      return playing ? playing.mode : null;
    },
  };
}
