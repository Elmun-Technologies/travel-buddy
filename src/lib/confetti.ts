// A short confetti burst for big moments (trip opened, joined a group). One canvas, ~1.4 s,
// removed afterwards. Clay colours. Skipped entirely for prefers-reduced-motion.

const COLORS = ["#f3ee1c", "#0a5cff", "#0b0b0b", "#16a34a", "#e8f0ff"];

export function confetti(originY = 0.35) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.width = w * dpr;
  c.height = h * dpr;
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = `position:fixed;inset:0;width:${w}px;height:${h}px;pointer-events:none;z-index:100`;
  document.body.appendChild(c);
  const g = c.getContext("2d");
  if (!g) return c.remove();
  g.scale(dpr, dpr);

  const parts = Array.from({ length: 90 }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const speed = 7 + Math.random() * 8;
    return {
      x: w / 2,
      y: h * originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      s: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    g.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.vy += 0.32; // gravity
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.globalAlpha = Math.max(0, 1 - t / 1400);
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.fillStyle = p.color;
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      g.restore();
    }
    if (t < 1400) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
