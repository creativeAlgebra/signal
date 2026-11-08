// The Looper's ear: an AudioWorklet that hands what it hears to the page, as it hears it, with the
// clock's time on each piece, while it is told to listen. Same origin, so the app's policy
// (script-src 'self') allows it; nothing here reaches outside the audio thread.
class Recorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false;
    this.port.onmessage = (e) => {
      if (e.data === "start") this.on = true;
      else if (e.data === "stop") {
        this.on = false;
        this.port.postMessage({ stopped: currentTime });
      }
    };
  }
  process(inputs) {
    if (!this.on) return true;
    const inp = inputs[0];
    if (!inp || !inp.length) return true;
    const n = inp[0].length;
    const mono = new Float32Array(n);
    for (const ch of inp) for (let i = 0; i < n; i++) mono[i] += ch[i] / inp.length;
    this.port.postMessage({ t: currentTime, data: mono }, [mono.buffer]);
    return true;
  }
}
registerProcessor("sg-recorder", Recorder);
