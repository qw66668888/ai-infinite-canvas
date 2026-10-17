import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  editImage,
  IMAGE_MODEL_PRESETS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./ai";
import { Icon } from "./Icons";
import {
  createInitialWorkflow,
  createNode,
  loadWorkflow,
  saveWorkflow,
  uid,
  type NodeKind,
  type Viewport,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowState,
} from "./workflow";

const TOPBAR_HEIGHT = 58;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.8;

type ToastState = { message: string; kind: "info" | "success" | "error" };
type SaveState = "saved" | "saving" | "partial" | "failed";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function fileToDataUrl(file: File, maxDim = 4096): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  const tooLargeForApi = dataUrl.length > 7_500_000;
  if (scale >= 1 && !tooLargeForApi) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  const useJpeg = tooLargeForApi || file.size > 6 * 1024 * 1024 || file.type !== "image/png";
  if (useJpeg) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(useJpeg ? "image/jpeg" : "image/png", 0.95);
}

async function downloadImage(src: string) {
  try {
    let href = src;
    let objectUrl = "";
    if (!src.startsWith("data:")) {
      const response = await fetch(src);
      if (!response.ok) throw new Error("download failed");
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      href = objectUrl;
    }
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `AI-workflow-${Date.now()}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
  } catch {
    window.open(src, "_blank", "noopener,noreferrer");
  }
}

function edgePath(from: WorkflowNode, to: WorkflowNode) {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const distance = Math.abs(x2 - x1);
  const curve = Math.max(72, distance * 0.42);
  return {
    x1,
    y1,
    x2,
    y2,
    d: `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
  };
}

function nodeKindLabel(kind: NodeKind) {
  return { image: "IMAGE", prompt: "PROMPT", result: "RESULT", output: "OUTPUT" }[kind];
}

function nodeIcon(kind: NodeKind) {
  return { image: "image", prompt: "text", result: "sparkles", output: "grid" }[kind] as
    | "image"
    | "text"
    | "sparkles"
    | "grid";
}

function fileNameTitle(name: string) {
  const clean = name.replace(/\.[^.]+$/, "").trim();
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean || "图片素材";
}

function NodeCard({
  node,
  displaySrc,
  selected,
  running,
  modelLabel,
  onPointerDown,
  onStartConnect,
  onPatch,
  onPickImage,
  onDelete,
  onDownload,
  onUseAsReference,
  onRun,
}: {
  node: WorkflowNode;
  displaySrc: string;
  selected: boolean;
  running: boolean;
  modelLabel: string;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, node: WorkflowNode) => void;
  onStartConnect: (event: ReactPointerEvent<HTMLElement>, node: WorkflowNode) => void;
  onPatch: (id: string, patch: Partial<WorkflowNode>) => void;
  onPickImage: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (node: WorkflowNode) => void;
  onUseAsReference: (node: WorkflowNode) => void;
  onRun: (id: string) => void;
}) {
  return (
    <article
      className={`node-card node-${node.kind}${selected ? " selected" : ""}${
        running ? " running" : ""
      }`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onPointerDown={(event) => onPointerDown(event, node)}
      data-node-id={node.id}
    >
      <div className="node-head">
        <span className="node-kind-icon"><Icon name={nodeIcon(node.kind)} size={14} /></span>
        <div className="node-heading">
          <input
            data-no-drag
            className="node-title-input"
            value={node.title}
            onChange={(event) => onPatch(node.id, { title: event.target.value })}
            onPointerDown={(event) => event.stopPropagation()}
            aria-label="节点标题"
          />
          <span className="node-type-label">{nodeKindLabel(node.kind)}</span>
        </div>
        <div className="node-head-actions" data-no-drag>
          {(node.kind === "result" || node.kind === "output") && displaySrc && (
            <button className="icon-btn" title="下载图片" onClick={(event) => {
              event.stopPropagation();
              onDownload(node);
            }}><Icon name="download" size={13} /></button>
          )}
          {node.kind === "result" && displaySrc && (
            <button className="icon-btn" title="作为新的参考图" onClick={(event) => {
              event.stopPropagation();
              onUseAsReference(node);
            }}><Icon name="copy" size={13} /></button>
          )}
          <button className="icon-btn danger" title="删除节点" onClick={(event) => {
            event.stopPropagation();
            onDelete(node.id);
          }}><Icon name="trash" size={13} /></button>
        </div>
      </div>

      {node.kind === "image" && (
        <div
          className={`node-media image-node-media${node.src ? " has-image" : ""}`}
          onClick={node.src ? undefined : () => onPickImage(node.id)}
          onDoubleClick={node.src ? () => onPickImage(node.id) : undefined}
        >
          {node.src ? (
            <img src={node.src} alt={node.title} draggable={false} />
          ) : (
            <div className="media-placeholder" style={{ background: node.accent }}>
              <Icon name="image" size={24} />
              <strong>点击上传参考图</strong>
              <span>或拖入图片到画布</span>
            </div>
          )}
          <button
            className="media-replace-btn"
            data-no-drag
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onPickImage(node.id);
            }}
          >
            <Icon name="image" size={12} />
            {node.src ? "更换图片" : "上传图片"}
          </button>
          <div className="media-caption">
            <span>{node.subtitle || "Image reference"}</span>
            <span>{node.src ? "双击更换" : "IMAGE"}</span>
          </div>
        </div>
      )}

      {node.kind === "prompt" && (
        <>
          <div className="prompt-body">
            <textarea
              data-no-drag
              className="prompt-editor"
              value={node.prompt || ""}
              onChange={(event) => onPatch(node.id, { prompt: event.target.value })}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="描述你想生成的画面，或把参考图连接到这个节点……"
            />
          </div>
          <div className="prompt-footer" data-no-drag>
            <span className="model-chip"><Icon name="sparkles" size={12} />{modelLabel}</span>
            <button className="run-node-btn" disabled={running} onClick={(event) => {
              event.stopPropagation();
              onRun(node.id);
            }}>
              <Icon name={running ? "stop" : "play"} size={12} />
              {running ? "生成中" : "运行"}
            </button>
          </div>
        </>
      )}

      {node.kind === "result" && (
        <div className="result-node-body">
          {running ? (
            <div className="node-generating"><span className="spinner" /><span>正在生成图片…</span></div>
          ) : displaySrc ? (
            <img src={displaySrc} alt={node.title} draggable={false} />
          ) : (
            <div className="result-skeleton">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} style={{ animationDelay: `${index * 120}ms` }} />
              ))}
              <div className="result-empty-label">运行左侧提示词后，结果会出现在这里</div>
            </div>
          )}
          <div className="result-meta">
            <span>{node.status === "done" ? "生成完成" : "等待运行"}</span>
            {displaySrc && <span>点击右上角下载</span>}
          </div>
        </div>
      )}

      {node.kind === "output" && (
        <div className="output-node-body">
          {displaySrc ? (
            <img src={displaySrc} alt={node.title} draggable={false} />
          ) : (
            <div className="output-placeholder" style={{ background: node.accent }}>
              <Icon name="grid" size={22} />
              <strong>最终输出</strong>
              <span>连接一个结果节点后自动预览</span>
            </div>
          )}
          <div className="output-meta">
            <span>{displaySrc ? "FINAL OUTPUT" : "等待上游结果"}</span>
            <span>最高 4K</span>
          </div>
        </div>
      )}

      <div className="port port-in" data-input-node={node.id} title="输入端口" />
      {node.kind !== "output" && (
        <div
          className="port port-out"
          data-output-node={node.id}
          title="拖动到另一个节点左侧以连接"
          onPointerDown={(event) => onStartConnect(event, node)}
        />
      )}
    </article>
  );
}

function SettingsModal({
  draft,
  outputSize,
  onDraft,
  onOutputSize,
  onClose,
  onSave,
}: {
  draft: Settings;
  outputSize: string;
  onDraft: (settings: Settings) => void;
  onOutputSize: (size: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="settings-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-modal" onPointerDown={(event) => event.stopPropagation()}>
        <div className="settings-head">
          <div>
            <span className="settings-kicker">WORKFLOW SETTINGS</span>
            <h2>模型与输出</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <Icon name="x" size={17} />
          </button>
        </div>
        <label>接口地址</label>
        <input value={draft.baseUrl} onChange={(event) => onDraft({ ...draft, baseUrl: event.target.value })} placeholder="https://ark.cn-beijing.volces.com/api/v3" />
        <label>API Key</label>
        <input type="password" value={draft.apiKey} onChange={(event) => onDraft({ ...draft, apiKey: event.target.value })} placeholder="粘贴火山方舟 API Key" />
        <label>图生图模型 / 接入点</label>
        <input
          list="workflow-image-models"
          value={draft.imageModel}
          onChange={(event) => onDraft({ ...draft, imageModel: event.target.value })}
          placeholder="ep-xxxxxxxx 或 doubao-seedream-5-0-flash-260915"
        />
        <datalist id="workflow-image-models">
          {IMAGE_MODEL_PRESETS.map((model) => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </datalist>
        <div className="model-presets">
          {IMAGE_MODEL_PRESETS.map((model) => (
            <button
              key={model.id}
              className={draft.imageModel === model.id ? "model-preset active" : "model-preset"}
              onClick={() => onDraft({ ...draft, imageModel: model.id })}
            >
              {model.label}
            </button>
          ))}
        </div>
        <label>输出尺寸</label>
        <select value={outputSize} onChange={(event) => onOutputSize(event.target.value)}>
          <option value="adaptive">保持参考图比例（推荐）</option>
          <option value="2K">2K</option>
          <option value="4K">4K（平台最高）</option>
        </select>
        <div className="settings-note">
          工作流会保存在当前浏览器。上传的大图如果超过本地存储容量，只会保留在当前会话中。
        </div>
        <div className="settings-actions">
          <button className="secondary-btn" onClick={onClose}>取消</button>
          <button className="primary-btn" onClick={onSave}><Icon name="check" size={14} />保存设置</button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowCanvas() {
  const [{ state: initial, restored }] = useState<{
    state: WorkflowState;
    restored: boolean;
  }>(() => {
    const saved = loadWorkflow();
    return { state: saved ?? createInitialWorkflow(), restored: Boolean(saved) };
  });

  const stageRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const quotaWarnedRef = useRef(false);
  const insertPointRef = useRef<{ x: number; y: number } | null>(null);
  const uploadTargetRef = useRef<{ kind: "new" } | { kind: "node"; id: string } | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [nodes, setNodes] = useState<WorkflowNode[]>(initial.nodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(initial.edges);
  const [viewport, setViewport] = useState<Viewport>(initial.viewport);
  const [outputSize, setOutputSize] = useState(initial.outputSize);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panning, setPanning] = useState(false);
  const [connection, setConnection] = useState<{
    from: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [settingsDraft, setSettingsDraft] = useState<Settings>(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef(viewport);
  const selectedRef = useRef(selectedId);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
  } | null>(null);
  const panRef = useRef<{
    startX: number;
    startY: number;
    viewportX: number;
    viewportY: number;
  } | null>(null);
  const connectRef = useRef<{ from: string; x1: number; y1: number } | null>(null);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  const notify = useCallback((message: string, kind: ToastState["kind"] = "info") => {
    setToast({ message, kind });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const patchNode = useCallback((id: string, patch: Partial<WorkflowNode>) => {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.from !== id && edge.to !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const deleteEdge = useCallback((id: string) => {
    setEdges((current) => current.filter((edge) => edge.id !== id));
  }, []);

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    const view = viewportRef.current;
    return {
      x: (clientX - (rect?.left || 0) - view.x) / view.zoom,
      y: (clientY - (rect?.top || 0) - view.y) / view.zoom,
    };
  }, []);

  const fitToContent = useCallback(() => {
    const stage = stageRef.current;
    const list = nodesRef.current;
    if (!stage) return;
    if (list.length === 0) {
      setViewport({ x: 0, y: TOPBAR_HEIGHT, zoom: 1 });
      return;
    }
    const minX = Math.min(...list.map((node) => node.x));
    const minY = Math.min(...list.map((node) => node.y));
    const maxX = Math.max(...list.map((node) => node.x + node.w));
    const maxY = Math.max(...list.map((node) => node.y + node.h));
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const availableW = Math.max(320, stage.clientWidth - 150);
    const availableH = Math.max(260, stage.clientHeight - TOPBAR_HEIGHT - 100);
    const zoom = clamp(Math.min(availableW / contentW, availableH / contentH), MIN_ZOOM, 1.15);
    const x = (stage.clientWidth - contentW * zoom) / 2 - minX * zoom;
    const y =
      TOPBAR_HEIGHT +
      38 +
      (stage.clientHeight - TOPBAR_HEIGHT - 90 - contentH * zoom) / 2 -
      minY * zoom;
    setViewport({ x, y, zoom });
  }, []);

  useEffect(() => {
    if (restored) return;
    const timer = window.setTimeout(fitToContent, 80);
    return () => window.clearTimeout(timer);
  }, [fitToContent, restored]);

  const zoomBy = useCallback((factor: number, screenX?: number, screenY?: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const cx = screenX ?? stage.clientWidth / 2;
    const cy = screenY ?? stage.clientHeight / 2;
    setViewport((current) => {
      const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const worldX = (cx - current.x) / current.zoom;
      const worldY = (cy - current.y) / current.zoom;
      return { x: cx - worldX * nextZoom, y: cy - worldY * nextZoom, zoom: nextZoom };
    });
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("textarea, input, select, .settings-backdrop")) return;
      event.preventDefault();
      if (event.shiftKey) {
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        setViewport((current) => ({ ...current, x: current.x - delta }));
        return;
      }
      const rect = stage.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const factor = Math.exp(-delta * 0.00115);
      zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
    };
    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  const beginNodeDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, node: WorkflowNode) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-no-drag], button, input, textarea, select, a, .port")) return;
      event.stopPropagation();
      setSelectedId(node.id);
      dragRef.current = {
        id: node.id,
        startX: event.clientX,
        startY: event.clientY,
        nodeX: node.x,
        nodeY: node.y,
      };
      document.body.classList.add("dragging-node");
    },
    []
  );

  const startConnection = useCallback(
    (event: ReactPointerEvent<HTMLElement>, node: WorkflowNode) => {
      event.preventDefault();
      event.stopPropagation();
      const start = { x: node.x + node.w, y: node.y + node.h / 2 };
      const pointer = clientToWorld(event.clientX, event.clientY);
      connectRef.current = { from: node.id, x1: start.x, y1: start.y };
      setConnection({ from: node.id, x1: start.x, y1: start.y, x2: pointer.x, y2: pointer.y });
    },
    [clientToWorld]
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag) {
        const view = viewportRef.current;
        const dx = (event.clientX - drag.startX) / view.zoom;
        const dy = (event.clientY - drag.startY) / view.zoom;
        setNodes((current) =>
          current.map((node) =>
            node.id === drag.id ? { ...node, x: drag.nodeX + dx, y: drag.nodeY + dy } : node
          )
        );
      }
      const pan = panRef.current;
      if (pan) {
        setViewport((current) => ({
          ...current,
          x: pan.viewportX + event.clientX - pan.startX,
          y: pan.viewportY + event.clientY - pan.startY,
        }));
      }
      const connect = connectRef.current;
      if (connect) {
        const pointer = clientToWorld(event.clientX, event.clientY);
        setConnection({
          from: connect.from,
          x1: connect.x1,
          y1: connect.y1,
          x2: pointer.x,
          y2: pointer.y,
        });
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (connectRef.current) {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const inputPort = element?.closest<HTMLElement>("[data-input-node]");
        const to = inputPort?.dataset.inputNode;
        const from = connectRef.current.from;
        if (to && from !== to) {
          setEdges((current) => {
            if (current.some((edge) => edge.from === from && edge.to === to)) return current;
            return [...current, { id: uid("edge"), from, to }];
          });
        }
        connectRef.current = null;
        setConnection(null);
      }
      dragRef.current = null;
      panRef.current = null;
      setPanning(false);
      document.body.classList.remove("dragging-node");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("dragging-node");
    };
  }, [clientToWorld]);

  const addNode = useCallback(
    (kind: NodeKind, point?: { x: number; y: number }) => {
      const center =
        point ?? clientToWorld(window.innerWidth / 2, window.innerHeight / 2 + 30);
      const node = createNode(kind, 0, 0);
      node.x = center.x - node.w / 2;
      node.y = center.y - node.h / 2;
      setNodes((current) => [...current, node]);
      setSelectedId(node.id);
      notify(
        kind === "prompt"
          ? "已添加提示词节点。连接参考图后点击运行。"
          : kind === "output"
          ? "已添加输出节点。把一个结果节点连接到它即可预览成品。"
          : "已添加节点。"
      );
    },
    [clientToWorld, notify]
  );

  const chooseImages = useCallback((point?: { x: number; y: number }) => {
    insertPointRef.current = point ?? null;
    uploadTargetRef.current = { kind: "new" };
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }, []);

  const chooseNodeImage = useCallback((id: string) => {
    uploadTargetRef.current = { kind: "node", id };
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }, []);

  const addImageFiles = useCallback(
    async (files: File[], point?: { x: number; y: number }) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) return;
      const origin =
        point ??
        insertPointRef.current ??
        clientToWorld(window.innerWidth / 2, window.innerHeight / 2 + 30);
      const created: WorkflowNode[] = [];
      for (let index = 0; index < images.length; index += 1) {
        try {
          const src = await fileToDataUrl(images[index]);
          const node = createNode("image", 0, 0, {
            src,
            title: fileNameTitle(images[index].name),
            subtitle: images[index].name,
          });
          node.x = origin.x - node.w / 2 + index * 28;
          node.y = origin.y - node.h / 2 + index * 28;
          created.push(node);
        } catch (error: any) {
          notify(error?.message || "读取图片失败", "error");
        }
      }
      if (created.length > 0) {
        setNodes((current) => [...current, ...created]);
        setSelectedId(created[created.length - 1].id);
        notify(`已添加 ${created.length} 个图片节点`, "success");
      }
    },
    [clientToWorld, notify]
  );

  const handleFileInput = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const target = uploadTargetRef.current;
      if (target?.kind === "node") {
        try {
          const src = await fileToDataUrl(files[0]);
          patchNode(target.id, { src, subtitle: files[0].name, status: "done" });
          notify("参考图已更新", "success");
        } catch (error: any) {
          notify(error?.message || "读取图片失败", "error");
        }
      } else {
        await addImageFiles(Array.from(files));
      }
      uploadTargetRef.current = null;
      insertPointRef.current = null;
    },
    [addImageFiles, notify, patchNode]
  );

  const autoLayout = useCallback(() => {
    setNodes((current) => {
      const xByKind: Record<NodeKind, number> = {
        image: 80,
        prompt: 430,
        result: 910,
        output: 1340,
      };
      const yByKind: Record<NodeKind, number> = {
        image: 90,
        prompt: 150,
        result: 130,
        output: 205,
      };
      const counts: Record<NodeKind, number> = { image: 0, prompt: 0, result: 0, output: 0 };
      return current.map((node) => {
        const index = counts[node.kind];
        counts[node.kind] += 1;
        return {
          ...node,
          x: xByKind[node.kind],
          y: yByKind[node.kind] + index * (node.h + 52),
        };
      });
    });
    window.setTimeout(fitToContent, 90);
    notify("已自动整理节点", "success");
  }, [fitToContent, notify]);

  const clearWorkflow = useCallback(() => {
    if (!window.confirm("清空当前画布上的所有节点和连线？")) return;
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
    setConnection(null);
    notify("画布已清空");
  }, [notify]);

  const runPromptNode = useCallback(
    async (promptId: string) => {
      const promptNode = nodesRef.current.find(
        (node) => node.id === promptId && node.kind === "prompt"
      );
      if (!promptNode || promptNode.status === "running") return;
      if (!settings.apiKey) {
        setSettingsDraft(settings);
        setSettingsOpen(true);
        notify("请先在设置里填写方舟 API Key", "error");
        return;
      }
      if (!settings.imageModel) {
        setSettingsDraft(settings);
        setSettingsOpen(true);
        notify("请先在设置里填写图生图模型或接入点", "error");
        return;
      }

      const sourceNodes = nodesRef.current.filter((node) => {
        const connected = edgesRef.current.some(
          (edge) => edge.to === promptId && edge.from === node.id
        );
        return connected && Boolean(node.src);
      });
      const sources = sourceNodes
        .map((node) => node.src)
        .filter((src): src is string => Boolean(src));
      if (sources.length === 0) {
        notify("先把至少一张图片节点连接到提示词节点左侧端口", "error");
        return;
      }
      if (!promptNode.prompt?.trim()) {
        notify("提示词还是空的，先写下你想怎么生成", "error");
        return;
      }

      patchNode(promptId, { status: "running" });
      try {
        const resultSrc = await editImage(
          sources.length === 1 ? sources[0] : sources,
          promptNode.prompt,
          settings,
          outputSize
        );
        const outgoing = edgesRef.current
          .filter((edge) => edge.from === promptId)
          .map((edge) => nodesRef.current.find((node) => node.id === edge.to))
          .filter(Boolean) as WorkflowNode[];
        const emptyResult = outgoing.find((node) => node.kind === "result" && !node.src);

        if (emptyResult) {
          patchNode(emptyResult.id, { src: resultSrc, status: "done" });
          setSelectedId(emptyResult.id);
        } else {
          const resultCount = outgoing.filter((node) => node.kind === "result").length;
          const resultNode = createNode(
            "result",
            promptNode.x + promptNode.w + 110,
            promptNode.y + resultCount * 72,
            { src: resultSrc, status: "done", title: `生成结果 ${resultCount + 1}` }
          );
          const outputNode = nodesRef.current.find((node) => node.kind === "output");
          setNodes((current) => [...current, resultNode]);
          setEdges((current) => {
            const next = [
              ...current,
              { id: uid("edge"), from: promptId, to: resultNode.id },
            ];
            if (outputNode) {
              next.push({ id: uid("edge"), from: resultNode.id, to: outputNode.id });
            }
            return next;
          });
          setSelectedId(resultNode.id);
        }
        patchNode(promptId, { status: "done" });
        notify("生成完成，结果已加入工作流", "success");
      } catch (error: any) {
        patchNode(promptId, { status: "idle" });
        notify(String(error?.message || error), "error");
      }
    },
    [notify, outputSize, patchNode, settings]
  );

  const runSelected = useCallback(() => {
    const selected = selectedRef.current
      ? nodesRef.current.find((node) => node.id === selectedRef.current)
      : null;
    let promptNode =
      selected?.kind === "prompt"
        ? selected
        : nodesRef.current.find(
            (node) => node.kind === "prompt" && node.status !== "running"
          );
    if (!promptNode && selected) {
      const incoming = edgesRef.current.find((edge) => edge.to === selected.id);
      promptNode = nodesRef.current.find(
        (node) => node.id === incoming?.from && node.kind === "prompt"
      );
    }
    if (!promptNode) {
      notify("先选择一个提示词节点，或添加一个提示词节点", "info");
      return;
    }
    void runPromptNode(promptNode.id);
  }, [notify, runPromptNode]);

  const useAsReference = useCallback(
    (node: WorkflowNode) => {
      if (!node.src) return;
      const imageNode = createNode("image", node.x - 320, node.y + 12, {
        src: node.src,
        title: "结果参考",
        subtitle: "From result",
      });
      setNodes((current) => [...current, imageNode]);
      const promptEdge = edgesRef.current.find((edge) => edge.to === node.id);
      if (promptEdge) {
        setEdges((current) => [
          ...current,
          { id: uid("edge"), from: imageNode.id, to: promptEdge.from },
        ]);
      }
      setSelectedId(imageNode.id);
      notify("已把结果复制为新的参考图节点", "success");
    },
    [notify]
  );

  const saveSettingsDraft = useCallback(() => {
    const next: Settings = {
      ...settingsDraft,
      baseUrl: settingsDraft.baseUrl.trim(),
      imageModel: settingsDraft.imageModel.trim(),
      model: settingsDraft.model.trim(),
    };
    saveSettings(next);
    setSettings(next);
    setSettingsOpen(false);
    notify("模型设置已保存", "success");
  }, [notify, settingsDraft]);

  useEffect(() => {
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      const state: WorkflowState = { title, nodes, edges, viewport, outputSize };
      if (saveWorkflow(state)) {
        setSaveState("saved");
        return;
      }
      const withoutLargeImages: WorkflowState = {
        ...state,
        nodes: nodes.map((node) =>
          node.src?.startsWith("data:") ? { ...node, src: undefined } : node
        ),
      };
      setSaveState(saveWorkflow(withoutLargeImages) ? "partial" : "failed");
      if (!quotaWarnedRef.current) {
        quotaWarnedRef.current = true;
        notify("上传的大图超过浏览器存储上限，本次会话内仍可正常生成。", "info");
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [title, nodes, edges, viewport, outputSize, notify]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (event.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          connectRef.current = null;
          setConnection(null);
          setSelectedId(null);
        }
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runSelected();
        return;
      }
      if (!typing && (event.key === "Delete" || event.key === "Backspace")) {
        const selected = selectedRef.current;
        if (selected) {
          event.preventDefault();
          deleteNode(selected);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteNode, runSelected, settingsOpen]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const displaySources = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      if (node.src) map.set(node.id, node.src);
      if (node.kind === "output" && !node.src) {
        const incoming = [...edges].reverse().find((edge) => edge.to === node.id);
        const source = incoming ? nodeById.get(incoming.from) : undefined;
        if (source?.src) map.set(node.id, source.src);
      }
    }
    return map;
  }, [edges, nodeById, nodes]);

  const modelLabel = useMemo(() => {
    const model = settings.imageModel.toLowerCase();
    if (model.includes("pro")) return "Seedream 5.0 Pro";
    if (model.includes("flash")) return "Seedream 5.0 Flash";
    if (model.includes("seededit")) return "SeedEdit 3.0";
    return "图生图模型";
  }, [settings.imageModel]);

  const isRunning = nodes.some((node) => node.status === "running");
  const visibleEdges = edges
    .map((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return null;
      return { edge, path: edgePath(from, to) };
    })
    .filter(Boolean) as { edge: WorkflowEdge; path: ReturnType<typeof edgePath> }[];

  return (
    <div className="workflow-app">
      <header className="workflow-topbar">
        <div className="brand-block">
          <span className="app-mark"><Icon name="workflow" size={18} /></span>
          <div className="brand-copy">
            <span className="brand-name">AI Workflow</span>
            <span className="brand-sub">图生图工作流</span>
          </div>
          <span className="topbar-divider" />
          <div className="title-block">
            <span className="title-prefix">工作流</span>
            <input
              className="workflow-title-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              aria-label="工作流名称"
            />
          </div>
        </div>

        <div className="topbar-center">
          <button className="tool-btn" onClick={() => chooseImages()}>
            <Icon name="plus" size={14} />图片
          </button>
          <button className="tool-btn" onClick={() => addNode("prompt")}>
            <Icon name="text" size={14} />提示词
          </button>
          <button className="tool-btn" onClick={() => addNode("output")}>
            <Icon name="grid" size={14} />输出
          </button>
          <span className="tool-separator" />
          <button className="icon-tool-btn" title="自动排列" onClick={autoLayout}>
            <Icon name="workflow" size={15} />
          </button>
          <button className="icon-tool-btn" title="全览画布" onClick={fitToContent}>
            <Icon name="fit" size={15} />
          </button>
          <button className="icon-tool-btn" title="清空画布" onClick={clearWorkflow}>
            <Icon name="trash" size={15} />
          </button>
        </div>

        <div className="topbar-right">
          <span className={`save-indicator ${saveState}`}>
            <span className="save-dot" />
            {saveState === "saving"
              ? "保存中"
              : saveState === "partial"
              ? "部分保存"
              : saveState === "failed"
              ? "保存失败"
              : "已保存"}
          </span>
          <button
            className="icon-tool-btn"
            title="模型设置"
            onClick={() => {
              setSettingsDraft(settings);
              setSettingsOpen(true);
            }}
          >
            <Icon name="settings" size={16} />
          </button>
          <button className="primary-btn run-top-btn" disabled={isRunning} onClick={runSelected}>
            {isRunning ? <span className="spinner small" /> : <Icon name="play" size={13} />}
            {isRunning ? "运行中" : "运行工作流"}
          </button>
        </div>
      </header>

      <main
        ref={stageRef}
        className={`workflow-stage${panning ? " panning" : ""}`}
        style={{
          backgroundColor: "#0a0a0b",
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.105) 1px, transparent 1px)",
          backgroundSize: `${26 * viewport.zoom}px ${26 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const target = event.target as HTMLElement;
          if (target.closest(".node-card, .canvas-ui, .empty-workflow")) return;
          setSelectedId(null);
          panRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            viewportX: viewportRef.current.x,
            viewportY: viewportRef.current.y,
          };
          setPanning(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const point = clientToWorld(event.clientX, event.clientY);
          void addImageFiles(Array.from(event.dataTransfer.files), point);
        }}
      >
        <div
          className="workflow-world"
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
          }}
        >
          <svg className="edge-layer" width="1" height="1" aria-hidden="true">
            {visibleEdges.map(({ edge, path }) => (
              <g key={edge.id}>
                <path className="edge-shadow" d={path.d} />
                <path className="edge-line" d={path.d} />
                <path className="edge-hit" d={path.d} onDoubleClick={() => deleteEdge(edge.id)}>
                  <title>双击删除连线</title>
                </path>
                <circle className="edge-dot" cx={path.x1} cy={path.y1} r="2.7" />
                <circle className="edge-dot" cx={path.x2} cy={path.y2} r="2.7" />
              </g>
            ))}
            {connection && (
              <path
                className="edge-draft"
                d={`M ${connection.x1} ${connection.y1} C ${
                  connection.x1 + Math.max(70, Math.abs(connection.x2 - connection.x1) * 0.4)
                } ${connection.y1}, ${
                  connection.x2 - Math.max(70, Math.abs(connection.x2 - connection.x1) * 0.4)
                } ${connection.y2}, ${connection.x2} ${connection.y2}`}
              />
            )}
          </svg>

          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              displaySrc={displaySources.get(node.id) || ""}
              selected={selectedId === node.id}
              running={node.status === "running"}
              modelLabel={modelLabel}
              onPointerDown={beginNodeDrag}
              onStartConnect={startConnection}
              onPatch={patchNode}
              onPickImage={chooseNodeImage}
              onDelete={deleteNode}
              onDownload={(target) => {
                const source = target.src || displaySources.get(target.id) || "";
                if (source) void downloadImage(source);
              }}
              onUseAsReference={useAsReference}
              onRun={(id) => void runPromptNode(id)}
            />
          ))}
        </div>

        {nodes.length === 0 && (
          <div
            className="empty-workflow canvas-ui"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="empty-mark"><Icon name="workflow" size={28} /></span>
            <h2>搭建第一条 AI 图像工作流</h2>
            <p>上传参考图，添加提示词，用节点端口连接它们，然后运行生成。</p>
            <div>
              <button className="primary-btn" onClick={() => chooseImages()}>
                <Icon name="image" size={14} />添加参考图
              </button>
              <button className="secondary-btn" onClick={() => addNode("prompt")}>
                <Icon name="text" size={14} />添加提示词
              </button>
            </div>
          </div>
        )}

        <div
          className="canvas-hud canvas-ui"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button title="缩小" onClick={() => zoomBy(0.84)}>
            <Icon name="minus" size={14} />
          </button>
          <button className="zoom-readout" onClick={fitToContent} title="点击全览">
            {Math.round(viewport.zoom * 100)}%
          </button>
          <button title="放大" onClick={() => zoomBy(1.18)}>
            <Icon name="plus" size={14} />
          </button>
        </div>

        <div className="canvas-tip canvas-ui">
          拖动画布 · 滚轮缩放 · 从节点右侧圆点连线 · 双击连线删除
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => void handleFileInput(event.target.files)}
      />

      {settingsOpen && (
        <SettingsModal
          draft={settingsDraft}
          outputSize={outputSize}
          onDraft={setSettingsDraft}
          onOutputSize={setOutputSize}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettingsDraft}
        />
      )}

      {toast && (
        <div className={`workflow-toast ${toast.kind}`} onClick={() => setToast(null)}>
          <span className="toast-icon">
            <Icon
              name={
                toast.kind === "success"
                  ? "check"
                  : toast.kind === "error"
                  ? "x"
                  : "sparkles"
              }
              size={14}
            />
          </span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
