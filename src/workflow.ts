export type NodeKind = "image" | "prompt" | "result" | "output" | "video";

export type AnnotationTool = "brush" | "rect";

export type AnnotationPoint = { x: number; y: number };

export type AnnotationStroke = {
  tool: AnnotationTool;
  color: string;
  size: number;
  points: AnnotationPoint[];
};

export type WorkflowNode = {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  src?: string;
  annotatedSrc?: string;
  annotationNote?: string;
  annotationStrokes?: AnnotationStroke[];
  prompt?: string;
  preset?:
    | "commerce-main"
    | "commerce-main-2"
    | "commerce-main-3"
    | "commerce-poster";
  commerceGroup?: string;
  outputSize?: string;
  status?: "idle" | "running" | "done";
  accent?: string;
  videoMode?: "image" | "edit";
  videoSourceUrl?: string;
  videoResultUrl?: string;
  videoTaskId?: string;
  videoTaskStatus?: string;
  videoError?: string;
  resolution?: string;
  ratio?: string;
  duration?: number;
  generateAudio?: boolean;
};

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
};

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorkflowState = {
  title: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: Viewport;
  outputSize: string;
};

const STORAGE_KEY = "ai-workflow-canvas-v4";

export function uid(prefix = "node") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function createNode(
  kind: NodeKind,
  x: number,
  y: number,
  patch: Partial<WorkflowNode> = {}
): WorkflowNode {
  const defaults: Record<NodeKind, Omit<WorkflowNode, "id" | "kind" | "x" | "y">> = {
    image: {
      w: 250,
      h: 270,
      title: "图片素材",
      subtitle: "点击上传参考图",
      accent: "linear-gradient(145deg, #343944, #17191d)",
      status: "idle",
    },
    prompt: {
      w: 380,
      h: 330,
      title: "提示词",
      subtitle: "Prompt",
      prompt:
        "描述你想生成的画面。连接左侧参考图后，点击运行生成结果。",
      status: "idle",
    },
    result: {
      w: 330,
      h: 330,
      title: "生成结果",
      subtitle: "Result",
      status: "idle",
    },
    output: {
      w: 380,
      h: 285,
      title: "最终输出",
      subtitle: "Output",
      status: "idle",
      accent: "linear-gradient(145deg, #24272d, #111216)",
    },
    video: {
      w: 450,
      h: 590,
      title: "AI 视频",
      subtitle: "Seedance 图生视频",
      prompt: "让画面中的光线缓慢流动，镜头轻微推进，人物自然呼吸，电影级质感。",
      status: "idle",
      videoMode: "image",
      resolution: "720p",
      ratio: "adaptive",
      duration: 5,
      generateAudio: true,
    },
  };

  return {
    id: uid(kind),
    kind,
    x,
    y,
    ...defaults[kind],
    ...patch,
  };
}

export function createInitialWorkflow(): WorkflowState {
  const image1 = createNode("image", 80, 72, {
    title: "人物参考",
    subtitle: "Portrait reference",
    src: "./demo/portrait.jpg",
    accent: "linear-gradient(145deg, #493c33, #1b1a19)",
    status: "done",
  });
  const image2 = createNode("image", 80, 372, {
    title: "家具素材",
    subtitle: "Furniture reference",
    src: "./demo/sofa.jpg",
    accent: "linear-gradient(145deg, #303438, #17191b)",
    status: "done",
  });
  const image3 = createNode("image", 80, 672, {
    title: "空间参考",
    subtitle: "Interior reference",
    src: "./demo/interior.jpg",
    accent: "linear-gradient(145deg, #2f3a3c, #171a1b)",
    status: "done",
  });
  const image4 = createNode("image", 80, 972, {
    title: "氛围参考",
    subtitle: "Atmosphere reference",
    src: "./demo/material.jpg",
    accent: "linear-gradient(145deg, #36343e, #18171c)",
    status: "done",
  });
  const prompt = createNode("prompt", 440, 220, {
    w: 390,
    h: 380,
    title: "空间合成提示词",
    prompt:
      "把参考人物自然地放入室内空间，保持人物五官、姿态与服装一致。结合家具与空间参考，使用暖色氛围灯、真实材质和克制构图，专业室内摄影质感，画面干净且没有 AI 生成感。",
  });
  const result = createNode("result", 930, 242, {
    w: 350,
    h: 360,
    title: "生成结果 01",
    src: "./demo/final.jpg",
    status: "done",
  });
  const output = createNode("output", 1380, 272, {
    w: 390,
    h: 320,
    title: "最终输出",
  });
  const video = createNode("video", 1380, 690, {
    title: "空间运镜视频",
    subtitle: "Seedance 图生视频",
    prompt:
      "以空间参考图为首帧，镜头缓慢向前推进，暖色灯光轻微流动，人物自然呼吸，电影级摄影质感，画面稳定。",
  });

  return {
    title: "AI 室内人物合成工作流",
    nodes: [image1, image2, image3, image4, prompt, result, output, video],
    edges: [
      { id: uid("edge"), from: image1.id, to: prompt.id },
      { id: uid("edge"), from: image2.id, to: prompt.id },
      { id: uid("edge"), from: image3.id, to: prompt.id },
      { id: uid("edge"), from: image4.id, to: prompt.id },
      { id: uid("edge"), from: prompt.id, to: result.id },
      { id: uid("edge"), from: result.id, to: output.id },
      { id: uid("edge"), from: image3.id, to: video.id },
      { id: uid("edge"), from: image4.id, to: video.id },
    ],
    viewport: { x: 40, y: 94, zoom: 0.62 },
    outputSize: "adaptive",
  };
}

export function loadWorkflow(): WorkflowState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.nodes) || !Array.isArray(parsed?.edges)) {
      return null;
    }
    return {
      title: String(parsed.title || "未命名工作流"),
      nodes: parsed.nodes
        .filter((node: any) => node?.id && node?.kind)
        .map((node: any) => ({
          ...node,
          x: Number(node.x) || 0,
          y: Number(node.y) || 0,
          w:
            node.kind === "video"
              ? Math.max(Number(node.w) || 450, 450)
              : Number(node.w) || 260,
          h:
            node.kind === "video"
              ? Math.max(Number(node.h) || 590, 590)
              : Number(node.h) || 220,
          status: node.status === "running" ? "idle" : node.status || "idle",
          videoMode:
            node.kind === "video"
              ? node.videoMode === "edit"
                ? "edit"
                : "image"
              : undefined,
          resolution: node.resolution || "720p",
          ratio: node.ratio || "adaptive",
          duration: Number(node.duration) || 5,
          generateAudio: node.generateAudio !== false,
        })),
      edges: parsed.edges.filter((edge: any) => edge?.from && edge?.to),
      viewport: {
        x: Number(parsed?.viewport?.x) || 40,
        y: Number(parsed?.viewport?.y) || 94,
        zoom: Number(parsed?.viewport?.zoom) || 0.8,
      },
      outputSize: String(parsed.outputSize || "adaptive"),
    };
  } catch {
    return null;
  }
}

export function saveWorkflow(state: WorkflowState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function nodeSource(node: WorkflowNode) {
  return node.src || "";
}
