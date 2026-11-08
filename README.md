# Signal

A synthesizer to learn by patching, and a music master class built on it: modules joined by cables on an endless floor, a loop to compose in, your voice through a microphone, six pedals and a looper, and the computer's keyboard as the piano. Twelve sessions in four parts (sound, time, voice, the piece). A margin "Ghost Producer" asks questions about the track; it never plays, places or turns anything by itself unless the student asks it to, and its notes are always marked as the AI's.

Signal began inside the Subtextual web app (creativeAlgebra/subtextual-app, `prototype-next/signal/`, where it opens from the Arcade at https://editing.help/app/). This repo is its own home and its own site. It was lifted from subtextual-app branch `claude/project-thread-iqarru` at commit `72e7cbd` (draft PR #53, not merged), on 2026-11-08.

## Run it

Node 22 or newer.

```bash
npm install
npm run dev          # http://localhost:4620
npm run build:site   # builds the site into dist-site/
npm test             # the rules and studio checks (Playwright's test runner; no browser needed)
```

## The site

`.github/workflows/site.yml` builds `dist-site/` on every push to `main` and publishes it with GitHub Pages (Settings > Pages > Source: GitHub Actions). The build uses relative paths, so it works at `https://creativealgebra.github.io/signal/` and on a custom domain.

## Where things are

| | |
|---|---|
| `index.html`, `site/` | The site's page (`site/main.js` opens Signal at once), its small stylesheet (also the tokens Signal borrows from the app: `--glide`, `--glide-ms`, `--sans`) and `site/ai.js`, the bring-your-own-key door. |
| `src/signal.js` | The whole studio: `openSignal({ ai, save, onClose })` builds a `<dialog class="signal">`. Its state lives in localStorage under `subtextual-arcade-signal`. |
| `src/modules.js`, `src/patch.js` | The modules (jacks, knobs, curves) and patches as plain data. |
| `src/audio.js`, `src/recorder-worklet.js` | The sound: Web Audio nodes only, plus one worklet for the looper and microphone. Vite must keep the worklet a real file (see `vite.config.js`). |
| `src/project.js`, `src/loop.js`, `src/render.js` | Projects, the loop clock, and the offline render (`.wav` export and the numbers the producer reads). |
| `src/lessons.js`, `src/course.js`, `src/sessions.js`, `src/voice.js`, `src/looper.js`, `src/presets.js` | The lessons, the composing course, the twelve sessions, the voice rig, the looper's rules and the starting sounds. |
| `src/ghost.js`, `src/ghost-cards.js` | The Ghost Producer's stance, prompt and reply parsing; a denylist so it never echoes a published card set. |
| `tests/rules.spec.js` | The rules and studio checks that run here. |
| `tests/from-app/` | The original specs from the app, for reference only: they drive Signal through the app's Arcade and its test server, so they don't run in this repo. Port them to open `index.html` directly. |
| `site/claude-demo/` | The older single-file try-it page (bundled with esbuild); not part of the site. |

## The AI door

Signal never calls a service itself; it is handed an `ai` object:

```js
{ ready(), model(), needs(), ask({ system, user, maxTokens, signal, onText }), setup(), failed(error) }
```

On this site, `site/ai.js` provides it with the person's own Anthropic or OpenRouter key, kept in this browser (`signal-ai` in localStorage) and sent only to that service. Without a key, the producer works from its notebook of written questions. In the Subtextual app the same object wraps the app's AI settings and the Subtextual AI subscription.

## Rules carried over from the app

- The AI's words are always marked as the AI's, and it never names artists or reproduces records or published card sets (`ghost-cards.js`, checked by the tests).
- No third-party scripts, fonts or trackers; the only network calls are the AI requests the person makes with their own key.
- Usage is described as "about N asks", never in dollars.
- Plain, calm, specific copy in sentence case; no gradients, no decorative badges.

## Data

Everything is kept in the browser: projects, patches and progress in localStorage (`subtextual-arcade-signal`). This site is a different origin from editing.help, so work saved in the Arcade doesn't appear here; a project moves between them through its `.signal.json` export and Open.
