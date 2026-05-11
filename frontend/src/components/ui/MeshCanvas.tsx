import { useEffect, useRef } from "react";

const COLS = 22;
const ROWS = 14;
const AMP  = 11; // wave amplitude in CSS px

export function MeshCanvas({ className }: { className?: string }) {
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

    const start = performance.now();
    let animId  = 0;

    const draw = (now: number) => {
      const t    = (now - start) * 0.001;
      const w    = canvas.width;
      const h    = canvas.height;
      const dpr  = devicePixelRatio;
      const dark = document.documentElement.dataset.theme === "dark";
      const amp  = AMP * dpr;

      ctx.clearRect(0, 0, w, h);

      const cw = w / (COLS - 1);
      const ch = h / (ROWS - 1);

      const gx: number[][] = [];
      const gy: number[][] = [];
      for (let r = 0; r < ROWS; r++) {
        gx[r] = [];
        gy[r] = [];
        for (let c = 0; c < COLS; c++) {
          gx[r][c] = c * cw + Math.sin(t * 0.38 + c * 0.62 + r * 0.41) * amp;
          gy[r][c] = r * ch + Math.cos(t * 0.29 + r * 0.73 + c * 0.37) * amp;
        }
      }

      // Dark: blue mesh. Light: pink/rose mesh
      const lineA = dark ? 0.22 : 0.28;
      const dotA  = dark ? 0.38 : 0.55;
      const hue   = dark ? 212 : 330; // blue vs pink

      ctx.lineWidth = 0.85 * dpr;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 1; c++) {
          // Animate hue slightly along the grid for a gradient feel
          const h = hue + (dark ? 0 : Math.sin(t * 0.2 + r * 0.3) * 20);
          ctx.beginPath();
          ctx.moveTo(gx[r][c], gy[r][c]);
          ctx.lineTo(gx[r][c + 1], gy[r][c + 1]);
          ctx.strokeStyle = `hsla(${h},${dark ? 68 : 75}%,${dark ? 62 : 58}%,${lineA})`;
          ctx.stroke();
        }
      }

      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 1; r++) {
          const h = hue + (dark ? 0 : Math.sin(t * 0.2 + c * 0.3) * 20);
          ctx.beginPath();
          ctx.moveTo(gx[r][c], gy[r][c]);
          ctx.lineTo(gx[r + 1][c], gy[r + 1][c]);
          ctx.strokeStyle = `hsla(${h},${dark ? 68 : 75}%,${dark ? 62 : 58}%,${lineA})`;
          ctx.stroke();
        }
      }

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const h = hue + (dark ? 0 : Math.sin(t * 0.15 + r * 0.4 + c * 0.3) * 25);
          ctx.beginPath();
          ctx.arc(gx[r][c], gy[r][c], 1.6 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${h},${dark ? 72 : 80}%,${dark ? 66 : 55}%,${dotA})`;
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className={className ?? "mesh-canvas"} aria-hidden="true" />;
}
