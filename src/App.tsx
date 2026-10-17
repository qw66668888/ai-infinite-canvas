import { useCallback, useRef, useState } from "react";
import { Tldraw, createShapeId, type Editor } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import {
  generateNotes,
  loadSettings,
  saveSettings,
  type AIItem,
  type Settings,
} from "./ai";

const COLORS = ["blue", "green", "yellow", "orange", "violet", "grey", "red"];
const NOTE_W = 240;
const GAP_X = 60;
const NOTE_H = 180;
const GAP_Y = 48;

const EXAMPLES = [
  "Launch plan for a SaaS MVP in 8 weeks",
  "User research interview guide for a fintech app",
  "Content pillars for a personal AI brand",
];

function safeColor(c?: string) {
  return COLORS.includes(c ?? "") ? c : "yellow";
}

export function App() {
  const editorRef = useRef<Editor | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [draft, setDraft] = useState<Settings>(settings);

  const putNotes = useCallback((items: AIItem[]) => {
    const editor = editorRef.current;
    if (!editor || items.length === 0) return;

    const b = editor.getViewportPageBounds();
    const center = { x: b.minX + b.w / 2, y: b.minY + b.h / 2 };
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(items.length))));
    const colX: number[] = [];
    for (let i = 0; i < cols; i++) {
      const x =
        center.x - ((cols - 1) * (NOTE_W + GAP_X)) / 2 + i * (NOTE_W + GAP_X);
      colX.push(x);
    }
    const colY = new Array(cols).fill(
      center.y - 260
    ) as number[];

    const shapes: any[] = [];
    const ids: any[] = [];
    items.forEach((item, i) => {
      const col = i % cols;
      const x = colX[col];
      const y = colY[col];
      colY[col] += NOTE_H + GAP_Y;
      const id = createShapeId();
      ids.push(id);
      const text = item.detail ? `${item.title}\n\n${item.detail}` : item.title;
      shapes.push({
        id,
        type: "note",
        x,
        y,
        props: {
          text,
          color: safeColor(item.color),
          size: "m",
        },
      });
    });

    editor.run(() => {
      editor.createShapes(shapes);
      editor.selectNone();
      editor.select(...ids);
      editor.zoomToSelection({ animation: { duration: 350 } });
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const items = await generateNotes(prompt, settings);
      if (items.length === 0) throw new Error("No notes returned by the model.");
      putNotes(items);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [prompt, busy, settings, putNotes]);

  const handleSummarize = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    const notes = editor
      .getSelectedShapes()
      .filter((s) => s.type === "note")
      .map((s: any) => s.props?.text)
      .filter(Boolean);
    if (notes.length < 2) {
      setError("Select at least two notes first, then summarize.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const merged =
        "Summarize and reorganize these sticky notes into a clear structure. Notes:\n- " +
        notes.join("\n- ");
      const items = await generateNotes(merged, settings);
      putNotes(items);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, settings, putNotes]);

  const saveDraft = () => {
    saveSettings(draft);
    setSettings(draft);
    setSettingsOpen(false);
  };

  return (
    <div className="app">
      <Tldraw
        persistenceKey="ai-infinite-canvas"
        onMount={(editor) => { editorRef.current = editor; }}
      />

      <div className="panel">
        <div className="brand">
          <span className="logo-dot" />
          <strong>AI Infinite Canvas</strong>
          <button
            className="gear"
            title="Model settings"
            onClick={() => {
              setDraft(settings);
              setSettingsOpen((v) => !v);
            }}
          >
            ⚙
          </button>
        </div>

        {settingsOpen ? (
          <div className="settings">
            <label>Base URL (OpenAI-compatible)</label>
            <input
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder="https://.../api/v3"
            />
            <label>API key</label>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="Bearer token"
            />
            <label>Model</label>
            <input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="model id"
            />
            <div className="row">
              <button className="primary" onClick={saveDraft}>
                Save
              </button>
              <button onClick={() => setSettingsOpen(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              placeholder="Describe a topic or plan, and the AI lays out cards on the canvas…"
              rows={4}
            />
            <div className="chips">
              {EXAMPLES.map((x) => (
                <button key={x} className="chip" onClick={() => setPrompt(x)}>
                  {x}
                </button>
              ))}
            </div>
            <div className="row">
              <button
                className="primary"
                disabled={busy || !prompt.trim()}
                onClick={handleGenerate}
              >
                {busy ? "Generating…" : "Generate"}
              </button>
              <button disabled={busy} onClick={handleSummarize}>
                Summarize selected
              </button>
            </div>
            <div className="hint">Ctrl/⌘ + Enter to generate · drag & edit freely</div>
          </>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
