// Signal's own site: the page opens Signal at once, with the bring-your-own-key door.
import { openSignal } from "../src/signal.js";
import { door, loadAI, saveAI, PROVIDERS } from "./ai.js";
import "./site.css";

const keyDialog = document.querySelector("[data-key]");
const form = keyDialog.querySelector("form");
const provider = form.elements.provider;
const key = form.elements.key;
const model = form.elements.model;

const fill = () => {
  const s = loadAI();
  provider.value = s?.provider || "anthropic";
  key.value = s?.key || "";
  model.value = s?.model || "";
  hint();
};
const hint = () => {
  const p = PROVIDERS.find((x) => x.id === provider.value);
  key.placeholder = p.keyHint;
  model.placeholder = p.model;
  keyDialog.querySelector("[data-who]").textContent = p.name;
};
provider.addEventListener("change", hint);
form.addEventListener("submit", (e) => {
  if (e.submitter?.value === "forget") {
    saveAI(null);
  } else if (e.submitter?.value === "save" && key.value.trim()) {
    saveAI({ provider: provider.value, key: key.value.trim(), model: model.value.trim() });
  }
});

// Signal closes itself before asking for setup; it comes back once the key dialog closes.
let reopen = false;
const setup = () => {
  reopen = !!document.querySelector("dialog.signal");
  fill();
  keyDialog.showModal();
};
keyDialog.addEventListener("close", () => {
  if (reopen) (reopen = false), open();
});

const save = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 4000);
};

const ai = door({ setup });
const open = () => openSignal({ ai, save, onClose: () => document.querySelector("[data-open]")?.focus() });
document.querySelector("[data-open]").addEventListener("click", open);
document.querySelector("[data-setup]").addEventListener("click", () => (fill(), keyDialog.showModal()));
open();
