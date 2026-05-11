import { ArrowRight, Building2, CalendarDays, Check, ChevronDown, ClipboardList, ExternalLink, FolderPlus, Languages, Layers, Menu, Minus, Moon, Rocket, Search, Send, Sparkles, Sun, TrendingUp, UserPlus, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AiSearchPanel } from "../components/search/AiSearchPanel";
import { ConstellationCanvas } from "../components/ui/ConstellationCanvas";
import { HexCanvas } from "../components/ui/HexCanvas";
import { SectionCanvas } from "../components/ui/SectionCanvas";
import { LanguageSwitcher } from "../components/ui/LanguageSwitcher";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n } from "../features/i18n/I18nContext";
import { api, getErrorMessage } from "../lib/api";
import { pricingPlans } from "../lib/pricing";

type ThemeMode = "light" | "dark";


const HERO_TABS = ["Dashboard", "Kanban", "Gantt", "AI"] as const;
type HeroTab = typeof HERO_TABS[number];

function HeroDashboard() {
  return (
    <div className="hm-screen" key="dashboard">
      <div className="hm-page-header">
        <div><div className="hm-eyebrow">Overview</div><div className="hm-title">Dashboard</div></div>
        <div className="hm-pill hm-pill-blue">Admin</div>
      </div>
      <div className="hm-stats">
        {[{v:"8",l:"Projects",c:"#2563eb"},{v:"34",l:"Tasks",c:"#7c3aed"},{v:"2",l:"Overdue",c:"#dc2626"},{v:"12",l:"Members",c:"#059669"}].map(s=>(
          <div key={s.l} className="hm-stat-card" style={{"--stat-c":s.c} as CSSProperties}>
            <strong>{s.v}</strong><span>{s.l}</span>
          </div>
        ))}
      </div>
      <div className="hm-modules">
        {["Work distribution","Deadlines","Assigned to you","Recent projects"].map((m,i)=>(
          <div key={m} className="hm-module-btn" style={{animationDelay:`${i*0.08}s`}}>{m}</div>
        ))}
      </div>
      <div className="hm-activity">
        {["Auth flow updated · 2m ago","Sprint 4 created · 14m ago","Login UI moved to Review · 1h ago"].map(a=>(
          <div key={a} className="hm-activity-row"><div className="hm-activity-dot"/><span>{a}</span></div>
        ))}
      </div>
    </div>
  );
}

function HeroKanban() {
  const cols = [
    {label:"Backlog",c:"#6366f1",tasks:["Auth flow","API docs"]},
    {label:"In Progress",c:"#3b82f6",tasks:["Dashboard","Settings"]},
    {label:"Review",c:"#f59e0b",tasks:["Login UI"]},
    {label:"Done",c:"#10b981",tasks:["CI/CD","Setup"]},
  ];
  return (
    <div className="hm-screen" key="kanban">
      <div className="hm-page-header">
        <div><div className="hm-eyebrow">Sprint 4 · Active</div><div className="hm-title">Project Board</div></div>
        <div className="hm-pill hm-pill-orange">Active sprint</div>
      </div>
      <div className="hm-kanban">
        {cols.map(col=>(
          <div key={col.label} className="hm-k-col">
            <div className="hm-k-head" style={{color:col.c}}>{col.label} <span>{col.tasks.length}</span></div>
            {col.tasks.map(t=>(
              <div key={t} className="hm-k-card" style={{borderTop:`2px solid ${col.c}`}}>{t}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroGantt() {
  const sprints = [
    {name:"Sprint 3",start:0,span:8,c:"#059669",tasks:["Setup","CI/CD"]},
    {name:"Sprint 4",start:8,span:10,c:"#e07b39",tasks:["Dashboard","Auth flow","Login UI"]},
  ];
  const cols = 18;
  return (
    <div className="hm-screen" key="gantt">
      <div className="hm-page-header">
        <div><div className="hm-eyebrow">Timeline view</div><div className="hm-title">Gantt Chart</div></div>
        <div className="hm-pill hm-pill-green">2 sprints</div>
      </div>
      <div className="hm-gantt">
        <div className="hm-gantt-names">
          {sprints.map(s=>[
            <div key={s.name} className="hm-gname hm-gname-sprint">{s.name}</div>,
            ...s.tasks.map(t=><div key={t} className="hm-gname hm-gname-task">{t}</div>)
          ])}
        </div>
        <div className="hm-gantt-grid">
          <div className="hm-gantt-header">
            {Array.from({length:cols},(_,i)=>(
              <div key={i} className="hm-gcell-head">{i+1}</div>
            ))}
          </div>
          {sprints.map(s=>[
            <div key={s.name} className="hm-gantt-row">
              {Array.from({length:cols},(_,i)=>(
                <div key={i} className={`hm-gcell${i>=s.start&&i<s.start+s.span?" hm-gcell-fill":""}`}
                  style={i>=s.start&&i<s.start+s.span?{background:s.c}:{}} />
              ))}
            </div>,
            ...s.tasks.map(t=>(
              <div key={t} className="hm-gantt-row">
                {Array.from({length:cols},(_,i)=>(
                  <div key={i} className={`hm-gcell${i>=s.start&&i<s.start+s.span?" hm-gcell-task":""}`}
                    style={i>=s.start&&i<s.start+s.span?{background:`${s.c}55`}:{}} />
                ))}
              </div>
            ))
          ])}
        </div>
      </div>
    </div>
  );
}

function HeroAI() {
  return (
    <div className="hm-screen" key="ai">
      <div className="hm-page-header">
        <div><div className="hm-eyebrow">Claude AI · Sprint planner</div><div className="hm-title">AI Assistant</div></div>
        <div className="hm-pill hm-pill-purple">Pro</div>
      </div>
      <div className="hm-ai">
        <div className="hm-ai-msg hm-ai-user">Plan a sprint for user authentication with Google OAuth and JWT</div>
        <div className="hm-ai-msg hm-ai-bot">
          <span className="hm-ai-label">SprintFlow AI</span>
          Generated 4 tasks for Sprint 5:
        </div>
        {["Design login & register UI","Build JWT auth middleware","Add Google OAuth flow","Write E2E auth tests"].map((t,i)=>(
          <div key={t} className="hm-ai-task" style={{animationDelay:`${0.3+i*0.2}s`}}>
            <div className="hm-ai-dot" style={{background:["#3b82f6","#10b981","#f59e0b","#8b5cf6"][i]}}/>
            <span>{t}</span>
            <div className="hm-ai-badge">TASK</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductMockup() {
  const [tab, setTab] = useState<HeroTab>("Dashboard");

  useEffect(() => {
    const cycle: HeroTab[] = ["Dashboard","Kanban","Gantt","AI"];
    let i = cycle.indexOf(tab);
    const timer = setInterval(() => {
      i = (i + 1) % cycle.length;
      setTab(cycle[i]);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hero-mockup-wrap hero-mockup-float">
      <div className="mockup-browser">
        <div className="mockup-chrome">
          <div className="mockup-dots"><span /><span /><span /></div>
          <div className="mockup-url">app.sprintflow.io/workspace</div>
        </div>
        <div className="mockup-body mockup-body-col" style={{padding:0,overflow:"hidden"}}>
          <div className="hm-topnav">
            <span className="hm-brand">SprintFlow</span>
            {(["Dashboard","Projects","Tasks","Gantt","Team"] as string[]).map(l=>(
              <span key={l} className={`hm-nav-link${l===tab||(l==="Dashboard"&&tab==="Dashboard")||(l==="Tasks"&&tab==="Kanban")||(l==="Gantt"&&tab==="Gantt")||(l==="Dashboard"&&tab==="AI")?" hm-nav-active":""}`}>{l}</span>
            ))}
            <span style={{flex:1}}/>
            <div className="hm-avatar"/>
          </div>
          <div className="hm-body">
            {tab==="Dashboard" && <HeroDashboard/>}
            {tab==="Kanban"    && <HeroKanban/>}
            {tab==="Gantt"     && <HeroGantt/>}
            {tab==="AI"        && <HeroAI/>}
          </div>
          <div className="hm-tabs">
            {HERO_TABS.map(t=>(
              <button key={t} type="button" className={`hm-tab${tab===t?" hm-tab-active":""}`} onClick={()=>setTab(t)}>{t}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsMockup() {
  const projects = [
    { name: "Q2 Roadmap", sprint: "Sprint 7", status: "Active", color: "#3b82f6", progress: 78 },
    { name: "Mobile App v2", sprint: "Sprint 3", status: "Active", color: "#10b981", progress: 54 },
    { name: "Design System", sprint: "Sprint 5", status: "Review", color: "#f59e0b", progress: 91 },
    { name: "API Refactor", sprint: "Sprint 1", status: "Planning", color: "#8b5cf6", progress: 18 },
  ];

  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-label">Projects</span>
        <div className="mm-pill mm-blue">4 active</div>
      </div>
      <div className="mm-project-list">
        {projects.map((p, index) => (
          <div key={p.name} className="mm-project-row">
            <div className="mm-dot" style={{ background: p.color }} />
            <div className="mm-project-info">
              <span className="mm-pname">{p.name}</span>
              <span className="mm-psprint">{p.sprint}</span>
            </div>
            <div className="mm-status" style={{ color: p.color, background: `${p.color}22` }}>
              {p.status}
            </div>
            <div className="mm-prog-track">
              <div
                className="mm-prog-fill mm-prog-fill-animated"
                style={
                  {
                    "--target-width": `${p.progress}%`,
                    "--fill-color": p.color,
                    "--fill-delay": `${index * 0.38}s`,
                  } as CSSProperties
                }
              />
            </div>
            <span className="mm-prog-pct">{p.progress}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskBoardMockup() {
  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-label">Task Board</span>
        <div className="mm-pill mm-green">Sprint 7</div>
      </div>
      <div className="mm-kanban mm-kanban-animated">
        <div className="mm-col">
          <div className="mm-col-head" style={{ color: "#94a3b8" }}>
            BACKLOG <span>3</span>
          </div>
          {["Auth redesign", "API docs", "E2E tests"].map((t) => (
            <div key={t} className="mm-task-card" style={{ borderTop: "2px solid #6366f1" }}>
              {t}
            </div>
          ))}
        </div>
        <div className="mm-col">
          <div className="mm-col-head" style={{ color: "#60a5fa" }}>
            IN DEV <span>2</span>
          </div>
          {["Dashboard", "Settings"].map((t) => (
            <div
              key={t}
              className={t === "Dashboard" ? "mm-task-card mm-task-card-source" : "mm-task-card"}
              style={{ borderTop: "2px solid #3b82f6" }}
            >
              {t}
            </div>
          ))}
        </div>
        <div className="mm-col">
          <div className="mm-col-head" style={{ color: "#fbbf24" }}>
            REVIEW <span>1</span>
          </div>
          {["Login UI"].map((t) => (
            <div key={t} className="mm-task-card" style={{ borderTop: "2px solid #f59e0b" }}>
              {t}
            </div>
          ))}
        </div>
        <div className="mm-col">
          <div className="mm-col-head" style={{ color: "#34d399" }}>
            DONE <span>4</span>
          </div>
          {["CI/CD", "Setup"].map((t) => (
            <div key={t} className="mm-task-card" style={{ borderTop: "2px solid #10b981" }}>
              {t}
            </div>
          ))}
        </div>
        <div className="mm-drag-card" aria-hidden="true">
          Dashboard
        </div>
        <div className="mm-drop-pulse" aria-hidden="true" />
      </div>
    </div>
  );
}

function TeamPlannerMockup() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const slotColor = (s: string) =>
    s === "S1" ? "#3b82f6" : s === "S2" ? "#10b981" : s === "S3" ? "#8b5cf6" : s === "Mtg" ? "#f59e0b" : "#ec4899";
  const members = [
    { name: "Anu M.", initial: "A", color: "#3b82f6", slots: ["S1", "S1", "Mtg", "S2", "S2"] },
    { name: "Temuulen", initial: "T", color: "#10b981", slots: ["S2", "S2", "S2", "", "S3"] },
    { name: "Sara D.", initial: "S", color: "#f59e0b", slots: ["Des", "Des", "", "Des", "Des"] },
  ];

  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-label">Team Planner</span>
        <div className="mm-pill mm-amber">Week 17</div>
      </div>
      <div className="mm-planner">
        <div className="mm-planner-head">
          <div className="mm-ph-name" />
          {days.map((d) => (
            <div key={d} className="mm-ph-day">
              {d}
            </div>
          ))}
        </div>
        {members.map((m, rowIndex) => (
          <div key={m.name} className="mm-planner-row">
            <div className="mm-planner-member">
              <div className="mm-av" style={{ background: m.color }}>
                {m.initial}
              </div>
              <span>{m.name}</span>
            </div>
            {m.slots.map((slot, i) => (
              <div key={i} className="mm-slot">
                {slot ? (
                  <div
                    className="mm-slot-block mm-slot-block-animated"
                    style={
                      {
                        background: `${slotColor(slot)}28`,
                        color: slotColor(slot),
                        borderLeft: `2px solid ${slotColor(slot)}`,
                        "--slot-delay": `${(rowIndex * 5 + i) * 0.16}s`,
                      } as CSSProperties
                    }
                  >
                    {slot}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AiMockup() {
  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-label">AI Assistant</span>
        <div className="mm-pill mm-blue">Claude AI</div>
      </div>
      <div className="mm-ai-chat">
        <div className="mm-ai-bubble user">Plan a sprint for user auth feature</div>
        <div className="mm-ai-bubble assistant mm-ai-bubble-animated">
          <span className="mm-ai-label">SprintFlow AI</span>
          Generated 4 tasks for your sprint:
        </div>
        {["Design login UI", "Build JWT auth", "Write E2E tests", "Deploy to staging"].map((t, i) => (
          <div
            key={t}
            className="mm-ai-task-row mm-ai-task-row-animated"
            style={{ "--task-delay": `${0.5 + i * 0.32}s` } as CSSProperties}
          >
            <div className="mm-dot" style={{ background: ["#3b82f6","#10b981","#8b5cf6","#f59e0b"][i] }} />
            <span>{t}</span>
            <div className="mm-ai-pill">TASK</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceMockup() {
  const velocities = [18, 24, 21, 28, 25, 32];
  const maxV = 32;

  return (
    <div className="mm-wrap">
      <div className="mm-bar">
        <span className="mm-label">Analytics</span>
        <div className="mm-pill mm-purple">Q2 2025</div>
      </div>
      <div className="mm-metrics">
        <div className="mm-metric">
          <strong>84</strong>
          <span>Tasks done</span>
        </div>
        <div className="mm-metric">
          <strong>2.3d</strong>
          <span>Avg cycle</span>
        </div>
        <div className="mm-metric">
          <strong>96%</strong>
          <span>On time</span>
        </div>
      </div>
      <div className="mm-chart-lbl">Sprint velocity</div>
      <div className="mm-barchart">
        {velocities.map((v, i) => (
          <div key={i} className="mm-bar-col">
            <div
              className="mm-bar mm-bar-animated"
              style={
                {
                  "--bar-height": `${(v / maxV) * 56}px`,
                  "--bar-delay": `${i * 0.18}s`,
                  background: i === velocities.length - 1 ? "linear-gradient(180deg,#a78bfa,#7c3aed)" : "rgba(139,92,246,0.3)",
                } as CSSProperties
              }
            />
            <span className="mm-bar-lbl">S{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCards() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  const cards = [
    {
      title: t("home.showcase.projects.title"),
      subtitle: t("home.showcase.projects.subtitle"),
      bullets: [t("home.showcase.projects.bullet1"), t("home.showcase.projects.bullet2"), t("home.showcase.projects.bullet3")],
      color: "#2563eb",
      hue: 221,
      Icon: Layers,
      route: "/workspace/projects",
      guestLabel: t("home.showcase.projects.cta"),
      Mockup: ProjectsMockup,
    },
    {
      title: t("home.showcase.tasks.title"),
      subtitle: t("home.showcase.tasks.subtitle"),
      bullets: [t("home.showcase.tasks.bullet1"), t("home.showcase.tasks.bullet2"), t("home.showcase.tasks.bullet3")],
      color: "#059669",
      hue: 162,
      Icon: ClipboardList,
      route: "/workspace/tasks",
      guestLabel: t("home.showcase.tasks.cta"),
      Mockup: TaskBoardMockup,
    },
    {
      title: t("home.showcase.team.title"),
      subtitle: t("home.showcase.team.subtitle"),
      bullets: [t("home.showcase.team.bullet1"), t("home.showcase.team.bullet2"), t("home.showcase.team.bullet3")],
      color: "#d97706",
      hue: 38,
      Icon: CalendarDays,
      route: "/workspace/team",
      guestLabel: t("home.showcase.team.cta"),
      requiresRole: "ADMIN" as const,
      Mockup: TeamPlannerMockup,
    },
    {
      title: t("home.showcase.analytics.title"),
      subtitle: t("home.showcase.analytics.subtitle"),
      bullets: [t("home.showcase.analytics.bullet1"), t("home.showcase.analytics.bullet2"), t("home.showcase.analytics.bullet3")],
      color: "#7c3aed",
      hue: 263,
      Icon: TrendingUp,
      route: "/workspace/performance",
      guestLabel: t("home.showcase.analytics.cta"),
      requiresRole: "ADMIN" as const,
      Mockup: PerformanceMockup,
    },
    {
      title: t("home.showcase.ai.title"),
      subtitle: t("home.showcase.ai.subtitle"),
      bullets: [t("home.showcase.ai.bullet1"), t("home.showcase.ai.bullet2"), t("home.showcase.ai.bullet3")],
      color: "#0ea5e9",
      hue: 200,
      Icon: Sparkles,
      route: "/workspace/projects",
      guestLabel: t("home.showcase.ai.cta"),
      Mockup: AiMockup,
    },
  ];

  return (
    <div className="feature-showcase">
      {cards.map(({ title, subtitle, bullets, color, Icon, route, Mockup, guestLabel }, index) => (
        <Link
          key={index}
          className={`feature-showcase-row reveal reveal-delay-${(index % 4) + 1}${index % 2 === 1 ? " reverse" : ""}`}
          to={route}
          style={{ "--feat-color": color } as CSSProperties}
        >
          <div className="feature-showcase-copy">
            <div className="feature-showcase-num">0{index + 1}</div>
            <div className="hex-icon-wrap" style={{ "--feat-color": color } as CSSProperties}>
              <div className="hex-icon-badge">
                <Icon size={22} />
              </div>
            </div>
            <h3 className="feature-showcase-title">{title}</h3>
            <p className="feature-showcase-sub">{subtitle}</p>
            <ul className="feature-showcase-bullets">
              {bullets.map((b) => (
                <li key={b}>
                  <Check size={13} />
                  {b}
                </li>
              ))}
            </ul>
            <div className="feature-showcase-cta">
              {isAuthenticated ? `${t("home.showcase.open")} ${title}` : guestLabel}
              <ArrowRight size={15} />
            </div>
          </div>
          <div className="feature-showcase-mockup" style={{ "--feat-color": color } as CSSProperties}>
            <Mockup />
          </div>
        </Link>
      ))}
    </div>
  );
}


function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const { t } = useI18n();
  const steps = [
    {
      number: "01",
      Icon: FolderPlus,
      title: t("home.how.1.title"),
      description: t("home.how.1.desc"),
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      number: "02",
      Icon: UserPlus,
      title: t("home.how.2.title"),
      description: t("home.how.2.desc"),
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      number: "03",
      Icon: Rocket,
      title: t("home.how.3.title"),
      description: t("home.how.3.desc"),
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      number: "04",
      Icon: TrendingUp,
      title: t("home.how.4.title"),
      description: t("home.how.4.desc"),
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
    },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="hiw-stack-card reveal">
      <div className="hiw-stack-main">
        <div className="hiw-deck">
          {steps.map((step, index) => {
            const Icon = step.Icon;
            const offset = (index - activeStep + steps.length) % steps.length;
            const stateClass =
              offset === 0 ? "front" : offset === 1 ? "mid" : offset === 2 ? "back" : "far";

            return (
              <article
                key={step.number}
                className={`hiw-deck-card ${stateClass}`}
                style={{ "--step-color": step.color, "--step-bg": step.bg } as CSSProperties}
                onClick={() => {
                  if (offset === 0) {
                    setActiveStep((current) => (current + 1) % steps.length);
                    return;
                  }

                  setActiveStep(index);
                }}
              >
                <div className="hiw-card-topline">
                  <div className="hex-icon-wrap" style={{ "--feat-color": step.color } as CSSProperties}>
                    <div className="hex-icon-badge">
                      <Icon size={22} />
                    </div>
                  </div>
                  <div className="hiw-step-num" style={{ color: step.color }}>
                    {step.number}
                  </div>
                </div>

                <div className="hiw-deck-content">
                  <strong className="hiw-title">{step.title}</strong>
                  <p className="hiw-desc">{step.description}</p>
                </div>

                <div className="hiw-card-bottomline">
                  <span className="hiw-step-caption">Step {step.number}</span>
                  {offset === 0 ? <ArrowRight size={16} className="hiw-next-icon" aria-hidden="true" /> : null}
                </div>
              </article>
            );
          })}

          <div className="hiw-progress-track" aria-hidden="true">
            <span
              className="hiw-progress-fill"
              style={{ width: `${((activeStep + 1) / steps.length) * 100}%`, background: steps[activeStep].color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCapabilityCell(value: string, highlight = false) {
  const normalized = value.toLowerCase();

  if (normalized === "yes" || normalized === "unlimited") {
    return (
      <span className={highlight ? "table-badge table-badge-yes strong" : "table-badge table-badge-yes"}>
        <Check size={14} />
        {value}
      </span>
    );
  }

  if (normalized === "no") {
    return (
      <span className="table-badge table-badge-no">
        <X size={14} />
        {value}
      </span>
    );
  }

  if (normalized === "partial" || normalized === "limited" || normalized === "basic" || normalized === "complex") {
    return (
      <span className="table-badge table-badge-partial">
        <Minus size={14} />
        {value}
      </span>
    );
  }

  if (normalized === "add-on" || normalized === "optional" || normalized === "unlimited") {
    return <span className="table-badge table-badge-addon">{value}</span>;
  }

  return <span className={highlight ? "table-badge table-badge-text strong" : "table-badge table-badge-text"}>{value}</span>;
}

function TrustStrip() {
  const { t } = useI18n();
  const badges = [
    t("home.trust.aiPlanner"),
    t("home.trust.voice"),
    t("home.trust.roles"),
    t("home.trust.kanban"),
    t("home.trust.multilingual"),
    t("home.trust.google"),
  ];

  return (
    <div className="trust-strip">
      {badges.map((label) => (
        <span key={label} className="trust-badge">
          <Check size={13} />
          {label}
        </span>
      ))}
    </div>
  );
}

function ComparisonTable() {
  const { t } = useI18n();
  const rows = [
    { feature: t("home.comparison.row1.feat"), sprintflow: t("home.comparison.row1.sf"), jira: t("home.comparison.row1.jira"), trello: t("home.comparison.row1.trello") },
    { feature: t("home.comparison.row2.feat"), sprintflow: t("home.comparison.row2.sf"), jira: t("home.comparison.row2.jira"), trello: t("home.comparison.row2.trello") },
    { feature: t("home.comparison.row3.feat"), sprintflow: t("home.comparison.row3.sf"), jira: t("home.comparison.row3.jira"), trello: t("home.comparison.row3.trello") },
    { feature: t("home.comparison.row4.feat"), sprintflow: t("home.comparison.row4.sf"), jira: t("home.comparison.row4.jira"), trello: t("home.comparison.row4.trello") },
    { feature: t("home.comparison.row5.feat"), sprintflow: t("home.comparison.row5.sf"), jira: t("home.comparison.row5.jira"), trello: t("home.comparison.row5.trello") },
    { feature: t("home.comparison.row6.feat"), sprintflow: t("home.comparison.row6.sf"), jira: t("home.comparison.row6.jira"), trello: t("home.comparison.row6.trello") },
  ];

  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>{t("home.comparison.col.capability")}</th>
            <th>SprintFlow</th>
            <th>Jira</th>
            <th>Trello</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature}>
              <td>{row.feature}</td>
              <td>{renderCapabilityCell(row.sprintflow, true)}</td>
              <td>{renderCapabilityCell(row.jira)}</td>
              <td>{renderCapabilityCell(row.trello)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PricingMatrix() {
  const { t } = useI18n();
  const rows = [
    [t("home.matrix.row1"), t("home.matrix.row1.free"), t("home.matrix.row1.pro"), t("home.matrix.row1.custom")],
    [t("home.matrix.row2"), t("home.matrix.row2.free"), t("home.matrix.row2.pro"), t("home.matrix.row2.custom")],
    [t("home.matrix.row3"), t("home.matrix.row3.free"), t("home.matrix.row3.pro"), t("home.matrix.row3.custom")],
    [t("home.matrix.row4"), t("home.matrix.row4.free"), t("home.matrix.row4.pro"), t("home.matrix.row4.custom")],
    [t("home.matrix.row5"), t("home.matrix.row5.free"), t("home.matrix.row5.pro"), t("home.matrix.row5.custom")],
    [t("home.matrix.row6"), t("home.matrix.row6.free"), t("home.matrix.row6.pro"), t("home.matrix.row6.custom")],
    [t("home.matrix.row7"), t("home.matrix.row7.free"), t("home.matrix.row7.pro"), t("home.matrix.row7.custom")],
    [t("home.matrix.row8"), t("home.matrix.row8.free"), t("home.matrix.row8.pro"), t("home.matrix.row8.custom")],
    [t("home.matrix.row9"), t("home.matrix.row9.free"), t("home.matrix.row9.pro"), t("home.matrix.row9.custom")],
  ];

  return (
    <div className="pricing-matrix-wrap">
      <table className="pricing-matrix">
        <thead>
          <tr>
            <th>{t("home.matrix.col.feature")}</th>
            <th>{t("home.matrix.col.free")}</th>
            <th>{t("home.matrix.col.pro")}</th>
            <th>{t("home.matrix.col.custom")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([feature, starter, professional, enterprise]) => (
            <tr key={feature}>
              <td>{feature}</td>
              <td>{renderCapabilityCell(starter)}</td>
              <td>{renderCapabilityCell(professional, true)}</td>
              <td>{renderCapabilityCell(enterprise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BottomCTA() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();

  return (
    <section className="bottom-cta-section">
      <ConstellationCanvas className="footer-hex-canvas" />
      <div className="bottom-cta-wrap">
        <div className="bottom-cta-inner">
          <span className="eyebrow" style={{ color: "#7dd3fc" }}>{t("home.cta.eyebrow")}</span>
          <h2 className="bottom-cta-heading">{t("home.cta.heading")}</h2>
          <p className="bottom-cta-sub">{t("home.cta.sub")}</p>
          <div className="bottom-cta-buttons">
            <Link className="primary-button bottom-cta-btn" to={isAuthenticated ? "/workspace" : "/register"}>
              {t("home.cta.primary")} <ArrowRight size={16} />
            </Link>
            <a className="ghost-button bottom-cta-ghost" href="#contact">
              {t("home.cta.secondary")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const { t } = useI18n();
  const items = [
    {
      quote: t("home.testimonial.1.quote"),
      name: t("home.testimonial.1.name"),
      role: t("home.testimonial.1.role"),
      initials: "SK",
      color: "#2563eb",
    },
    {
      quote: t("home.testimonial.2.quote"),
      name: t("home.testimonial.2.name"),
      role: t("home.testimonial.2.role"),
      initials: "MT",
      color: "#059669",
    },
    {
      quote: t("home.testimonial.3.quote"),
      name: t("home.testimonial.3.name"),
      role: t("home.testimonial.3.role"),
      initials: "AR",
      color: "#7c3aed",
    },
  ];
  return (
    <div className="testimonials-grid">
      {items.map((item) => (
        <article key={item.name} className="testimonial-card">
          <div className="testimonial-stars">★★★★★</div>
          <p className="testimonial-quote">{item.quote}</p>
          <div className="testimonial-author">
            <div className="testimonial-avatar" style={{ background: item.color }}>{item.initials}</div>
            <div>
              <strong>{item.name}</strong>
              <p>{item.role}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function useScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const { locale, t } = useI18n();
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [openFaq, setOpenFaq] = useState(-1);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    message: "",
  });
  const [contactState, setContactState] = useState<{ loading: boolean; error: string; success: string }>({
    loading: false,
    error: "",
    success: "",
  });
  const headerControlsRef = useRef<HTMLDivElement | null>(null);

  useScrollReveal();

  const faqs = useMemo(
    () => [
      { question: t("home.faq.1.question"), answer: t("home.faq.1.answer") },
      { question: t("home.faq.2.question"), answer: t("home.faq.2.answer") },
      { question: t("home.faq.3.question"), answer: t("home.faq.3.answer") },
      { question: t("home.faq.4.question"), answer: t("home.faq.4.answer") },
      { question: t("home.faq.5.question"), answer: t("home.faq.5.answer") },
      { question: t("home.faq.6.question"), answer: t("home.faq.6.answer") },
    ],
    [t],
  );

  const localizedPlans = useMemo(() => {
    if (locale === "mn") {
      return pricingPlans.map((plan) => {
        if (plan.key === "starter") {
          return { ...plan, priceLabel: "Үнэгүй туршилт", cta: "Үнэгүй турших" };
        }
        if (plan.key === "professional") {
          return { ...plan, cta: "Professional эхлүүлэх" };
        }
        return { ...plan, cta: "Багц тохируулах" };
      });
    }

    if (locale === "ja") {
      return pricingPlans.map((plan) => {
        if (plan.key === "starter") {
          return { ...plan, priceLabel: "無料トライアル", cta: "無料で開始" };
        }
        if (plan.key === "professional") {
          return { ...plan, cta: "Professional を開始" };
        }
        return { ...plan, cta: "プランをカスタマイズ" };
      });
    }

    return pricingPlans;
  }, [locale]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("sprintflow-theme");
    const initialTheme =
      storedTheme === "light" || storedTheme === "dark"
        ? storedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("sprintflow-theme", theme);
  }, [theme]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [isAuthenticated, locale]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!headerControlsRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
        setLanguageOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const submitContactForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setContactState({ loading: true, error: "", success: "" });
      const response = await api.post<{ message: string }>("/public/contact", contactForm);
      setContactState({ loading: false, error: "", success: response.data.message });
      setContactForm({ name: "", email: "", company: "", teamSize: "", message: "" });
    } catch (error) {
      setContactState({ loading: false, error: getErrorMessage(error), success: "" });
    }
  };

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link className="landing-brand" to="/">
            <img className="brand-logo-image hex-logo" src="/sprintflow-logo.svg" alt="SprintFlow logo" />
            <span>
              <strong>SprintFlow</strong>
            </span>
          </Link>
          <button
            type="button"
            className="landing-menu-button"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <nav className={mobileNavOpen ? "landing-nav open" : "landing-nav"}>
            <div className="landing-nav-mobile-links">
              {[
                [t("home.nav.features"), "#features"],
                [t("home.nav.howItWorks"), "#how-it-works"],
                [t("home.nav.pricing"), "#pricing"],
                [t("home.nav.faq"), "#faq"],
                [t("home.nav.contact"), "#contact"],
              ].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMobileNavOpen(false)}>{label}</a>
              ))}
            </div>
            <div className="landing-nav-icons" ref={headerControlsRef}>
              <button
                type="button"
                className={`landing-icon-button${searchOpen ? " active" : ""}`}
                aria-label="Open search"
                onClick={() => {
                  setSearchOpen((current) => !current);
                  setLanguageOpen(false);
                }}
              >
                <Search size={16} />
              </button>
              <button
                type="button"
                className={`landing-icon-button${languageOpen ? " active" : ""}`}
                aria-label="Open language switcher"
                onClick={() => {
                  setLanguageOpen((current) => !current);
                  setSearchOpen(false);
                }}
              >
                <Languages size={16} />
              </button>
              <button
                className="landing-icon-button"
                type="button"
                aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
                onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              </button>

              {searchOpen ? (
                <div className="landing-header-popover landing-search-popover">
                  <AiSearchPanel variant="landing" />
                </div>
              ) : null}

              {languageOpen ? (
                <div className="landing-header-popover landing-language-popover">
                  <LanguageSwitcher compact />
                </div>
              ) : null}
            </div>
            {isAuthenticated ? (
              <Link className="primary-button" to="/workspace" onClick={() => setMobileNavOpen(false)}>
                {t("common.workspace")}
              </Link>
            ) : (
              <>
                <Link className="ghost-button landing-nav-ghost" to="/login" onClick={() => setMobileNavOpen(false)}>
                  {t("home.nav.signIn")}
                </Link>
                <Link className="primary-button" to="/register" onClick={() => setMobileNavOpen(false)}>
                  {t("home.nav.getStarted")}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <HexCanvas />
        <div className="landing-mesh" aria-hidden="true" />
        <div className="landing-particles" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="landing-hero-inner">
          <div className="landing-hero-grid">
            <div className="landing-copy">
              <span className="eyebrow">{t("home.hero.eyebrow")}</span>
              <h1>{t("home.hero.h1")}</h1>
              <p className="hero-value-prop">{t("home.hero.valueProp")}</p>
              <div className="hero-cta-row">
                <Link className="primary-button" to={isAuthenticated ? "/workspace" : "/register"}>
                  {t("home.hero.primaryCta")} <ArrowRight size={16} />
                </Link>
                <a className="ghost-button" href="#features">
                  {t("home.hero.secondaryCta")} <ArrowRight size={16} />
                </a>
              </div>
            </div>
            <ProductMockup />
          </div>
        </div>
        <TrustStrip />
      </section>

      <section className="landing-section reveal" id="how-it-works">
        <SectionCanvas type="flow" className="section-canvas" />
        <div className="landing-section-content">
          <div className="landing-section-header">
            <span className="eyebrow">{t("home.howEyebrow")}</span>
            <h2>{t("home.howTitle")}</h2>
            <p>{t("home.howDesc")}</p>
          </div>
          <HowItWorks />
        </div>
      </section>

      <section className="landing-section alt-bg reveal" id="features">
        <div className="landing-section-content">
          <div className="landing-section-header">
            <span className="eyebrow">{t("home.featEyebrow")}</span>
            <h2>{t("home.featTitle")}</h2>
            <p>{t("home.featDesc")}</p>
          </div>
          <div className="reveal">
            <FeatureCards />
          </div>
        </div>
      </section>

      <section className="landing-section reveal" id="testimonials">
        <div className="landing-section-content">
          <div className="landing-section-header">
            <span className="eyebrow">{t("home.testimonialsEyebrow")}</span>
            <h2>{t("home.testimonialsTitle")}</h2>
            <p>{t("home.testimonialsDescription")}</p>
          </div>
          <TestimonialsSection />
        </div>
      </section>

      <section className="landing-section reveal" id="comparison">
        <div className="landing-section-content">
          <div className="landing-section-header">
            <div>
              <span className="eyebrow">{t("home.comparisonEyebrow")}</span>
              <h2>{t("home.comparisonTitle")}</h2>
            </div>
            <p>{t("home.comparisonDesc")}</p>
          </div>
          <ComparisonTable />
        </div>
      </section>

      <section className="landing-section alt-bg reveal" id="pricing">
        <div className="landing-section-content">
          <div className="landing-section-header">
            <div>
              <span className="eyebrow">{t("home.pricingEyebrow2")}</span>
              <h2>{t("home.pricingTitle2")}</h2>
            </div>
            <p>{t("home.pricingDesc2")}</p>
          </div>

          <div className="pricing-cycle-toggle">
            <button type="button" className={billingCycle === "monthly" ? "cycle-btn active" : "cycle-btn"} onClick={() => setBillingCycle("monthly")}>Monthly</button>
            <button type="button" className={billingCycle === "annual" ? "cycle-btn active" : "cycle-btn"} onClick={() => setBillingCycle("annual")}>Annual <span className="save-chip">Save 20%</span></button>
          </div>

          <div className="pricing-grid">
            {localizedPlans.map((plan, index) => (
              <article key={plan.name} className={`pricing-card reveal${index === 1 ? " featured" : ""}`}>
                <span className="eyebrow">{plan.name}</span>
                <h3>
                  {plan.key === "professional" && billingCycle === "annual" ? "$15" : plan.priceLabel}
                  {plan.key === "professional" ? <span className="pricing-cycle-label">/{billingCycle === "annual" ? "mo, billed annually" : "mo"}</span> : null}
                </h3>
                <p>{plan.description}</p>
                <div className="pricing-points">
                  {plan.points.map((point) => (
                    <span key={point}>
                      <Check size={14} />
                      {point}
                    </span>
                  ))}
                </div>
                <Link className={index === 1 ? "primary-button" : "ghost-button"} to={`/checkout?plan=${plan.key}`}>
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>

          <div className="landing-section-subtitle">
            <span className="eyebrow">{t("home.matrixEyebrow")}</span>
            <h3>{t("home.matrixTitle")}</h3>
          </div>
          <PricingMatrix />
        </div>
      </section>

      <section className="landing-section reveal" id="faq">
        <SectionCanvas type="faq" className="section-canvas" />
        <div className="landing-section-content">
          <div className="landing-section-header">
            <div>
              <span className="eyebrow">{t("home.faqEyebrow")}</span>
              <h2>{t("home.faqTitle")}</h2>
            </div>
            <p>{t("home.faqDescription")}</p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <article key={faq.question} className={isOpen ? "faq-item open" : "faq-item"}>
                  <button className="faq-trigger" type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)}>
                    <span>{faq.question}</span>
                    <ChevronDown size={18} />
                  </button>
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="landing-section alt-bg reveal" id="contact">
        <SectionCanvas type="contact" className="section-canvas" />
        <div className="landing-section-content">
          <div className="landing-section-header">
            <div>
              <span className="eyebrow">{t("home.contactEyebrow2")}</span>
              <h2>{t("home.contactTitle2")}</h2>
            </div>
            <p>{t("home.contactDesc2")}</p>
          </div>

          <div className="contact-grid contact-grid-expanded">
            <form className="contact-form-card" onSubmit={submitContactForm}>
              <div className="contact-form-grid">
                <label>
                  {t("home.contact.labelName")}
                  <input
                    value={contactForm.name}
                    onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder={t("home.contact.placeholderName")}
                    required
                  />
                </label>
                <label>
                  {t("home.contact.labelEmail")}
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder={t("home.contact.placeholderEmail")}
                    required
                  />
                </label>
                <label>
                  {t("home.contact.labelCompany")}
                  <input
                    value={contactForm.company}
                    onChange={(event) => setContactForm((current) => ({ ...current, company: event.target.value }))}
                    placeholder={t("home.contact.placeholderCompany")}
                  />
                </label>
                <label>
                  {t("home.contact.labelTeamSize")}
                  <input
                    value={contactForm.teamSize}
                    onChange={(event) => setContactForm((current) => ({ ...current, teamSize: event.target.value }))}
                    placeholder={t("home.contact.placeholderTeamSize")}
                  />
                </label>
              </div>

              <label>
                {t("home.contact.labelMessage")}
                <textarea
                  rows={6}
                  value={contactForm.message}
                  onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder={t("home.contact.placeholderMessage")}
                  required
                />
              </label>

              {contactState.error ? <div className="form-error">{contactState.error}</div> : null}
              {contactState.success ? <div className="form-success">{contactState.success}</div> : null}

              <button className="primary-button" type="submit" disabled={contactState.loading}>
                <Send size={16} />
                {contactState.loading ? t("home.contact.sending") : t("home.contact.send")}
              </button>
            </form>

            <div className="contact-side-panel">
              <article className="contact-side-card">
                <Building2 size={22} />
                <div>
                  <strong>{t("home.contact.nextTitle")}</strong>
                  <p>{t("home.contact.nextDesc")}</p>
                </div>
              </article>
              <article className="contact-side-card">
                <Layers size={22} />
                <div>
                  <strong>{t("home.contact.fitTitle")}</strong>
                  <p>{t("home.contact.fitDesc")}</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <BottomCTA />

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-grid">
            <div className="landing-footer-brand">
              <strong>SprintFlow</strong>
              <p>{t("home.footer.brandDesc")}</p>
            </div>
            <div className="landing-footer-col">
              <h4>{t("home.footer.company")}</h4>
              <a href="#contact">{t("home.footer.contact")}</a>
              <a href="#faq">{t("home.footer.faq")}</a>
              <a href="#comparison">{t("home.footer.compare")}</a>
            </div>
            <div className="landing-footer-col">
              <h4>{t("home.footer.product")}</h4>
              <a href="#features">{t("home.footer.features")}</a>
              <a href="#pricing">{t("home.footer.pricing")}</a>
              <a href="#how-it-works">{t("home.footer.howItWorks")}</a>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <p>© {new Date().getFullYear()} SprintFlow. {t("home.footerTagline")}</p>
            <div className="landing-footer-social">
              <a href="https://github.com/badralmunh" target="_blank" rel="noreferrer" aria-label="SprintFlow GitHub">
                <ExternalLink size={16} />
                <span>GitHub</span>
              </a>
              <a href="mailto:badral.munh@gmail.com" aria-label="Email SprintFlow">
                <Send size={16} />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
