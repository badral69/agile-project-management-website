import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Loader2, Mic, MicOff, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { api, getErrorMessage } from "../../lib/api";

type ParsedTask = {
  title: string;
  description: string;
  type: "EPIC" | "STORY" | "TASK" | "BUG";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "TODO";
  assigneeName: string | null;
  daysUntilDue: number | null;
};

const LANGUAGES = [
  { code: "en-US", label: "English" },
  { code: "mn-MN", label: "Монгол" },
  { code: "zh-CN", label: "中文" },
  { code: "ru-RU", label: "Русский" },
  { code: "ja-JP", label: "日本語" },
  { code: "ko-KR", label: "한국어" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "ar-SA", label: "العربية" },
];

type Props = {
  defaultProjectId?: string;
  projects: Array<{ id: string; key: string; name: string }>;
  onCreated?: () => void;
};

export function VoiceTaskButton({ defaultProjectId, projects, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<"idle" | "recording" | "parsing" | "preview" | "creating">("idle");
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId || "");
  const [lang, setLang] = useState("en-US");
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const startRecording = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SR) {
      setError("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was denied. Allow microphone permission in your browser and try again.");
      return;
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setPhase("parsing");
      parseMutation.mutate(text);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setPhase("idle");
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setError("Microphone access was denied. Allow microphone permission in your browser and try again.");
      } else if (event.error === "no-speech") {
        setError("No speech detected. Please try again and speak clearly.");
      } else if (event.error === "audio-capture") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError(`Voice error: ${event.error || "unknown"}. Please try again.`);
      }
    };

    recognition.onend = () => {
      if (phaseRef.current === "recording") setPhase("idle");
    };

    recognition.start();
    setPhase("recording");
    setError("");
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setPhase("idle");
  };

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.post<{ task: ParsedTask }>("/assistant/parse-voice", { transcript: text });
      return res.data.task;
    },
    onSuccess: (task) => {
      setParsed(task);
      setPhase("preview");
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setPhase("idle");
    },
  });

  const createTask = async () => {
    if (!parsed || !selectedProjectId) return;
    setPhase("creating");
    setError("");
    try {
      const dueDate = parsed.daysUntilDue
        ? format(addDays(new Date(), parsed.daysUntilDue), "yyyy-MM-dd")
        : undefined;

      await api.post("/tasks", {
        projectId: selectedProjectId,
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        priority: parsed.priority,
        status: parsed.status,
        dueDate,
      });

      await queryClient.invalidateQueries({ queryKey: ["workspace-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onCreated?.();
      reset();
    } catch (err) {
      setError(getErrorMessage(err as Error));
      setPhase("preview");
    }
  };

  const reset = () => {
    setPhase("idle");
    setTranscript("");
    setParsed(null);
    setError("");
  };

  if (phase === "idle" && !error) {
    return (
      <div className="voice-task-btn-group">
        <button type="button" className="voice-task-btn" onClick={startRecording} title="Create task by voice">
          <Mic size={15} />
          Voice task
        </button>
        <select
          className="voice-lang-select"
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          title="Speech language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="voice-task-overlay">
      <div className="voice-task-card">
        <div className="voice-task-card-header">
          <strong>Voice task</strong>
          <button type="button" onClick={reset}><X size={15} /></button>
        </div>

        {phase === "recording" ? (
          <div className="voice-recording-state">
            <div className="voice-pulse" />
            <p>Listening… speak your task clearly</p>
            <button type="button" className="secondary-button" onClick={stopRecording}>
              <MicOff size={14} /> Stop recording
            </button>
          </div>
        ) : phase === "parsing" ? (
          <div className="voice-parsing-state">
            <Loader2 size={20} className="spin" />
            <p>Parsing: <em>"{transcript}"</em></p>
          </div>
        ) : phase === "preview" && parsed ? (
          <div className="voice-preview-state">
            <div className="voice-preview-field"><span>Title</span><strong>{parsed.title}</strong></div>
            <div className="voice-preview-field"><span>Description</span><p>{parsed.description}</p></div>
            <div className="voice-preview-row">
              <div className="voice-preview-field"><span>Type</span><strong>{parsed.type}</strong></div>
              <div className="voice-preview-field"><span>Priority</span><strong>{parsed.priority}</strong></div>
              {parsed.daysUntilDue ? (
                <div className="voice-preview-field">
                  <span>Due</span>
                  <strong>{format(addDays(new Date(), parsed.daysUntilDue), "MMM d")}</strong>
                </div>
              ) : null}
              {parsed.assigneeName ? (
                <div className="voice-preview-field"><span>Assignee</span><strong>{parsed.assigneeName}</strong></div>
              ) : null}
            </div>
            {projects.length > 1 ? (
              <label>
                Project
                <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.key} · {p.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {error ? <div className="form-error">{error}</div> : null}
            <div className="voice-preview-actions">
              <button type="button" className="ghost-button" onClick={() => { setPhase("idle"); setTranscript(""); startRecording(); }}>
                <Mic size={13} /> Re-record
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={createTask}
                disabled={!selectedProjectId}
              >
                <Plus size={13} /> Create task
              </button>
            </div>
          </div>
        ) : phase === "creating" ? (
          <div className="voice-parsing-state">
            <Loader2 size={20} className="spin" />
            <p>Creating task…</p>
          </div>
        ) : null}

        {error && phase === "idle" ? (
          <div className="form-error">{error}</div>
        ) : null}
      </div>
    </div>
  );
}
