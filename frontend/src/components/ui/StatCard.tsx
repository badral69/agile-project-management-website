import { useEffect, useState } from "react";

function useCountUp(target: number, duration = 700) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return count;
}

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  accent?: string;
};

function StatCardInner({ label, value, hint, icon, accent }: StatCardProps) {
  const animated = useCountUp(typeof value === "number" ? value : 0);
  const display = typeof value === "number" ? animated : value;

  return (
    <article
      className="stat-card"
      style={accent ? ({ "--stat-accent": accent } as React.CSSProperties) : undefined}
    >
      {icon ? <div className="stat-card-icon">{icon}</div> : null}
      <span className="eyebrow">{label}</span>
      <strong>{display}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}

export function StatCard(props: StatCardProps) {
  return <StatCardInner {...props} />;
}
