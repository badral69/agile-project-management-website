import { useEffect, useRef } from "react";

const COUNT = 72;
const CONNECT_PX = 130;

type Pt = { x: number; y: number; vx: number; vy: number };

export function ConstellationCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const pts: Pt[] = Array.from({ length: COUNT }, () => ({
      x:  Math.random(),
      y:  Math.random(),
      vx: (Math.random() - 0.5) * 0.0004,
      vy: (Math.random() - 0.5) * 0.0004,
    }));

    let animId = 0;

    const draw = () => {
      const w   = canvas.width;
      const h   = canvas.height;
      const dpr = devicePixelRatio;
      const con = CONNECT_PX * dpr;

      ctx.clearRect(0, 0, w, h);

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > 1) { p.x = 1; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > 1) { p.y = 1; p.vy *= -1; }
      }

      ctx.lineWidth = 0.9 * dpr;
      for (let i = 0; i < pts.length; i++) {
        const ax = pts[i].x * w;
        const ay = pts[i].y * h;
        for (let j = i + 1; j < pts.length; j++) {
          const bx = pts[j].x * w;
          const by = pts[j].y * h;
          const d  = Math.hypot(ax - bx, ay - by);
          if (d < con) {
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = `rgba(147,197,253,${(1 - d / con) * 0.5})`;
            ctx.stroke();
          }
        }
      }

      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 1.8 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(186,230,253,0.85)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className={className ?? "constellation-canvas"} aria-hidden="true" />;
}
