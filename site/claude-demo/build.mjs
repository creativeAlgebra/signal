// Bundles the prototype into one standalone page: node build.mjs <out.html>
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, "signal-demo.html");
const r = await build({ entryPoints: [join(here, "main.js")], bundle: true, minify: true, write: false, outdir: "out", format: "iife", target: "es2020", loader: { ".png": "dataurl" } });
const js = r.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = r.outputFiles.find((f) => f.path.endsWith(".css"))?.text || "";
const page = readFileSync(join(here, "index.html"), "utf8").replace("/*CSS*/", () => css).replace("/*JS*/", () => js.replace(/<\/script/g, "<\\/script"));
writeFileSync(out, page);
console.log(out, page.length, "bytes");
