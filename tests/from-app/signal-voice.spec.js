// Signal's voice sessions (the master class, part 3), in the app with the browser's own fake microphone:
// the Microphone goes live, the Looper records layers from L and gives one back on Shift L, the clock
// follows the loop, and session 9 arrives beside session 8 on the same board. Its own file because the
// fake microphone is a browser launch option, which Playwright takes only at the top of a file.
import { test, expect } from "@playwright/test";
import { seed } from "./seed.js";
import { appCsp, readEnv } from "./csp.mjs";

test.use({
  permissions: ["microphone"],
  launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
});

const LEGACY_KEY = "subtextual-prototype-one-tree-v3";
const SAMPLES = JSON.stringify(seed());
const paras = (p) => p.locator(".page-editor > p[data-para]");
const game = (p) => p.getByRole("dialog", { name: "Signal" });
const arcade = (p) => p.getByRole("dialog", { name: "Arcade" });
async function openFromArcade(page) {
  await paras(page).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Arcade…" }).click();
  await arcade(page).getByRole("button", { name: /^Signal/ }).click();
  await expect(game(page)).toBeVisible();
}

test.describe("Signal's voice sessions", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addInitScript(([k, v]) => localStorage.getItem(k) == null && localStorage.setItem(k, v), [LEGACY_KEY, SAMPLES]);
    await page.goto("/");
    await expect(paras(page).first()).toBeVisible();
  });

  test("session 8 on the Your voice board: the microphone goes live, a Looper records layers from L and gives one back on Shift L, the clock follows the loop; session 9 arrives to the right with a Drive and takes nothing away; the board is kept", async ({ page }) => {
    await openFromArcade(page);
    const G = game(page);
    const S = (fn) => page.evaluate((fn) => new Function("s", fn)(document.querySelector("dialog.signal").signal), fn);
    await G.getByRole("button", { name: "Sessions", exact: true }).click();
    await expect(G.locator(".sg-course")).toHaveText(["Part 1 · Sound", "Part 2 · Time", "Part 3 · The voice", "Part 4 · The piece"]);
    await expect(G.locator(".sg-sessions button")).toHaveCount(12);
    await expect(G.locator(".sg-sessions em")).toHaveText(["Soon", "Soon"]);
    await G.getByRole("button", { name: /Your voice is an instrument/ }).click();
    await expect(G.getByRole("heading", { name: "8. Your voice is an instrument" })).toBeVisible();
    await expect(G.getByText("Record the room with nothing in it.")).toBeVisible();
    // The producer's notebook asks the session's questions when the AI isn't there; Another turns the page.
    await expect(G.locator(".sg-session .sg-nb")).toHaveText("Which layer did you record first, and is it still the one the others lean on?");
    await G.locator(".sg-session").getByRole("button", { name: "Another question" }).click();
    await expect(G.locator(".sg-session .sg-nb")).toHaveText("What would the loop lose if the newest layer went?");
    await G.locator(".sg-builds").getByRole("button", { name: /Your voice is an instrument/ }).click();
    await expect(G.getByRole("heading", { name: "Your voice is an instrument" })).toBeVisible();
    await expect(G.locator(".sg-front")).toHaveText("Voice");
    await expect(G.locator(".sg-place")).toHaveText("8 · Your voice is an instrument");
    expect(await S("return s.patch.modules.map((m) => m.type).sort()")).toEqual(["mic", "out"]);
    expect(await S("return s.session")).toBe(8);
    // The Microphone, switched on: the browser's (fake) microphone answers, and the first step is ticked.
    await expect(G.locator(".sg-state[data-state='mic1']")).toHaveText("Off");
    await G.getByRole("radiogroup", { name: "Microphone Mic" }).getByRole("radio", { name: "On" }).click();
    await expect.poll(() => S("return s.state('mic1')?.status"), { timeout: 10000 }).toBe("live");
    await expect(G.locator(".sg-state[data-state='mic1']")).toHaveText("Live");
    await expect(G.locator(".sg-why").first()).toContainText("Headphones keep the speaker’s sound out of it");
    // Through to the Speaker; then a Looper between them.
    await S("s.connect(['mic1', 'out'], ['out', 'in'])");
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(2);
    expect(await S("return s.add('looper')")).toBe("looper1");
    await S("s.disconnect(s.patch.cables.find((c) => c.from[0] === 'mic1' && c.to[0] === 'out').id)");
    await S("s.connect(['mic1', 'out'], ['looper1', 'in']); s.connect(['looper1', 'out'], ['out', 'in'])");
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(3);
    const press = G.locator(".sg-acts [data-action='press']");
    await expect(press).toHaveText(/^Record/);
    await expect(G.locator(".sg-state[data-state='looper1']")).toHaveText("Empty. Press L to record.");
    expect(await S("return s.state('looper1')?.layers")).toBe(0);
    // L records; the second L sets the length, and it plays round: one layer, about as long as the time between the presses.
    await page.keyboard.press("KeyL");
    await expect.poll(() => S("return s.state('looper1')?.mode"), { timeout: 5000 }).toBe("recording");
    await expect(press).toHaveText(/^Set the length/);
    await page.waitForTimeout(1500);
    await page.keyboard.press("KeyL");
    await expect.poll(() => S("return s.state('looper1')?.mode")).toBe("playing");
    const first = await S("return s.state('looper1')");
    expect(first.layers).toBe(1);
    expect(first.length).toBeGreaterThan(1.2);
    expect(first.length).toBeLessThan(2.3);
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(4);
    await expect(press).toHaveText(/^Overdub/);
    await expect(G.locator(".sg-state[data-state='looper1']")).toHaveText(/^1 layer · /);
    // A second layer over it, from the card's button this time.
    await press.click();
    await expect.poll(() => S("return s.state('looper1')?.mode")).toBe("overdub");
    await expect(press).toHaveText(/^Done/);
    await page.waitForTimeout(600);
    await press.click();
    await expect.poll(() => S("return s.state('looper1')?.layers")).toBe(2);
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(5);
    expect(await S("return s.state('looper1').length")).toBeCloseTo(first.length, 5); // the length is the first layer's, always
    // Shift L takes the last layer off; another goes on; the lesson is done, and the session's page is offered.
    await page.keyboard.press("Shift+KeyL");
    expect(await S("return s.state('looper1').layers")).toBe(1);
    await page.keyboard.press("KeyL");
    await page.waitForTimeout(500);
    await page.keyboard.press("KeyL");
    await expect.poll(() => S("return s.state('looper1')?.layers")).toBe(2);
    await expect(G.getByText("That’s the last lesson of this session. The playground is yours.")).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("subtextual-arcade-signal")).done)).toContain("mic");
    // The clock follows the loop: about a second and a half is one bar somewhere between 105 and 180 BPM, and the loop plays in time with it.
    await G.getByRole("button", { name: "Set the clock from it" }).click();
    const pr = await S("return { tempo: s.project.tempo, bars: s.project.bars, playing: s.playing }");
    expect(pr.bars).toBe(1);
    expect(pr.tempo).toBeGreaterThan(104);
    expect(pr.tempo).toBeLessThanOrEqual(180);
    expect(pr.playing).toBe("loop");
    await expect.poll(() => S("return s.where()?.step ?? -1"), { timeout: 5000 }).toBeGreaterThanOrEqual(0);
    // Session 9 arrives to the right of session 8, with a Drive; the loop and its layers are still there.
    await G.getByRole("button", { name: "Session 8: the playground" }).click();
    await expect(G.getByRole("heading", { name: "8. Your voice is an instrument" })).toBeVisible();
    await expect(G.locator(".sg-builds em")).toHaveText(["Done"]);
    await G.getByRole("button", { name: "Sessions", exact: true }).click();
    await expect(G.locator(".sg-sessions em")).toHaveText(["Done", "Soon", "Soon"]);
    await G.getByRole("button", { name: /Pedals/ }).click();
    await G.locator(".sg-builds").getByRole("button", { name: /Pedals/ }).click();
    await expect(G.getByRole("heading", { name: "Pedals" })).toBeVisible();
    await expect(G.locator(".sg-place")).toHaveText(["8 · Your voice is an instrument", "9 · Pedals"]);
    expect(await S("return s.patch.modules.map((m) => m.type).sort()")).toEqual(["drive", "looper", "mic", "out"]);
    const places = await S("return s.patch.places.map((p) => [p.name, p.x, p.y])");
    expect(places[1][1]).toBeGreaterThan(places[0][1]);
    expect(places[1][2]).toBe(places[0][2]);
    expect(await S("return s.patch.modules.find((m) => m.type === 'drive')")).toMatchObject({ x: places[1][1], y: places[1][2] + 12 });
    expect(await S("return s.state('looper1')?.layers")).toBe(2);
    expect(await S("return s.state('mic1')?.status")).toBe("live");
    expect(await S("return s.camera.fit")).toBe(true);
    // The Drive after the Looper, driven hard: two steps ticked, and the layers still play.
    await S("s.disconnect(s.patch.cables.find((c) => c.from[0] === 'looper1' && c.to[0] === 'out').id)");
    await S("s.connect(['looper1', 'out'], ['drive1', 'in']); s.connect(['drive1', 'out'], ['out', 'in'])");
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(1);
    await S("s.set('drive1', 'drive', 0.8); s.set('drive1', 'tone', 1000)");
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(2);
    expect(await S("return s.state('looper1')?.layers")).toBe(2);
    // Esc; the board is kept with its two places, and opens again as it was left.
    await page.keyboard.press("Escape");
    await expect(G).toHaveCount(0);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("subtextual-arcade-signal")));
    expect(kept.current).toBe("voice");
    expect(kept.lesson).toEqual({ kind: "voice", id: "pedals", step: 2 });
    expect(JSON.parse(kept.projects.find((x) => x.id === "voice").data).voices[0].patch.places.map((p) => p.name)).toEqual(["8 · Your voice is an instrument", "9 · Pedals"]);
    await openFromArcade(page);
    await expect(G.locator(".sg-place")).toHaveCount(2);
    await expect(G.getByRole("heading", { name: "Pedals" })).toBeVisible();
    await expect(G.locator(".sg-steps li.is-done")).toHaveCount(2);
  });
});

// Under the app's own policy, ENFORCED (csp.spec.js has the writer's day; this is the Looper's): the recorder
// is a same-origin worklet module, so it loads under worker-src 'self', records, and nothing is blocked.
test("under the enforced policy, the Microphone goes live, the Looper's recorder loads and records a layer, and nothing is blocked", async ({ browser }) => {
  const POLICY = appCsp(readEnv("test"));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const origin = new URL(process.env.PROTO_URL || "http://127.0.0.1:4616").origin;
  await ctx.route("**/*", async (route) => {
    const req = route.request();
    if (req.resourceType() !== "document" || !req.url().startsWith(origin)) return route.fallback();
    const res = await route.fetch();
    return route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": POLICY } });
  });
  await ctx.addInitScript(
    ([k, v]) => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.effectiveDirective} ${e.blockedURI} (${e.sourceFile}:${e.lineNumber})`));
      if (localStorage.getItem(k) == null) localStorage.setItem(k, v);
    },
    [LEGACY_KEY, SAMPLES],
  );
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(paras(page).first()).toBeVisible();
  await openFromArcade(page);
  const G = game(page);
  const S = (fn) => page.evaluate((fn) => new Function("s", fn)(document.querySelector("dialog.signal").signal), fn);
  await S("s.lessonStart('mic', 'voice')");
  await G.getByRole("radiogroup", { name: "Microphone Mic" }).getByRole("radio", { name: "On" }).click();
  await expect.poll(() => S("return s.state('mic1')?.status"), { timeout: 10000 }).toBe("live");
  expect(await S("return s.add('looper')")).toBe("looper1");
  await S("s.connect(['mic1', 'out'], ['looper1', 'in']); s.connect(['looper1', 'out'], ['out', 'in'])");
  await page.keyboard.press("KeyL");
  await expect.poll(() => S("return s.state('looper1')?.mode"), { timeout: 5000 }).toBe("recording"); // the worklet answered: recording began
  await page.waitForTimeout(600);
  await page.keyboard.press("KeyL");
  await expect.poll(() => S("return s.state('looper1')?.layers")).toBe(1);
  expect(await page.evaluate(() => window.__csp.filter((v) => !/^script-src eval .*\/neon-[\w-]+\.js/.test(v)))).toEqual([]);
  await ctx.close();
});
