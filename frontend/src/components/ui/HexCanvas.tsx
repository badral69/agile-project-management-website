import { useEffect, useRef } from "react";

export function HexCanvas({ className = "hero-hex-canvas" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    const startTime = performance.now();

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const SIZE   = 30;
    const H_STEP = SIZE * Math.sqrt(3);
    const V_STEP = SIZE * 1.5;

    function drawHex(cx: number, cy: number, r: number) {
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const a  = (Math.PI / 3) * i - Math.PI / 6;
        const px = cx + r * Math.cos(a);
        const py = cy + r * Math.sin(a);
        i === 0 ? ctx!.moveTo(px, py) : ctx!.lineTo(px, py);
      }
      ctx!.closePath();
    }

    const draw = (now: number) => {
      const w    = canvas.width;
      const h    = canvas.height;
      const t    = (now - startTime) / 1000;
      const dpr  = devicePixelRatio;
      const dark = document.documentElement.dataset.theme === "dark";

      ctx.clearRect(0, 0, w, h);

      const cols = Math.ceil(w / (H_STEP * dpr)) + 2;
      const rows = Math.ceil(h / (V_STEP * dpr)) + 2;
      const ocx  = w / 2;
      const ocy  = h / 2;
      const maxD = Math.sqrt(ocx * ocx + ocy * ocy);

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const px   = (col * H_STEP + (row % 2 === 0 ? 0 : H_STEP / 2)) * dpr;
          const py   = row * V_STEP * dpr;
          const dist = Math.sqrt((px - ocx) ** 2 + (py - ocy) ** 2);
          const nd   = dist / maxD;
          const wave = Math.sin(t * 0.9 - nd * 7) * 0.5 + 0.5;
          const base = Math.max(0, 0.55 - nd * 0.45);

          let hue: number, sat: number, light: number, alpha: number, lw: number;

          if (dark) {
            hue   = 215 + wave * 55;
            sat   = 65  + wave * 25;
            light = 52  + wave * 24;
            alpha = base * (0.25 + wave * 0.75);
            lw    = (0.6 + wave * 0.9) * dpr;
          } else {
            // light mode: vibrant pink/purple
            hue   = 300 + wave * 60;   // pink → purple → rose
            sat   = 72  + wave * 22;
            light = 50  + wave * 18;
            alpha = base * (0.22 + wave * 0.32);
            lw    = (0.8 + wave * 1.0) * dpr;
          }

          ctx.strokeStyle = `hsla(${hue},${sat}%,${light}%,${alpha})`;
          ctx.lineWidth   = lw;
          drawHex(px, py, (SIZE - 3) * dpr);
          ctx.stroke();

          if (nd < 0.28 && wave > 0.68) {
            const fillAlpha = dark ? alpha * 0.07 : alpha * 0.1;
            ctx.fillStyle = `hsla(${hue},${sat}%,${light}%,${fillAlpha})`;
            drawHex(px, py, (SIZE - 3) * dpr);
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    animId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
