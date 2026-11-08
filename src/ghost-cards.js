// No imports: the denylist is checked directly in the tests, too.
// Oblique Strategies (Brian Eno and Peter Schmidt) is a copyrighted card set: the Ghost writes
// in an original voice "in its spirit" only. A small list of well-known whole cards (and the
// names) that a nudge must never contain; a reply that does is dropped, never added.
// Two tiers, so ordinary writing isn't caught: cards distinctive enough to match anywhere,
// and short cards made of everyday words, which match only as a sentence (or clause) of their own.
export const CARD_ANYWHERE = [
  "honor thy error as a hidden intention",
  "repetition is a form of change",
  "remove specifics and convert to ambiguities",
  "gardening not architecture",
  "go slowly all the way round the outside",
  "not building a wall but making a brick",
  "look closely at the most embarrassing details and amplify them",
  "only one element of each kind",
  "give way to your worst impulse",
  "abandon normal instruments",
  "oblique strategies",
  "brian eno",
  "peter schmidt",
];
export const CARD_SENTENCES = [
  "use an old idea",
  "what would your closest friend do",
  "emphasize the flaws",
  "do nothing for as long as possible",
  "discard an axiom",
  "work at a different speed",
  "use fewer notes",
  "what wouldnt you do",
];
export const CARD_PHRASES = [...CARD_ANYWHERE, ...CARD_SENTENCES];
const norm = (t) =>
  ` ${t
    .toLowerCase()
    .replace(/['’‘]/g, "")
    .replace(/honour/g, "honor")
    .replace(/emphasise/g, "emphasize")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
// Sentences and clauses set off on their own (by punctuation, double quotation marks or a dash).
const clauses = (t) =>
  t
    .split(/[.!?;:()\n"“”—–]+|\s-\s/)
    .map((x) => norm(x).trim())
    .filter(Boolean);
export const echoesCard = (text = "") => {
  const t = norm(text);
  if (CARD_ANYWHERE.some((p) => t.includes(` ${p} `))) return true;
  const own = clauses(text);
  return CARD_SENTENCES.some((p) => own.some((c) => c === p || c === "try " + p || c === "then " + p));
};
