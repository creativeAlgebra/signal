// The try-it page: opens Signal on its own, outside the app. On a page that may ask Claude, the
// Ghost Producer asks through that; files are offered through the page's own save, where there is one.
import { openSignal } from "../../src/signal.js";

let sample = null,
  downloads = null;
window.claude?.use?.("sample")?.then((s) => (sample = s), () => {});
window.claude?.use?.("downloads")?.then((d) => (downloads = d), () => {});
const ai = {
  ready: () => !!sample,
  model: () => "Claude",
  needs: () => "The Ghost Producer asks Claude, which this page can’t reach here.",
  ask: async (o) => {
    const r = await sample([{ role: "user", content: `${o.system}\n\n---\n\n${o.user}` }], { signal: o.signal, modelTier: "quick", onText: ({ text }) => o.onText?.(text) });
    return r.text;
  },
};
const save = (blob, name) => {
  if (!downloads) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 4000);
    return;
  }
  return downloads.save({ filename: name, data: blob }).catch(() => {});
};
const open = () => openSignal({ ai, save, onClose: () => document.querySelector("[data-open]")?.focus() });
document.querySelector("[data-open]").addEventListener("click", open);
window.openSignal = openSignal;
open();
