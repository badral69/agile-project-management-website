import { useEffect, useRef } from "react";

export type SectionAnimType = "flow" | "faq" | "contact";

// ─── How It Works: horizontal step timeline ────────────────────────────────
function drawFlow(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dpr: number, dark: boolean) {
  const steps = 4;
  const cy = h * 0.5;
  const pad = w * 0.14;
  const R = 22 * dpr;
  const hue = dark ? 212 : 248;

  // Horizontal line
  ctx.beginPath();
  ctx.moveTo(pad + R, cy);
  ctx.lineTo(w - pad - R, cy);
  ctx.strokeStyle = `hsla(${hue}, 60%, 58%, ${dark ? 0.35 : 0.28})`;
  ctx.lineWidth = 2 * dpr;
  ctx.setLineDash([5 * dpr, 9 * dpr]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Traveling particle along the line
  const phase = (t * 0.32) % 1;
  const lineX = pad + R + (w - 2 * pad - 2 * R) * phase;
  const pGrad = ctx.createRadialGradient(lineX, cy, 0, lineX, cy, 12 * dpr);
  pGrad.addColorStop(0, `hsla(${hue}, 88%, 68%, ${dark ? 0.9 : 0.75})`);
  pGrad.addColorStop(1, `hsla(${hue}, 88%, 68%, 0)`);
  ctx.beginPath();
  ctx.arc(lineX, cy, 12 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = pGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lineX, cy, 4 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hue}, 92%, 74%, ${dark ? 0.95 : 0.85})`;
  ctx.fill();

  // Step nodes
  for (let i = 0; i < steps; i++) {
    const cx = pad + i * ((w - 2 * pad) / (steps - 1));
    const pulse = Math.sin(t * 1.0 - i * 0.85) * 0.5 + 0.5;
    const nHue = hue + i * 16;

    // Pulse ring
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(0, R + 10 * dpr * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${nHue}, 70%, 60%, ${(dark ? 0.28 : 0.2) * pulse})`;
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Node fill
    const nGrad = ctx.createRadialGradient(cx, cy - R * 0.2, 2 * dpr, cx, cy, R);
    nGrad.addColorStop(0, `hsla(${nHue}, 78%, 65%, ${dark ? 0.55 : 0.42})`);
    nGrad.addColorStop(1, `hsla(${nHue}, 68%, 50%, ${dark ? 0.12 : 0.08})`);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = nGrad;
    ctx.fill();

    // Node stroke
    ctx.strokeStyle = `hsla(${nHue}, 72%, 62%, ${dark ? 0.65 : 0.52})`;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Step number
    ctx.font = `700 ${Math.round(13 * dpr)}px system-ui, sans-serif`;
    ctx.fillStyle = `hsla(${nHue}, 75%, ${dark ? 82 : 40}%, ${dark ? 0.85 : 0.72})`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${i + 1}`, cx, cy);
  }
}

// ─── FAQ: clean expanding ripple rings ────────────────────────────────────
function drawFaq(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dpr: number, dark: boolean) {
  const sources = [
    { rx: 0.18, ry: 0.4,  freq: 0.55, phase: 0.0 },
    { rx: 0.5,  ry: 0.62, freq: 0.48, phase: 1.5 },
    { rx: 0.82, ry: 0.35, freq: 0.52, phase: 2.9 },
  ];
  const maxR = Math.min(w, h) * 0.3;
  const rings = 4;

  sources.forEach((s) => {
    const ox = s.rx * w;
    const oy = s.ry * h;
    const hue = dark ? 205 : 255;

    for (let r = 0; r < rings; r++) {
      const phase = ((t * s.freq + s.phase + r / rings) % 1);
      const radius = phase * maxR;
      if (radius <= 0) return;
      const alpha = (1 - phase) * (dark ? 0.38 : 0.28);
      ctx.beginPath();
      ctx.arc(ox, oy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue + r * 10}, 68%, 62%, ${alpha})`;
      ctx.lineWidth = (2.2 - phase * 1.6) * dpr;
      ctx.stroke();
    }

    // Center dot
    const pulse = Math.sin(t * s.freq * Math.PI * 2 + s.phase) * 0.45 + 0.55;
    ctx.beginPath();
    ctx.arc(ox, oy, Math.max(0, 5 * dpr * pulse), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 75%, 65%, ${dark ? 0.6 : 0.5})`;
    ctx.fill();
  });
}

// ─── Contact: arc signals + particles traveling between nodes ─────────────
function drawContact(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dpr: number, dark: boolean) {
  const srcX = w * 0.2;
  const dstX = w * 0.8;
  const midY = h * 0.5;
  const arcCount = 5;

  // Left arcs
  for (let i = 1; i <= arcCount; i++) {
    const phase = ((t * 0.48 + i * 0.17) % 1);
    const r = phase * i * 38 * dpr;
    const alpha = (1 - phase) * (dark ? 0.32 : 0.24);
    ctx.beginPath();
    ctx.arc(srcX, midY, r, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.strokeStyle = `hsla(${dark ? 212 : 252}, 72%, 62%, ${alpha})`;
    ctx.lineWidth = (2 - i * 0.2) * dpr;
    ctx.stroke();
  }

  // Right arcs
  for (let i = 1; i <= arcCount; i++) {
    const phase = ((t * 0.48 + i * 0.17 + 0.5) % 1);
    const r = phase * i * 38 * dpr;
    const alpha = (1 - phase) * (dark ? 0.26 : 0.18);
    ctx.beginPath();
    ctx.arc(dstX, midY, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.strokeStyle = `hsla(${dark ? 168 : 308}, 68%, 60%, ${alpha})`;
    ctx.lineWidth = (2 - i * 0.2) * dpr;
    ctx.stroke();
  }

  // Traveling particles on 3 arc paths
  [-0.2, 0, 0.2].forEach((offset, pi) => {
    const phase = ((t * 0.4 + pi * 0.33) % 1);
    const px = srcX + (dstX - srcX) * phase;
    const py = midY + h * offset * Math.sin(phase * Math.PI);
    const pA = Math.sin(phase * Math.PI) * (dark ? 0.85 : 0.68);
    const hue = dark ? 212 + pi * 18 : 252 + pi * 18;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, 9 * dpr);
    pg.addColorStop(0, `hsla(${hue}, 88%, 72%, ${pA})`);
    pg.addColorStop(1, `hsla(${hue}, 88%, 72%, 0)`);
    ctx.beginPath();
    ctx.arc(px, py, 9 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 92%, 76%, ${pA})`;
    ctx.fill();
  });

  // Source/dest anchors
  [[srcX, dark ? 212 : 252], [dstX, dark ? 172 : 308]].forEach(([ax, hue]) => {
    const p = Math.sin(t * 1.4) * 0.4 + 0.6;
    ctx.beginPath();
    ctx.arc(ax, midY, Math.max(0, 7 * dpr * p), 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 78%, 66%, ${dark ? 0.35 : 0.28})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ax, midY, 4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 88%, 74%, ${dark ? 0.78 : 0.62})`;
    ctx.fill();
  });
}

// ─── Section background canvas ─────────────────────────────────────────────
export function SectionCanvas({ type, className }: { type: SectionAnimType; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const start = performance.now();
    let animId = 0;

    const draw = (now: number) => {
      const tt = (now - start) * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const dpr = devicePixelRatio;
      const dark = document.documentElement.dataset.theme === "dark";
      ctx.clearRect(0, 0, w, h);
      switch (type) {
        case "flow":    drawFlow(ctx, w, h, tt, dpr, dark);    break;
        case "faq":     drawFaq(ctx, w, h, tt, dpr, dark);     break;
        case "contact": drawContact(ctx, w, h, tt, dpr, dark); break;
      }
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [type]);

  return <canvas ref={ref} className={className ?? "section-canvas"} aria-hidden="true" />;
}

// ─── Hex pattern for inside feature cards ─────────────────────────────────
export function CardHexCanvas({ hue, className }: { hue: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const start = performance.now();
    let animId = 0;

    const draw = (now: number) => {
      const tt = (now - start) * 0.001;
      const w = canvas.width;
      const h = canvas.height;
      const dpr = devicePixelRatio;
      const dark = document.documentElement.dataset.theme === "dark";
      ctx.clearRect(0, 0, w, h);

      const SIZE = 20 * dpr;
      const H_STEP = SIZE * Math.sqrt(3);
      const V_STEP = SIZE * 1.5;
      const cols = Math.ceil(w / H_STEP) + 2;
      const rows = Math.ceil(h / V_STEP) + 2;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const cx = col * H_STEP + (row % 2 === 0 ? 0 : H_STEP / 2);
          const cy = row * V_STEP;
          const seed = ((row * 31 + col * 17) & 0x7fff) % 100;
          const phase = (tt * 0.38 + seed * 0.063) % 1;
          const active = phase > 0.82 ? (phase - 0.82) / 0.18 : 0;
          const base = dark ? 0.07 : 0.055;
          const peak = dark ? 0.42 : 0.32;
          const alpha = base + active * (peak - base);

          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = cx + (SIZE - 2.5 * dpr) * Math.cos(a);
            const py = cy + (SIZE - 2.5 * dpr) * Math.sin(a);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.strokeStyle = `hsla(${hue + seed % 30 - 15}, 72%, ${dark ? 62 : 52}%, ${alpha * 2.2})`;
          ctx.lineWidth = (0.9 + active * 1.4) * dpr;
          ctx.stroke();

          if (active > 0.25) {
            ctx.fillStyle = `hsla(${hue}, 75%, ${dark ? 65 : 55}%, ${active * (dark ? 0.14 : 0.1)})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, 2.5 * dpr * active, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${hue}, 85%, ${dark ? 72 : 62}%, ${active * 0.75})`;
            ctx.fill();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, [hue]);

  return <canvas ref={ref} className={className ?? "feature-card-canvas"} aria-hidden="true" />;
}
