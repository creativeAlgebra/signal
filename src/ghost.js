// The Ghost Producer: the Ghost Editor's way of working, in the studio. It reads the project as text
// (every voice's patch, the loop, and numbers the app measured from its own offline render) and
// leaves a few notes in the margin. It can't hear the sound and says so. Asked a question, it asks
// back, gives one example for the kid to try, counters, suggests structure, or says whether a piece
// is done or was stopped; the next move is the kid's. Asked for a sound (Randall, 2026-11-08: "make
// me a pad like…"), it has hands: it answers with steps the board performs in front of the kid, one
// at a time, each with its reason, every one undoable. It never acts unasked, never writes a Note on
// the floor, never places a note in the loop, and never takes the Keyboard or the Speaker. Its stance
// is written here in our own words: it listens before it speaks, asks what the person meant before
// saying what it noticed, takes away before it adds, and never praises. It knows which session of
// the master class the kid is in, and the craft of that part. No DOM here.
import { MODULES, ADDABLE, defOf, readOf, isChoice } from "./modules.js";
import { moduleOf } from "./patch.js";
import { sectionOf, notesOf, totalSteps, stepSeconds, songBars, STEPS } from "./project.js";
import { echoesCard } from "./ghost-cards.js";

export const NAME = "Ghost Producer";
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteText = (n) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 1}`;
const where = (s) => `bar ${Math.floor(s / STEPS) + 1} step ${(s % STEPS) + 1}`;

// One patch in words: each module with its knobs as they read, then each cable.
export function patchText(patch) {
  const lines = [];
  for (const m of patch.modules) {
    const d = defOf(m.type);
    if (d.note) {
      lines.push(`  - ${m.id} (Note, the writer's own words on the floor): ${m.p.text.trim() ? `“${m.p.text.trim()}”` : "empty"}`);
      continue;
    }
    const knobs = Object.entries(d.params)
      .map(([k, pd]) => `${pd.label.toLowerCase()} ${isChoice(pd) ? readOf(pd, m.p[k]).toLowerCase() : readOf(pd, m.p[k])}`)
      .join(", ");
    lines.push(`  - ${m.id} (${MODULES[m.type].name})${knobs ? `: ${knobs}` : ""}`);
  }
  for (const c of patch.cables) {
    const a = moduleOf(patch, c.from[0]),
      b = moduleOf(patch, c.to[0]);
    if (a && b) lines.push(`  - cable: ${c.from[0]} ${c.from[1]} → ${c.to[0]} ${c.to[1]}`);
  }
  return lines.join("\n");
}
// The whole project in words: the text the kid can read before it goes, and the copy that can be shared.
export function projectText(pr, numbers = null, { ai = true } = {}) {
  const st = stepSeconds(pr);
  const out = [
    `Project “${pr.name}”. Tempo ${pr.tempo} BPM; one step is ${Math.round(st * 1000)} ms; the loop is ${pr.bars} bar${pr.bars > 1 ? "s" : ""} of ${STEPS} steps.`,
    `Sections, in order: ${pr.sections.map((s) => `${s.name} ×${s.times}`).join(", ")} (${songBars(pr)} bars in all). The section in front is ${sectionOf(pr).name}.`,
  ];
  for (const v of pr.voices) {
    out.push("", `Voice “${v.name}” (${v.role}):`, patchText(v.patch));
    for (const s of pr.sections) {
      const ns = notesOf(pr, v.id, s.id);
      out.push(`  Section ${s.name}: ${ns.length ? ns.map((n) => `${noteText(n.n)} at ${where(n.s)} for ${n.l} step${n.l > 1 ? "s" : ""}`).join("; ") : "no notes"}`);
    }
  }
  if (numbers) {
    out.push("", `Measured by the app from an offline render of section ${numbers.section} (the AI doesn't hear it):`);
    for (const v of numbers.voices)
      out.push(v.silent ? `  - ${v.name}: silent (${v.notes} notes, fills ${v.fill}% of the steps)` : `  - ${v.name}: brightness ${v.centroid} Hz, most energy between ${v.low} and ${v.high} Hz, level ${v.rms.toFixed(1)} dBFS, fills ${v.fill}% of the steps`);
    const m = numbers.mix;
    if (m && !m.silent) out.push(`  - All together: peak ${m.peak.toFixed(1)} dBFS${m.clips ? " (it clips)" : ", no clipping"}; loudest bar ${m.loudest}, quietest bar ${m.quietest}.`);
  }
  const kept = (pr.ghost || []).filter((g) => g.kept);
  if (kept.length) out.push("", "Notes kept:", ...kept.map((g) => `  - ${ai ? "[AI] " : ""}${g.text}`));
  return out.join("\n");
}

// What this style is made of, as craft. The song is not.
const CRAFT = `What this kind of music is made of (1970s French electronic, slow-building synthesizer records), as craft:
- the pulse: a sequenced bass line that never stops, a saw through a low-pass, a short envelope on the cutoff; rhythm from repetition and tone, not drums
- the floor: a pad of two saws a few cents apart, a slow attack, a slow LFO moving the filter
- the wind: noise through a narrow band-pass that an LFO sweeps, with a long echo
- the voice: one lead with glide between notes and a light vibrato; few notes, held, bent, and left alone
- the room: one long echo in time with the pulse, feedback under half
- the hit: a snare from a burst of noise with a fast decay; a thud from a sine that drops in pitch
- the arc: parts arrive one at a time; harmony changes slowly; a track is a plan of arrivals`;

// What looping a voice through pedals is made of, as craft (the master class's third part).
const CRAFT_VOICE = `What a voice through a looper and pedals is made of, as craft:
- the first layer sets the length; every layer after it agrees with it, or disagrees on purpose
- a layer of breath, clicks or the empty room is a layer; not everything has to be a note
- the voice an octave down is a bass; a fifth up is the harmony that always fits
- pedals read in order: what comes first is heard through everything after it
- the loop is a stack edited from the top: the newest layer is the one to lose
- a loop that never changes is a floor; the piece is what happens on it`;

// The producer's stance, in our own words. It is a way of listening, not a set of sayings.
export const STANCE = `How you work: you listen before you speak. You ask what they are trying to make before you say anything about what they made. You take things away before you add anything. You would rather the piece be true than big, and you care how it feels, not whether it is correct. You never do the work for them and you never tell them it is good: you say what you noticed and leave the choice with them. Asked whether a piece is done, you answer 'done' or 'stopped', and name the one thing that tells you.`;

const RULES = `Leave at most three short notes. Each note does exactly one of these:
- question: ask something about a choice in the project
- example: one change they could make themselves, naming the voice, the module, the knob, the value or the bar ("Try Floor's filter cutoff at 1.2 kHz and play it twice")
- counter: name what a choice costs and ask about the other way
- structure: something about order, arrivals, sections or space
- verdict: only when they ask whether it is done: 'done' or 'stopped', and the one thing that tells you

Rules:
- Never praise or judge. No "good", "great", "nice", "bad", "wrong", "perfect".
- Never write the music for them: no melody, chord sequence, or list of more than two notes; never say "here is a bass line". The next move is always theirs.
- Never name any artist, band, album or song, and never reproduce melodies, chord sequences, titles or lyrics from any published record. The style is fair game; the song is not.
- Never quote or paraphrase published aphorisms or creative-prompt cards. Write in your own words.
- Plain words a 14-year-old knows, each note under 30 words. No Markdown, no emoji, no hashtags.
- Inside a note, use single quotes, never double quotes.
- Reply with JSON only: an array of objects {"about": a voice's name, or "bar N", or "loop"; "move": "question" | "example" | "counter" | "structure" | "verdict"; "text": the note}.`;

// The modules the hands may use, in words: every one the Add menu offers but the Note (the kid's own words).
const HANDS_TYPES = ADDABLE.filter((t) => !defOf(t).note);
const range = (k, pd) => {
  if (isChoice(pd)) return `${k} [${pd.options.join("|")}] =${pd.def}`;
  const reads = pd.read ? ` (reads ${pd.read(pd.min)} to ${pd.read(pd.max)})` : "";
  return `${k} ${pd.min}..${pd.max} =${pd.def}${reads}${pd.when ? `, only with a cable in ${pd.when}` : ""}`;
};
export function catalogText() {
  return HANDS_TYPES.map((t) => {
    const d = defOf(t);
    const ports = (list) => (list.length ? list.map((x) => `${x.id} (${x.kind})`).join(", ") : "none");
    const knobs = Object.entries(d.params).map(([k, pd]) => range(k, pd)).join("; ");
    return `- ${t}: ${d.name}. ${d.line}${d.single ? " One to a board." : ""}${d.fixed ? " Can't be removed." : ""} In: ${ports(d.ins)}. Out: ${ports(d.outs)}.${knobs ? ` Knobs: ${knobs}.` : ""}`;
  }).join("\n");
}

// The hands: how it works the board when asked for a sound. The board does each step in front of the kid.
const HANDS = `Hands. When they ask you to make, build, change, fix or get a sound ("make me a pad like…", "give me a bass for this"), work on their board: put the moves in "steps", and they happen in front of them. When they ask a question or for advice, answer in "say" (and notes); if there are moves that would show what you mean, put them in "offer" instead of "steps": they see the offer as a card and nothing happens unless they take it.
Reply with one JSON object: {"say": one or two plain sentences, under 50 words (what you are about to do and why, or the answer); "steps": [...] or "offer": [...] (optional); "notes": [...] (optional, as above)}.
Each step is one move on the board, with its reason in "why": under 25 words, specific, about what it does to the sound.
- {"do":"add","type":<a module type from the list>,"as":<a short handle you choose, like osc2, for later steps>,"why":"..."}
- {"do":"set","module":<a module id or your handle>,"param":<a knob>,"value":<a number in its range, or one of the options>,"why":"..."}
- {"do":"connect","from":"<module>.<out jack>","to":"<module>.<in jack>","why":"..."}
- {"do":"disconnect","from":"<module>.<out jack>","to":"<module>.<in jack>","why":"..."}
- {"do":"remove","module":<a module id>,"why":"..."}
- {"do":"show","module":<a module id>,"param":<a knob, or leave it out>,"why":"..."}: point at it and change nothing (when they ask you to show them something)
Rules for the hands: at most 12 steps, in the order to do them. Take away before you add. Use only the modules, jacks and knobs listed, with the kinds that fit (an output goes to an input of its kind; audio also goes into mod). Keep the Keyboard and the Speaker, and leave every Note alone. When you're done, the sound still reaches the Speaker. Add a module before you connect or set it. Explain each step as a producer would to a 14-year-old.
If they named a band, artist or record, work from what that kind of sound is made of (its waves, filters, motion and space) in your own words. You may say the name they said; name nothing else, and never a song, melody, chord sequence, title or lyric.

The modules:
`;

// The prompt for where the kid is: the stance, the craft of the part they are in, the session, the rules;
// with `hands`, also the hands and the modules (the kid asked in their own words, which may ask for a sound).
// `session`: { n, title, part } from sessions.js, or null for the studio on its own.
export function systemFor(session = null, { looping = false, hands = false } = {}) {
  const voice = session?.part === "voice" || looping;
  const where = session ? `\n\nThey are in session ${session.n} of a master class, "${session.title}"${session.part === "voice" ? ", where the instrument is their own voice through a looper and pedals" : ""}. Keep to what that session is about unless they ask about something else.` : "";
  return `You are the Ghost Producer in Signal, a synthesizer studio. The person making the music is about 14 and is learning to compose. You sit in the next room: you read their project as text (each voice's patch, the notes in the loop, and a few numbers the app measured), and you cannot hear it. Say so if it matters.

${STANCE}

${CRAFT}${voice ? `\n\n${CRAFT_VOICE}` : ""}${where}

${RULES}${hands ? `\n\n${HANDS}${catalogText()}` : ""}`;
}
export const SYSTEM = systemFor(null);

// The Ghost Producer's own deck, for "Give me a constraint": the five operators of the Ghost Editor, turned to sound.
export const DECK = [
  { op: "Subtract", card: "Take one voice out for a whole section. Listen for what it was carrying." },
  { op: "Subtract", card: "The loudest voice at half its level, and nothing else changed." },
  { op: "Subtract", card: "A rest where the strongest note was." },
  { op: "Divide", card: "One long note, cut into pieces that keep its pitch." },
  { op: "Divide", card: "The bar in two halves that disagree." },
  { op: "Multiply", card: "The pulse's rhythm, lent to a voice that never had one." },
  { op: "Multiply", card: "The echo's time set to a number of steps you can count." },
  { op: "Add", card: "One knob, one new value, and eight bars to hear it." },
  { op: "Add", card: "One note that arrives late, on purpose." },
  { op: "Recognize", card: "The same loop at three tempos. Keep the one your foot picks." },
  { op: "Recognize", card: "Play the loop an octave higher and name what changed." },
];
export const drawCard = (random = Math.random) => DECK[Math.floor(random() * DECK.length)];

// The five questions, in a 14-year-old's words, and a sixth for their own.
export const ASKS = [
  { id: "muddy", label: "What's muddy?", ask: () => "What's muddy? Which voices are fighting for the same space, and what could I try?" },
  { id: "first", label: "What would you change first?", ask: () => "What would you change first, and why that?" },
  { id: "constraint", label: "Give me a constraint", ask: (card) => `Give me a constraint for this project. Start from this card from the Ghost Producer's deck (${card.op}): “${card.card}” Turn it into one concrete constraint for my project, naming the voice, section or bar. One note only, move "example" or "structure".` },
  { id: "going", label: "How do I make it feel like it's going somewhere?", ask: () => "How do I make it feel like it's going somewhere?" },
  { id: "done", label: "Is it done?", ask: () => "Is this done, or did I just stop? Say which, and the one thing that tells you. One note only, move \"verdict\"." },
];
// `history`: the last few lines of the conversation, [{ who: "you" | "producer", text }], oldest first.
export const userFor = (pr, numbers, question, session = null, history = []) =>
  `${projectText(pr, numbers, { ai: true })}${session ? `\n\nThey are in session ${session.n}, "${session.title}".` : ""}${
    history.length ? `\n\nThe conversation so far:\n${history.map((m) => `${m.who === "you" ? "They" : "You"}: ${String(m.text).replace(/\s+/g, " ").trim().slice(0, 300)}`).join("\n")}` : ""
  }\n\nTheir question: ${question}`;

// Each {...} in a broken answer, read field by field. A note's text runs to the last quote that
// is followed only by other fields or the closing brace, so a quote inside it doesn't cut it short.
function looseObjects(s) {
  const out = [];
  for (const [chunk] of s.matchAll(/\{[^{}]*\}?/g)) {
    const field = (name) => chunk.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))?.[1];
    const at = chunk.search(/"text"\s*:\s*"/);
    if (at < 0) continue;
    const rest = chunk.slice(at).replace(/^"text"\s*:\s*"/, "");
    let text = null;
    for (let i = rest.indexOf('"'); i >= 0; i = rest.indexOf('"', i + 1))
      if (/^"\s*(,\s*"(about|move)"\s*:\s*"[^"]*"\s*)*\}?\s*$/.test(rest.slice(i))) {
        text = rest.slice(0, i);
        break;
      }
    if (text == null) continue; // cut off mid-note: leave it out rather than show half
    text = text.replace(/\\n/g, " ").replace(/\\(["\\/])/g, "$1");
    out.push({ about: field("about"), move: field("move"), text });
  }
  return out;
}
const BANNED = /\b(jarre|oxyg[eè]ne|equinoxe|zoolook|vangelis|tangerine dream|kraftwerk)\b/i;
const JUDGING = /\b(great|nice|awesome|perfect|amazing|good job|well done)\b/i;
// A line the producer may say: nothing that names the record (unless the kid named it in their ask),
// echoes a published card or just praises.
const sayable = (t, ask = "") => !!t && !(BANNED.test(t) && !BANNED.test(ask)) && !echoesCard(t) && !(JUDGING.test(t) && t.split(" ").length < 8);
const plain = (t, max) =>
  String(t || "")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
// The answer, as notes. Anything that names the record or an artist, echoes a published card or
// just praises is dropped, never shown. Returns [{ about, move, text }].
export function parseNotes(text, pr, ask = "") {
  let list = null;
  const s = String(text || "");
  const a = s.indexOf("["),
    b = s.lastIndexOf("]");
  if (a >= 0 && b > a)
    try {
      list = JSON.parse(s.slice(a, b + 1));
    } catch {}
  // JSON that doesn't parse (a quote left unescaped, or an answer cut short) is read object by
  // object; whatever still looks like JSON is never shown as a note.
  if (!Array.isArray(list)) list = looseObjects(s);
  if (!list.length && !/[{}]|"\w+"\s*:/.test(s))
    list = s
      .split(/\n+/)
      .map((t) => t.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
      .filter(Boolean)
      .map((t) => ({ about: "loop", text: t }));
  const voices = new Map(pr.voices.map((v) => [v.name.toLowerCase(), v.name]));
  return list
    .filter((n) => n && typeof n.text === "string")
    .map((n) => {
      let about = String(n.about || "loop").trim();
      const bar = about.match(/^bar\s*(\d+)$/i);
      if (bar) about = `bar ${Math.min(Math.max(1, Number(bar[1])), Math.max(1, songBars(pr)))}`;
      else about = voices.get(about.toLowerCase()) || "loop";
      const move = ["question", "example", "counter", "structure", "verdict"].includes(n.move) ? n.move : "";
      const t = n.text
        .replace(/[*_`#]+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 400);
      return { about, move, text: t };
    })
    .filter((n) => sayable(n.text, ask))
    .slice(0, 3);
}

// The answer to an ask that may want hands: { say, steps: [{ do, type, as, module, param, value, from, to, why }], notes }.
// A reply that is only notes (an array, or words) has no steps. Steps keep their shape here and are
// checked against the board when they are done (signal.js), one by one; a reason that can't be said
// is left blank, never shown. At most 12 steps.
const DOES = new Set(["add", "set", "connect", "disconnect", "remove", "show"]);
const jack = (v) => {
  const m = String(v || "").match(/^\s*([\w-]+)\s*[.:/]\s*([\w-]+)\s*$/);
  return m ? [m[1], m[2]] : null;
};
const normSteps = (raw, ask) => {
  const steps = [];
  for (const r of Array.isArray(raw) ? raw.slice(0, 12) : []) {
    if (!r || typeof r !== "object" || !DOES.has(r.do)) continue;
    const why = plain(r.why, 200);
    const st = { do: r.do, why: sayable(why, ask) ? why : "" };
    if (r.do === "add") {
      st.type = plain(r.type, 20).toLowerCase();
      st.as = plain(r.as || "", 20);
    } else if (r.do === "set") {
      st.module = plain(r.module, 20);
      st.param = plain(r.param, 20);
      st.value = typeof r.value === "number" ? r.value : plain(r.value, 20);
    } else if (r.do === "remove") st.module = plain(r.module, 20);
    else if (r.do === "show") {
      st.module = plain(r.module, 20);
      if (r.param) st.param = plain(r.param, 20);
    } else {
      st.from = jack(r.from);
      st.to = jack(r.to);
      if (!st.from || !st.to) continue;
    }
    steps.push(st);
  }
  return steps;
};
// The producer's reply: { say, steps, offer, notes }. `steps` are done on the board now; `offer` is the same shape,
// shown as a card and done only if the kid takes it. A reply that is only notes (or only words) has neither.
export function parseReply(text, pr, ask = "") {
  const s = String(text || "");
  let obj = null;
  const a = s.indexOf("{"),
    b = s.lastIndexOf("}");
  const arr = s.indexOf("[");
  if (a >= 0 && b > a && (arr < 0 || a < arr))
    try {
      obj = JSON.parse(s.slice(a, b + 1));
    } catch {}
  if (!obj || typeof obj !== "object" || Array.isArray(obj) || !(Array.isArray(obj.steps) || Array.isArray(obj.offer) || Array.isArray(obj.notes) || typeof obj.say === "string"))
    return { say: "", steps: [], offer: [], notes: parseNotes(s, pr, ask) };
  const notes = Array.isArray(obj.notes) ? parseNotes(JSON.stringify(obj.notes), pr, ask) : [];
  const say = plain(obj.say, 300);
  const steps = normSteps(obj.steps, ask);
  return { say: sayable(say, ask) ? say : "", steps, offer: steps.length ? [] : normSteps(obj.offer, ask), notes };
}
