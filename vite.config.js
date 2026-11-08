import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths, so the same build works at creativealgebra.github.io/signal/ and on its own domain.
  base: "./",
  server: { port: Number(process.env.PORT) || 4620 },
  preview: { port: Number(process.env.PORT) || 4620 },
  build: {
    outDir: "dist-site",
    emptyOutDir: true,
    // The Looper's recorder worklet must stay a real file: an AudioWorklet module can't be a data: URL under a strict policy.
    assetsInlineLimit: (file) => (file.endsWith("-worklet.js") ? false : undefined),
  },
});
