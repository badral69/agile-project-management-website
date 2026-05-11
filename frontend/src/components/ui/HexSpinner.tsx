export function HexSpinner({ size = 44, label }: { size?: number; label?: string }) {
  const r = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");

  return (
    <div className="hex-spinner-wrap" role="status" aria-label={label ?? "Loading"}>
      <svg
        className="hex-spinner-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
      >
        <defs>
          <linearGradient id="hsg" x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0" />
            <stop offset="32%" stopColor="#8B5CF6" />
            <stop offset="72%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={pts}
          stroke="url(#hsg)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label ? <span className="hex-spinner-label">{label}</span> : null}
    </div>
  );
}
