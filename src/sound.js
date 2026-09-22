// Plays a short two-tone beep for reminder alerts. Lives in its own file
// (not src/components/Shared.jsx) because it's a plain utility, not a
// component — mixing the two in one file breaks Vite Fast Refresh for
// everything else that file exports.
export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.5].forEach((delay) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.18, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      o.start(ctx.currentTime + delay);
      o.stop(ctx.currentTime + delay + 0.4);
    });
  } catch {
    /* الجهاز لا يدعم تشغيل صوت / device doesn't support audio */
  }
}
