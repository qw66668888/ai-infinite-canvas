import { useCallback, useEffect, useRef, useState } from "react";
import {
  Tldraw,
  createShapeId,
  toRichText,
  type Editor,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import {
  generateNotes,
  loadSettings,
  rewriteText,
  saveSettings,
  type AIItem,
  type Settings,
} from "./ai";

const COLORS = ["blue", "green", "yellow", "orange", "violet", "grey", "red"];
const NOTE_SIZE = 200;
const GAP_X = 48;
const GAP_Y = 40;

const EXAMPLES = [
  "SaaS MVP 八周上线计划",
  "一款理财 App 的用户调研访谈提纲",
  "个人 AI 品牌的内容选题支柱",
  "分析某产品的 SWOT",
];

function safeColor(c?: string) {
  return COLORS.includes(c ?? "") ? c : "yellow";
}

function richTextToPlain(rt: any): string {
  if (!rt || !Array.isArray(rt.content)) return "";
  return rt.content
    .map((block: any) =>
      Array.isArray(block?.content)
        ? block.content.map((n: any) => n?.text ?? "").join("")
        : ""
    )
    .join("\n")
    .trim();
}

function truncate(text: string, n = 42) {
  return text.length > n ? text.slice(0, n) + "…" : text;
}

function edgePoint(cx: number, cy: number, tx: number, ty: number) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? NOTE_SIZE / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? NOTE_SIZE / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function App() {
  const editorRef = useRef<Editor | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [draft, setDraft] = useState<Settings>(settings);
  const [selected, setSelected] = useState<{ id: any; text: string }[]>([]);
  const [shapeCount, setShapeCount] = useState(0);

  const syncState = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const notes = editor
      .getSelectedShapes()
      .filter((s) => s.type === "note")
      .map((s: any) => ({ id: s.id, text: richTextToPlain(s.props?.richText) }));
    setSelected(notes);
    setShapeCount(editor.getCurrentPageShapes().length);
  }, []);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  const putNotes = useCallback((items: AIItem[], links = true) => {
    const editor = editorRef.current;
    if (!editor || items.length === 0) return;

    const b = editor.getViewportPageBounds();
    const center = { x: b.minX + b.w / 2, y: b.minY + b.h / 2 };
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(items.length))));
    const totalW = cols * NOTE_SIZE + (cols - 1) * GAP_X;
    const startX = center.x - totalW / 2;
    const startY = center.y - 220;

    const noteShapes: any[] = [];
    const noteIds: any[] = [];
    const placed: { x: number; y: number }[] = [];
    const colY: number[] = new Array(cols).fill(startY);

    items.forEach((item, i) => {
      const col = i % cols;
      const x = startX + col * (NOTE_SIZE + GAP_X);
      const y = colY[col];
      colY[col] += NOTE_SIZE + GAP_Y;
      placed.push({ x, y });
      const id = createShapeId();
      noteIds.push(id);
      const text = item.detail ? `${item.title}\n\n${item.detail}` : item.title;
      noteShapes.push({
        id,
        type: "note",
        x,
        y,
        props: {
          richText: toRichText(text),
          color: safeColor(item.color),
          size: "m",
          growY: 0,
        },
      });
    });

    const arrowShapes: any[] = [];
    if (links) {
      items.forEach((item, i) => {
        const p = item.parent;
        if (typeof p !== "number" || p < 1 || p > i) return;
        const from = placed[p - 1];
        const to = placed[i];
        const fcx = from.x + NOTE_SIZE / 2;
        const fcy = from.y + NOTE_SIZE / 2;
        const tcx = to.x + NOTE_SIZE / 2;
        const tcy = to.y + NOTE_SIZE / 2;
        const s = edgePoint(fcx, fcy, tcx, tcy);
        const e = edgePoint(tcx, tcy, fcx, fcy);
        arrowShapes.push({
          id: createShapeId(),
          type: "arrow",
          x: s.x,
          y: s.y,
          props: {
            kind: "arc",
            color: "grey",
            dash: "solid",
            size: "m",
            fill: "none",
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
            font: "draw",
            start: { x: 0, y: 0 },
            end: { x: e.x - s.x, y: e.y - s.y },
            bend: 0,
            text: "",
            labelPosition: 0.5,
            scale: 1,
            elbowMidPoint: 0.5,
          },
        });
      });
    }

    editor.run(() => {
      editor.createShapes([...noteShapes, ...arrowShapes]);
      editor.selectNone();
      editor.select(...noteIds);
      editor.zoomToSelection({ animation: { duration: 350 } });
    });
    syncState();
  }, [syncState]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const items = await generateNotes(prompt, settings);
      if (items.length === 0) throw new Error("模型没有返回任何便签。");
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
      .map((s: any) => richTextToPlain(s.props?.richText))
      .filter(Boolean);
    if (notes.length < 2) {
      setError("请先框选至少两张便签，再点击“总结选中”。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const merged =
        "请把下面这些便签总结并重新整理成更清晰的结构，用简体中文返回。便签内容：\n- " +
        notes.join("\n- ");
      const items = await generateNotes(merged, settings);
      putNotes(items, false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, settings, putNotes]);

  const handleRewrite = useCallback(
    async (instruction: string) => {
      const editor = editorRef.current;
      if (!editor || busy) return;
      const notes = editor.getSelectedShapes().filter((s) => s.type === "note");
      if (notes.length !== 1) {
        setError("请先选中一张便签，再使用这个操作。");
        return;
      }
      const shape: any = notes[0];
      const text = richTextToPlain(shape.props?.richText);
      if (!text) {
        setError("这张便签还没有文字内容。");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const result = await rewriteText(text, instruction, settings);
        if (!result) throw new Error("模型没有返回内容。");
        editor.updateShape({
          id: shape.id,
          type: "note",
          props: { richText: toRichText(result) },
        } as any);
        syncState();
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, settings, syncState]
  );

  const handleExport = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || busy) return;
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) {
      setError("画布还是空的，先生成一些内容吧。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { blob } = await editor.toImage(shapes, {
        format: "png",
        background: true,
        padding: 48,
        pixelRatio: 2,
      } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AI画布-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e: any) {
      setError("导出失败：" + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const handleClear = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!confirm("确定清空当前画布上的所有内容吗？")) return;
    editor.deleteShapes(editor.getCurrentPageShapes().map((s) => s.id));
    syncState();
  }, [syncState]);

  const handleZoomFit = useCallback(() => {
    editorRef.current?.zoomToFit({ animation: { duration: 300 } });
  }, []);

  const saveDraft = () => {
    saveSettings(draft);
    setSettings(draft);
    setSettingsOpen(false);
  };

  return (
    <div className="app">
      <Tldraw
        persistenceKey="ai-infinite-canvas"
        onMount={(editor) => {
          editorRef.current = editor;
          editor.user.updateUserPreferences({ locale: "zh-cn" });
          unsubRef.current?.();
          unsubRef.current = editor.store.listen(() => syncState());
          syncState();
        }}
      />

      <div className="panel">
        <div className="brand">
          <span className="logo-dot" />
          <strong>AI 无限画布</strong>
          <button
            className="gear"
            title="模型设置"
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
            <label>接口地址 Base URL（OpenAI 兼容）</label>
            <input
              value={draft.baseUrl}
              onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
              placeholder="https://.../api/v3"
            />
            <label>API Key</label>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="在此粘贴密钥"
            />
            <label>模型 Model</label>
            <input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="模型或接入点 ID"
            />
            <div className="row">
              <button className="primary" onClick={saveDraft}>
                保存
              </button>
              <button onClick={() => setSettingsOpen(false)}>取消</button>
            </div>
            <div className="hint">
              支持豆包 / DeepSeek / OpenAI 等 OpenAI 兼容接口；设置只保存在本机浏览器。
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
              placeholder="描述一个主题或计划，AI 会自动拆成便签并连线……"
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
                {busy ? "生成中…" : "生成"}
              </button>
              <button disabled={busy} onClick={handleSummarize}>
                总结选中
              </button>
            </div>

            <div className="status">
              <span className="dot" />
              {selected.length > 0
                ? `已选中 ${selected.length} 张便签`
                : shapeCount > 0
                ? `画布共 ${shapeCount} 个元素`
                : "画布还是空的"}
            </div>

            {selected.length === 1 && (
              <div className="selbox">
                <div className="seltext">「{truncate(selected[0].text)}」</div>
                <div className="actions">
                  <button disabled={busy} onClick={() => handleRewrite("请把这段内容扩写得更具体，补充关键细节，保持简洁。")}>
                    扩写
                  </button>
                  <button disabled={busy} onClick={() => handleRewrite("请把这段内容精简成一句更凝练的话。")}>
                    精简
                  </button>
                  <button disabled={busy} onClick={() => handleRewrite("请翻译成地道的英文。")}>
                    译英
                  </button>
                </div>
              </div>
            )}

            <div className="actions">
              <button onClick={handleZoomFit}>全览</button>
              <button disabled={busy} onClick={handleExport}>
                导出 PNG
              </button>
              <button onClick={handleClear}>清空</button>
            </div>

            <div className="hint">Ctrl/⌘ + 回车 生成 · 拖拽编辑 · 框选多张后总结</div>
          </>
        )}

        {busy && <div className="busy">AI 正在处理，请稍候…</div>}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}