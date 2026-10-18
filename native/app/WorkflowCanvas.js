import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "../vendor/jsx-runtime.mjs";
import { useCallback, useEffect, useMemo, useRef, useState, } from "../vendor/react.mjs";
import { DEFAULT_EDGE_COLOR, editImage, generateVideo, IMAGE_MODEL_PRESETS, loadSettings, normalizeEdgeColor, saveSettings, VIDEO_MODEL_PRESETS, } from "./ai.js";
import { Icon } from "./Icons.js";
import { createInitialWorkflow, createNode, loadWorkflow, saveWorkflow, uid, } from "./workflow.js";
const TOPBAR_HEIGHT = 58;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1.8;
const EDGE_COLOR_PRESETS = [
    { name: "冰蓝", value: DEFAULT_EDGE_COLOR },
    { name: "薄荷", value: "#68f5c1" },
    { name: "靛紫", value: "#a78bfa" },
    { name: "琥珀", value: "#ffc866" },
    { name: "玫瑰", value: "#ff7eb6" },
    { name: "纯白", value: "#f2f5f7" },
];
const EDGE_MULTI_COLORS = ["#69dcff", "#a78bfa", "#ff7eb6", "#ffc866", "#68f5c1"];
const DEFAULT_FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1b1b20"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="12" width="14" height="14" rx="3"/><rect x="38" y="12" width="14" height="14" rx="3"/><rect x="25" y="38" width="14" height="14" rx="3"/><path d="M19 26v8h26v-8M32 34v4"/></g></svg>')}`;
function rotatedEdgeColors(index) {
    const offset = index % EDGE_MULTI_COLORS.length;
    return [
        ...EDGE_MULTI_COLORS.slice(offset),
        ...EDGE_MULTI_COLORS.slice(0, offset),
    ];
}
const COMMERCE_MAIN_PROMPT = `【电商商品主图 · 1:1】
以参考图中的商品为唯一主体，完整保留商品的外形、颜色、材质、结构、数量、logo、图案和关键细节，不改款、不增减配件、不改变商品透视。
画面采用高级电商棚拍：柔和均匀的商业布光、清晰的轮廓光、真实接触阴影，背景使用浅灰、米白或与商品协调的低饱和色，主体居中且完整，约占画面 72%-80%，四周保留安全边距。
质感要求：高清商业摄影、细节锐利、材质真实、色彩准确、没有 AI 生成感，符合天猫、京东、抖音等平台商品主图规范。
画面中不要新增任何文字、字母、数字、价格标签、水印、二维码、杂乱道具或无关人物。商品本身原有的 logo 和包装文字尽量保持清晰准确。
商品信息（请补充后再运行）：商品名称：____；核心卖点：____；目标人群：____；品牌/风格：____。`;
const COMMERCE_MAIN_SCENE_PROMPT = `【电商场景主图 · 1:1】
以参考图中的商品为视觉核心，完整保留商品的外形、颜色、材质、结构、数量、logo、图案和关键细节，不改款、不增减配件、不改变商品主体。
把商品放入符合其定位的真实使用场景或高级展示台，搭配少量同色系道具、柔和环境光和自然阴影，营造可直接用于电商详情页的生活方式氛围。商品始终清晰突出，约占画面 58%-70%，不被前景或道具遮挡。
画面要求：商业广告摄影、空间层次自然、色彩统一、材质真实、细节清晰、没有 AI 生成感，1:1 方形构图，四周保留安全边距。
不要新增任何文字、字母、数字、价格标签、水印、二维码或无关人物。商品原有 logo 与包装文字尽量保持清晰准确。
商品信息（请补充后再运行）：商品名称：____；核心卖点：____；目标人群：____；品牌/风格：____。`;
const COMMERCE_MAIN_DETAIL_PROMPT = `【电商卖点细节主图 · 1:1】
以参考图中的商品为唯一主体，完整保留商品的外形、颜色、材质、结构、数量、logo 和关键细节，不虚构不存在的功能、配件或纹理。
采用高级商业微距与特写摄影突出商品最有价值的设计、材质或工艺细节，同时仍能辨认商品整体；使用精准的侧逆光、柔和主光和干净的低饱和背景，让纹理、边缘、光泽和做工清晰可见。构图高级克制，主体占画面 65%-80%，四周保留安全留白。
画面要求：高清、锐利、真实、色彩准确、没有 AI 生成感，适合电商卖点图与详情页，1:1 方形构图。
不要新增任何文字、字母、数字、价格标签、水印、二维码或无关道具。商品原有 logo 与包装文字尽量保持清晰准确。
商品信息（请补充后再运行）：商品名称：____；核心卖点：____；目标人群：____；品牌/风格：____。`;
const COMMERCE_LONG_POSTER_PROMPT = `【电商长图海报 · 按参考图实际尺寸】
严格按参考图的实际长宽比例和像素尺寸构图，不要强行拉伸成固定 3:8 或其它比例。
以参考图中的商品为主角，生成一张从上到下连续展开的竖版电商详情长图，完整保留商品的外形、颜色、材质、结构、数量、logo 和关键细节；同一商品在长图的每个分区中都必须保持一致，不改款、不增减配件。
版式从上到下依次组织：首屏主视觉与品牌氛围、核心卖点展示、材质工艺特写、真实使用场景、底部信息与参数留白。各分区自然过渡、风格统一、层次清楚，是连续的一张长图海报，不是四宫格拼贴。
每个分区都预留干净完整的标题和卖点文案留白，但画面中不要直接生成任何文字、字母、数字、价格、水印、二维码或乱码，方便后期排版。
画面要求：高级电商广告合成、商业摄影质感、主体突出、材质真实、光影精致、色彩统一，保持与参考图一致的长宽比例和像素尺寸，超长竖版构图，适配手机端详情页与长图海报。
商品信息（请补充后再运行）：商品名称：____；核心卖点：____；目标人群：____；品牌/风格：____。`;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
async function fileToDataUrl(file, maxDim = 4096) {
    if (!file.type.startsWith("image/"))
        throw new Error("请选择 JPG、PNG 或 WebP 图片。");
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("图片解码失败"));
        img.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const tooLargeForApi = dataUrl.length > 7500000;
    if (scale >= 1 && !tooLargeForApi)
        return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return dataUrl;
    const useJpeg = tooLargeForApi || file.size > 6 * 1024 * 1024 || file.type !== "image/png";
    if (useJpeg) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(useJpeg ? "image/jpeg" : "image/png", 0.95);
}
async function fileToLogoDataUrl(file) {
    if (!file.type.startsWith("image/")) {
        throw new Error("请选择 PNG、JPG、WebP 或 SVG 图片。");
    }
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取 Logo 失败"));
        reader.readAsDataURL(file);
    });
    const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Logo 图片解码失败"));
        img.src = dataUrl;
    });
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return dataUrl;
    const scale = Math.min(size / image.width, size / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
    return canvas.toDataURL("image/png");
}
async function downloadMedia(src) {
    try {
        let href = src;
        let objectUrl = "";
        let extension = src.startsWith("data:video/") ? "mp4" : "png";
        if (!src.startsWith("data:")) {
            const response = await fetch(src);
            if (!response.ok)
                throw new Error("download failed");
            const blob = await response.blob();
            const subtype = blob.type.split("/")[1] || "";
            if (subtype) {
                extension = subtype === "quicktime" ? "mov" : subtype === "mpeg" ? "mp4" : subtype;
            }
            objectUrl = URL.createObjectURL(blob);
            href = objectUrl;
        }
        else {
            const match = src.match(/^data:(video|image)\/([a-zA-Z0-9.+-]+)/);
            if (match) {
                extension = match[2] === "quicktime" ? "mov" : match[2] === "mpeg" ? "mp4" : match[2];
            }
        }
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.download = `AI-workflow-${Date.now()}.${extension}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        if (objectUrl)
            setTimeout(() => URL.revokeObjectURL(objectUrl), 3000);
    }
    catch {
        window.open(src, "_blank", "noopener,noreferrer");
    }
}
function edgePath(from, to) {
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
function nodeKindLabel(kind) {
    return {
        image: "IMAGE",
        prompt: "PROMPT",
        result: "RESULT",
        output: "OUTPUT",
        video: "VIDEO",
    }[kind];
}
function nodeIcon(kind) {
    return {
        image: "image",
        prompt: "text",
        result: "sparkles",
        output: "grid",
        video: "video",
    }[kind];
}
function nodeMinSize(kind) {
    if (kind === "video")
        return { width: 360, height: 520 };
    if (kind === "prompt")
        return { width: 300, height: 250 };
    if (kind === "output")
        return { width: 260, height: 220 };
    if (kind === "result")
        return { width: 220, height: 220 };
    return { width: 180, height: 180 };
}
function fileNameTitle(name) {
    const clean = name.replace(/\.[^.]+$/, "").trim();
    return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean || "图片素材";
}
const ANNOTATION_COLORS = ["#ff453a", "#ffd60a", "#0a84ff", "#30d158"];
function drawAnnotationStroke(ctx, stroke, width, height, scale = 1) {
    if (!stroke.points.length)
        return;
    const lineWidth = Math.max(2, stroke.size * scale);
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (stroke.tool === "rect") {
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1] || start;
        const x = Math.min(start.x, end.x) * width;
        const y = Math.min(start.y, end.y) * height;
        const w = Math.abs(end.x - start.x) * width;
        const h = Math.abs(end.y - start.y) * height;
        ctx.globalAlpha = 0.13;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, w, h);
    }
    else if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x * width, stroke.points[0].y * height, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
        for (let index = 1; index < stroke.points.length; index += 1) {
            ctx.lineTo(stroke.points[index].x * width, stroke.points[index].y * height);
        }
        ctx.stroke();
    }
    ctx.restore();
}
function AnnotationModal({ node, onClose, onSave, onClear, }) {
    const imageRef = useRef(null);
    const canvasRef = useRef(null);
    const drawingRef = useRef(null);
    const [tool, setTool] = useState("brush");
    const [color, setColor] = useState(ANNOTATION_COLORS[0]);
    const [size, setSize] = useState(12);
    const [note, setNote] = useState(node.annotationNote || "");
    const [error, setError] = useState("");
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [strokes, setStrokes] = useState(() => (node.annotationStrokes || []).map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ ...point })),
    })));
    const fitCanvas = useCallback(() => {
        const image = imageRef.current;
        const canvas = canvasRef.current;
        if (!image || !canvas)
            return;
        const rect = image.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (width < 2 || height < 2)
            return;
        if (canvas.width !== width)
            canvas.width = width;
        if (canvas.height !== height)
            canvas.height = height;
        setCanvasSize({ width, height });
    }, []);
    useEffect(() => {
        const image = imageRef.current;
        if (!image)
            return;
        const onLoad = () => fitCanvas();
        if (image.complete)
            onLoad();
        else
            image.addEventListener("load", onLoad);
        const observer = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => fitCanvas());
        if (observer && image.parentElement)
            observer.observe(image.parentElement);
        window.addEventListener("resize", onLoad);
        return () => {
            image.removeEventListener("load", onLoad);
            observer?.disconnect();
            window.removeEventListener("resize", onLoad);
        };
    }, [fitCanvas]);
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx)
            return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const stroke of strokes) {
            drawAnnotationStroke(ctx, stroke, canvas.width, canvas.height);
        }
    }, [canvasSize, strokes]);
    const pointFromEvent = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return {
            x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
            y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
        };
    };
    const startStroke = (event) => {
        event.preventDefault();
        if (!node.src)
            return;
        setError("");
        const point = pointFromEvent(event);
        const stroke = {
            tool,
            color,
            size,
            points: tool === "rect" ? [point, point] : [point],
        };
        setStrokes((current) => {
            drawingRef.current = { pointerId: event.pointerId, index: current.length };
            return [...current, stroke];
        });
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        catch {
            // ignore pointer capture errors
        }
    };
    const moveStroke = (event) => {
        const drawing = drawingRef.current;
        if (!drawing || drawing.pointerId !== event.pointerId)
            return;
        const point = pointFromEvent(event);
        setStrokes((current) => current.map((stroke, index) => {
            if (index !== drawing.index)
                return stroke;
            if (stroke.tool === "rect") {
                return { ...stroke, points: [stroke.points[0], point] };
            }
            return { ...stroke, points: [...stroke.points, point] };
        }));
    };
    const endStroke = (event) => {
        if (drawingRef.current?.pointerId === event.pointerId) {
            drawingRef.current = null;
        }
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        catch {
            // ignore pointer capture errors
        }
    };
    const saveAnnotation = () => {
        const image = imageRef.current;
        if (!image?.naturalWidth || !image.naturalHeight)
            return;
        if (strokes.length === 0 && !note.trim()) {
            setError("请先在图片上涂抹或框选，或者填写修改说明。");
            return;
        }
        const output = document.createElement("canvas");
        output.width = image.naturalWidth;
        output.height = image.naturalHeight;
        const ctx = output.getContext("2d");
        if (!ctx)
            return;
        ctx.drawImage(image, 0, 0, output.width, output.height);
        const scale = canvasSize.width > 0 ? output.width / canvasSize.width : 1;
        for (const stroke of strokes) {
            drawAnnotationStroke(ctx, stroke, output.width, output.height, scale);
        }
        const source = node.src || "";
        const isPng = source.startsWith("data:image/png") || /\.png(?:$|\?)/i.test(source);
        let annotatedSrc = "";
        try {
            annotatedSrc = output.toDataURL(isPng ? "image/png" : "image/jpeg", 0.93);
        }
        catch {
            setError("这张远程图片无法直接标注。请先下载图片，再作为参考图上传后标注。");
            return;
        }
        onSave({
            annotatedSrc,
            annotationNote: note.trim() || undefined,
            annotationStrokes: strokes,
        });
    };
    return (_jsx("div", { className: "settings-backdrop annotation-backdrop", onPointerDown: (event) => {
            if (event.target === event.currentTarget)
                onClose();
        }, children: _jsxs("div", { className: "annotation-modal", onPointerDown: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "settings-head annotation-head", children: [_jsxs("div", { children: [_jsx("span", { className: "settings-kicker", children: "ANNOTATE & EDIT" }), _jsx("h2", { children: "\u6807\u6CE8\u4FEE\u6539" }), _jsx("p", { children: "\u5728\u56FE\u7247\u4E0A\u5708\u51FA\u9700\u8981\u4FEE\u6539\u7684\u5730\u65B9\uFF0C\u518D\u5199\u6E05\u4FEE\u6539\u8981\u6C42\u3002" })] }), _jsx("button", { className: "icon-btn", onClick: onClose, title: "\u5173\u95ED", children: _jsx(Icon, { name: "x", size: 17 }) })] }), _jsxs("div", { className: "annotation-toolbar", children: [_jsxs("div", { className: "annotation-tool-group", children: [_jsxs("button", { className: tool === "brush" ? "active" : "", onClick: () => setTool("brush"), children: [_jsx(Icon, { name: "edit", size: 13 }), "\u6D82\u62B9"] }), _jsx("button", { className: tool === "rect" ? "active" : "", onClick: () => setTool("rect"), children: "\u6846\u9009" })] }), _jsx("div", { className: "annotation-colors", children: ANNOTATION_COLORS.map((item) => (_jsx("button", { className: `annotation-color${color === item ? " active" : ""}`, style: { background: item }, onClick: () => setColor(item), title: item }, item))) }), _jsxs("label", { className: "annotation-size", children: ["\u7B14\u5237", _jsx("input", { type: "range", min: 4, max: 30, value: size, onChange: (event) => setSize(Number(event.target.value)) })] }), _jsx("button", { className: "annotation-text-btn", onClick: () => setStrokes((current) => current.slice(0, -1)), disabled: strokes.length === 0, children: "\u64A4\u9500" }), _jsx("button", { className: "annotation-text-btn", onClick: () => setStrokes([]), disabled: strokes.length === 0, children: "\u6E05\u7A7A" })] }), _jsx("div", { className: "annotation-stage", children: _jsxs("div", { className: "annotation-image-wrap", children: [_jsx("img", { ref: imageRef, src: node.src, alt: node.title, draggable: false }), _jsx("canvas", { ref: canvasRef, className: "annotation-canvas", onPointerDown: startStroke, onPointerMove: moveStroke, onPointerUp: endStroke, onPointerCancel: endStroke })] }) }), _jsx("label", { className: "annotation-note-label", children: "\u4FEE\u6539\u8BF4\u660E" }), _jsx("textarea", { className: "annotation-note", value: note, onChange: (event) => {
                        setNote(event.target.value);
                        setError("");
                    }, placeholder: "\u4F8B\u5982\uFF1A\u628A\u7EA2\u8272\u5708\u51FA\u7684\u95E8\u6362\u6210\u6DF1\u8272\u6728\u95E8\uFF0C\u5176\u4ED6\u533A\u57DF\u4FDD\u6301\u4E0D\u53D8\u3002" }), _jsx("div", { className: `annotation-hint${error ? " error" : ""}`, children: error || "彩色线条只用于告诉 AI 修改范围，最终结果会尽量不保留标注。" }), _jsxs("div", { className: "annotation-footer", children: [_jsx("div", { children: node.annotatedSrc && (_jsx("button", { className: "secondary-btn", onClick: onClear, children: "\u6E05\u9664\u5DF2\u4FDD\u5B58\u6807\u6CE8" })) }), _jsxs("div", { children: [_jsx("button", { className: "secondary-btn", onClick: onClose, children: "\u53D6\u6D88" }), _jsxs("button", { className: "primary-btn", onClick: saveAnnotation, children: [_jsx(Icon, { name: "check", size: 14 }), "\u4FDD\u5B58\u6807\u6CE8"] })] })] })] }) }));
}
function NodeCard({ node, displaySrc, displayVideo, inputImageCount, inputVideoUrl, selected, running, modelLabel, videoModelLabel, onPointerDown, onStartResize, onStartConnect, onPatch, onPickImage, onAnnotate, onDelete, onDownload, onUseAsReference, onRun, onRunCommerceSet, onStopVideo, }) {
    const videoMode = node.videoMode === "edit" ? "edit" : "image";
    const videoStatus = (node.videoTaskStatus || "").toLowerCase();
    const videoStatusLabel = videoStatus === "queued"
        ? "已排队"
        : videoStatus === "running"
            ? "方舟生成中"
            : videoStatus === "succeeded" || videoStatus === "success"
                ? "任务完成"
                : videoStatus === "failed"
                    ? "生成失败"
                    : "正在创建任务";
    return (_jsxs("article", { className: `node-card node-${node.kind}${selected ? " selected" : ""}${running ? " running" : ""}`, style: { left: node.x, top: node.y, width: node.w, height: node.h }, onPointerDown: (event) => onPointerDown(event, node), "data-node-id": node.id, children: [_jsxs("div", { className: "node-head", children: [_jsx("span", { className: "node-kind-icon", children: _jsx(Icon, { name: nodeIcon(node.kind), size: 14 }) }), _jsxs("div", { className: "node-heading", children: [_jsx("input", { "data-no-drag": true, className: "node-title-input", value: node.title, onChange: (event) => onPatch(node.id, { title: event.target.value }), onPointerDown: (event) => event.stopPropagation(), "aria-label": "\u8282\u70B9\u6807\u9898" }), _jsx("span", { className: "node-type-label", children: nodeKindLabel(node.kind) })] }), _jsxs("div", { className: "node-head-actions", "data-no-drag": true, children: [(node.kind === "image" || node.kind === "result") && node.src && (_jsx("button", { className: `icon-btn${node.annotatedSrc ? " active" : ""}`, title: node.annotatedSrc ? "继续标注或修改说明" : "标注修改", onClick: (event) => {
                                    event.stopPropagation();
                                    onAnnotate(node.id);
                                }, children: _jsx(Icon, { name: "edit", size: 13 }) })), (node.kind === "result" ||
                                node.kind === "output" ||
                                (node.kind === "video" && node.videoResultUrl)) &&
                                (displaySrc || displayVideo || node.videoResultUrl) && (_jsx("button", { className: "icon-btn", title: "\u4E0B\u8F7D", onClick: (event) => {
                                    event.stopPropagation();
                                    onDownload(node);
                                }, children: _jsx(Icon, { name: "download", size: 13 }) })), node.kind === "result" && displaySrc && (_jsx("button", { className: "icon-btn", title: "\u4F5C\u4E3A\u65B0\u7684\u53C2\u8003\u56FE", onClick: (event) => {
                                    event.stopPropagation();
                                    onUseAsReference(node);
                                }, children: _jsx(Icon, { name: "copy", size: 13 }) })), _jsx("button", { className: "icon-btn danger", title: "\u5220\u9664\u8282\u70B9", onClick: (event) => {
                                    event.stopPropagation();
                                    onDelete(node.id);
                                }, children: _jsx(Icon, { name: "trash", size: 13 }) })] })] }), node.kind === "image" && (_jsxs("div", { className: `node-media image-node-media${node.src ? " has-image" : ""}`, onClick: node.src ? undefined : () => onPickImage(node.id), onDoubleClick: node.src ? () => onPickImage(node.id) : undefined, children: [node.src ? (_jsx("img", { src: node.annotatedSrc || node.src, alt: node.title, draggable: false })) : (_jsxs("div", { className: "media-placeholder", style: { background: node.accent }, children: [_jsx(Icon, { name: "image", size: 24 }), _jsx("strong", { children: "\u70B9\u51FB\u4E0A\u4F20\u53C2\u8003\u56FE" }), _jsx("span", { children: "\u6216\u62D6\u5165\u56FE\u7247\u5230\u753B\u5E03" })] })), _jsxs("button", { className: "media-replace-btn", "data-no-drag": true, onPointerDown: (event) => event.stopPropagation(), onClick: (event) => {
                            event.stopPropagation();
                            onPickImage(node.id);
                        }, children: [_jsx(Icon, { name: "image", size: 12 }), node.src ? "更换图片" : "上传图片"] }), node.src && (_jsxs("button", { className: "media-annotate-btn", "data-no-drag": true, onPointerDown: (event) => event.stopPropagation(), onClick: (event) => {
                            event.stopPropagation();
                            onAnnotate(node.id);
                        }, children: [_jsx(Icon, { name: "edit", size: 12 }), node.annotatedSrc ? "继续标注" : "标注修改"] })), _jsxs("div", { className: "media-caption", children: [_jsx("span", { children: node.subtitle || "Image reference" }), _jsx("span", { children: node.annotatedSrc
                                    ? "已标注 · 双击更换"
                                    : node.src
                                        ? "双击更换"
                                        : "IMAGE" })] })] })), node.kind === "prompt" && (_jsxs(_Fragment, { children: [_jsx("div", { className: "prompt-body", children: _jsx("textarea", { "data-no-drag": true, className: "prompt-editor", value: node.prompt || "", onChange: (event) => onPatch(node.id, { prompt: event.target.value }), onPointerDown: (event) => event.stopPropagation(), placeholder: "\u63CF\u8FF0\u4F60\u60F3\u751F\u6210\u7684\u753B\u9762\uFF0C\u6216\u628A\u53C2\u8003\u56FE\u8FDE\u63A5\u5230\u8FD9\u4E2A\u8282\u70B9\u2026\u2026" }) }), _jsxs("div", { className: "prompt-footer", "data-no-drag": true, children: [_jsxs("span", { className: "model-chip", children: [_jsx(Icon, { name: "sparkles", size: 12 }), modelLabel] }), _jsxs("div", { className: "prompt-footer-actions", children: [node.preset === "commerce-main" && node.commerceGroup && (_jsxs("button", { className: "run-set-btn", disabled: running, onClick: (event) => {
                                            event.stopPropagation();
                                            if (node.commerceGroup)
                                                onRunCommerceSet(node.commerceGroup);
                                        }, title: "\u4F9D\u6B21\u751F\u6210 3 \u5F20\u7535\u5546\u4E3B\u56FE\u548C 1 \u5F20\u957F\u56FE\u6D77\u62A5", children: [_jsx(Icon, { name: "sparkles", size: 12 }), "\u751F\u6210\u5957\u56FE"] })), _jsxs("button", { className: "run-node-btn", disabled: running, onClick: (event) => {
                                            event.stopPropagation();
                                            onRun(node.id);
                                        }, children: [_jsx(Icon, { name: running ? "stop" : "play", size: 12 }), running ? "生成中" : "运行"] })] })] })] })), node.kind === "result" && (_jsxs("div", { className: "result-node-body", children: [running ? (_jsxs("div", { className: "node-generating", children: [_jsx("span", { className: "spinner" }), _jsx("span", { children: "\u6B63\u5728\u751F\u6210\u56FE\u7247\u2026" })] })) : displaySrc ? (_jsx("img", { src: displaySrc, alt: node.title, draggable: false })) : (_jsxs("div", { className: "result-skeleton", children: [Array.from({ length: 9 }).map((_, index) => (_jsx("span", { style: { animationDelay: `${index * 120}ms` } }, index))), _jsx("div", { className: "result-empty-label", children: "\u8FD0\u884C\u5DE6\u4FA7\u63D0\u793A\u8BCD\u540E\uFF0C\u7ED3\u679C\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC" })] })), !running && node.src && (_jsxs("button", { className: "media-annotate-btn", "data-no-drag": true, onPointerDown: (event) => event.stopPropagation(), onClick: (event) => {
                            event.stopPropagation();
                            onAnnotate(node.id);
                        }, children: [_jsx(Icon, { name: "edit", size: 12 }), node.annotatedSrc ? "继续标注" : "标注修改"] })), _jsxs("div", { className: "result-meta", children: [_jsx("span", { children: node.status === "done" ? "生成完成" : "等待运行" }), displaySrc && _jsx("span", { children: "\u70B9\u51FB\u53F3\u4E0A\u89D2\u4E0B\u8F7D" })] })] })), node.kind === "output" && (_jsxs("div", { className: "output-node-body", children: [displayVideo ? (_jsx("video", { src: displayVideo, controls: true, playsInline: true, preload: "metadata" })) : displaySrc ? (_jsx("img", { src: displaySrc, alt: node.title, draggable: false })) : (_jsxs("div", { className: "output-placeholder", style: { background: node.accent }, children: [_jsx(Icon, { name: "grid", size: 22 }), _jsx("strong", { children: "\u6700\u7EC8\u8F93\u51FA" }), _jsx("span", { children: "\u8FDE\u63A5\u4E00\u4E2A\u7ED3\u679C\u8282\u70B9\u540E\u81EA\u52A8\u9884\u89C8" })] })), _jsxs("div", { className: "output-meta", children: [_jsx("span", { children: displayVideo || displaySrc ? "FINAL OUTPUT" : "等待上游结果" }), _jsx("span", { children: displayVideo ? "VIDEO" : "最高 4K" })] })] })), node.kind === "video" && (_jsxs("div", { className: "video-node-body", children: [_jsxs("div", { className: "video-mode-tabs", children: [_jsx("button", { className: videoMode === "image" ? "active" : "", onClick: () => onPatch(node.id, { videoMode: "image" }), children: "\u56FE\u751F\u89C6\u9891" }), _jsx("button", { className: videoMode === "edit" ? "active" : "", onClick: () => onPatch(node.id, { videoMode: "edit" }), children: "\u89C6\u9891\u7F16\u8F91" }), _jsx("span", { className: "video-mode-hint", children: videoMode === "image" ? "参考图 → 视频" : "原视频 → 新视频" })] }), _jsxs("div", { className: "video-preview", children: [node.videoResultUrl ? (_jsx("video", { src: node.videoResultUrl, poster: displaySrc || undefined, controls: true, playsInline: true, preload: "metadata", "data-no-drag": true })) : displaySrc ? (_jsx("img", { className: "video-poster", src: displaySrc, alt: node.title, draggable: false })) : (_jsxs("div", { className: "video-placeholder", children: [_jsx(Icon, { name: "video", size: 26 }), _jsx("strong", { children: videoMode === "edit" ? "连接或填写视频源" : "连接图片后生成视频" }), _jsx("span", { children: videoMode === "edit"
                                            ? "连接上游视频节点，或粘贴公网 MP4 地址"
                                            : inputImageCount > 0
                                                ? `已连接 ${inputImageCount} 张参考图，第一张作为首帧`
                                                : "从图片节点右侧端口拖线到这里" })] })), running && (_jsxs("div", { className: "video-running", children: [_jsx("span", { className: "spinner" }), _jsx("strong", { children: videoStatusLabel }), _jsx("span", { children: node.videoTaskId
                                            ? `任务 ${node.videoTaskId.slice(-10)}`
                                            : "正在创建方舟任务…" })] })), _jsxs("div", { className: "video-preview-meta", children: [_jsx("span", { children: node.videoResultUrl
                                            ? "VIDEO READY"
                                            : running
                                                ? "GENERATING"
                                                : "SEEDANCE" }), _jsxs("span", { children: [node.resolution || "720p", " \u00B7 ", node.duration || 5, "s"] })] })] }), _jsx("textarea", { className: "video-prompt", value: node.prompt || "", onChange: (event) => onPatch(node.id, { prompt: event.target.value }), placeholder: videoMode === "edit"
                            ? "描述要如何修改视频：替换主体、调整光线、局部重绘、延长镜头……"
                            : "描述镜头运动、主体动作、光线变化和画面风格。" }), node.videoError && !running && (_jsx("div", { className: "video-error", title: node.videoError, children: node.videoError })), _jsxs("div", { className: "video-controls", children: [_jsxs("label", { children: [_jsx("span", { children: "\u6E05\u6670\u5EA6" }), _jsxs("select", { value: node.resolution || "720p", onChange: (event) => onPatch(node.id, { resolution: event.target.value }), children: [_jsx("option", { value: "480p", children: "480p" }), _jsx("option", { value: "720p", children: "720p" }), _jsx("option", { value: "1080p", children: "1080p" })] })] }), _jsxs("label", { children: [_jsx("span", { children: "\u6BD4\u4F8B" }), _jsxs("select", { value: node.ratio || "adaptive", onChange: (event) => onPatch(node.id, { ratio: event.target.value }), children: [_jsx("option", { value: "adaptive", children: "\u81EA\u9002\u5E94" }), _jsx("option", { value: "16:9", children: "16:9" }), _jsx("option", { value: "9:16", children: "9:16" }), _jsx("option", { value: "1:1", children: "1:1" }), _jsx("option", { value: "4:3", children: "4:3" }), _jsx("option", { value: "3:4", children: "3:4" }), _jsx("option", { value: "21:9", children: "21:9" })] })] }), _jsxs("label", { children: [_jsx("span", { children: "\u65F6\u957F" }), _jsxs("select", { value: String(node.duration || 5), onChange: (event) => onPatch(node.id, { duration: Number(event.target.value) || 5 }), children: [_jsx("option", { value: "5", children: "5 \u79D2" }), _jsx("option", { value: "10", children: "10 \u79D2" })] })] }), _jsxs("label", { className: "video-audio-toggle", children: [_jsx("input", { type: "checkbox", checked: node.generateAudio !== false, onChange: (event) => onPatch(node.id, { generateAudio: event.target.checked }) }), _jsx("span", { children: "\u97F3\u9891" })] })] }), videoMode === "edit" && (_jsx("div", { className: "video-source", children: inputVideoUrl ? (_jsxs("span", { className: "video-source-chip", children: [_jsx(Icon, { name: "video", size: 11 }), "\u5DF2\u8FDE\u63A5\u4E0A\u6E38\u89C6\u9891"] })) : (_jsx("input", { value: node.videoSourceUrl || "", onChange: (event) => onPatch(node.id, { videoSourceUrl: event.target.value }), placeholder: "\u7C98\u8D34\u89C6\u9891 URL\uFF08MP4\uFF0C\u9700\u516C\u7F51\u53EF\u8BBF\u95EE\uFF09" })) })), _jsxs("div", { className: "video-footer", children: [_jsxs("span", { className: "model-chip", children: [_jsx(Icon, { name: "video", size: 12 }), videoModelLabel || "未配置视频模型"] }), _jsxs("button", { className: "run-node-btn", onClick: (event) => {
                                    event.stopPropagation();
                                    if (running) {
                                        onStopVideo(node.id);
                                    }
                                    else {
                                        onRun(node.id);
                                    }
                                }, children: [_jsx(Icon, { name: running ? "stop" : "play", size: 12 }), running ? "停止" : "生成视频"] })] })] })), _jsx("button", { className: "node-resize-handle", "data-no-drag": true, title: "\u62D6\u52A8\u8C03\u6574\u8282\u70B9\u5927\u5C0F", "aria-label": "\u8C03\u6574\u8282\u70B9\u5927\u5C0F", onPointerDown: (event) => onStartResize(event, node) }), _jsx("div", { className: "port port-in", "data-input-node": node.id, title: "\u8F93\u5165\u7AEF\u53E3" }), node.kind !== "output" && (_jsx("div", { className: "port port-out", "data-output-node": node.id, title: "\u62D6\u52A8\u5230\u53E6\u4E00\u4E2A\u8282\u70B9\u5DE6\u4FA7\u4EE5\u8FDE\u63A5", onPointerDown: (event) => onStartConnect(event, node) }))] }));
}
function SettingsModal({ draft, outputSize, onDraft, onOutputSize, onClose, onSave, }) {
    const customMatch = /^(\d{2,5})[xX×](\d{2,5})$/.exec(outputSize.trim());
    const isCustomSize = Boolean(customMatch);
    const [customWidth, setCustomWidth] = useState(customMatch?.[1] || "2048");
    const [customHeight, setCustomHeight] = useState(customMatch?.[2] || "2048");
    const logoInputRef = useRef(null);
    const [logoError, setLogoError] = useState("");
    const handleLogoFile = async (file) => {
        if (!file)
            return;
        setLogoError("");
        try {
            const logo = await fileToLogoDataUrl(file);
            onDraft({ ...draft, brandLogo: logo });
        }
        catch (error) {
            setLogoError(error instanceof Error ? error.message : "Logo 读取失败");
        }
    };
    useEffect(() => {
        if (outputSize === "2K" || outputSize === "4K")
            onOutputSize("adaptive");
    }, [onOutputSize, outputSize]);
    const applyCustomSize = (rawWidth, rawHeight) => {
        const width = Math.min(4096, Math.round(Number(rawWidth) || 0));
        const height = Math.min(4096, Math.round(Number(rawHeight) || 0));
        if (width >= 256 && height >= 256)
            onOutputSize(`${width}x${height}`);
    };
    return (_jsx("div", { className: "settings-backdrop", onPointerDown: (event) => {
            if (event.target === event.currentTarget)
                onClose();
        }, children: _jsxs("div", { className: "settings-modal", onPointerDown: (event) => event.stopPropagation(), children: [_jsxs("div", { className: "settings-head", children: [_jsxs("div", { children: [_jsx("span", { className: "settings-kicker", children: "WORKFLOW SETTINGS" }), _jsx("h2", { children: "\u753B\u5E03\u4E0E\u6A21\u578B" })] }), _jsx("button", { className: "icon-btn", onClick: onClose, title: "\u5173\u95ED", children: _jsx(Icon, { name: "x", size: 17 }) })] }), _jsx("label", { children: "\u753B\u5E03\u540D\u79F0" }), _jsx("input", { value: draft.brandName || "", maxLength: 40, onChange: (event) => onDraft({ ...draft, brandName: event.target.value }), placeholder: "\u4F8B\u5982\uFF1ACherr Studio AI" }), _jsx("label", { children: "\u526F\u6807\u9898" }), _jsx("input", { value: draft.brandSubtitle || "", maxLength: 60, onChange: (event) => onDraft({ ...draft, brandSubtitle: event.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u6211\u7684\u65E0\u9650\u753B\u5E03" }), _jsx("label", { children: "\u753B\u5E03 Logo" }), _jsxs("div", { className: "settings-logo-row", children: [_jsx("span", { className: "settings-logo-preview", children: draft.brandLogo ? (_jsx("img", { src: draft.brandLogo, alt: "\u753B\u5E03 Logo" })) : (_jsx(Icon, { name: "workflow", size: 20 })) }), _jsxs("div", { className: "settings-logo-actions", children: [_jsxs("button", { type: "button", className: "secondary-btn logo-upload-btn", onClick: () => logoInputRef.current?.click(), children: [_jsx(Icon, { name: "upload", size: 13 }), "\u4E0A\u4F20 Logo"] }), draft.brandLogo && (_jsx("button", { type: "button", className: "secondary-btn logo-upload-btn", onClick: () => onDraft({ ...draft, brandLogo: "" }), children: "\u6062\u590D\u9ED8\u8BA4\u56FE\u6807" }))] }), _jsx("input", { ref: logoInputRef, type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml,image/*", hidden: true, onChange: (event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                void handleLogoFile(file);
                            } })] }), _jsx("div", { className: "settings-hint", children: "\u5EFA\u8BAE\u7528\u900F\u660E\u5E95 PNG \u6216 SVG\uFF1B\u4F1A\u81EA\u52A8\u7F29\u6210 256px \u6B63\u65B9\u5F62\uFF0C\u663E\u793A\u5728\u5DE6\u4E0A\u89D2\u548C\u6D4F\u89C8\u5668\u6807\u7B7E\u9875\u3002" }), logoError && _jsx("div", { className: "settings-error", children: logoError }), _jsx("label", { children: "\u5546\u54C1\u4E8B\u5B9E\u9501\u5B9A\uFF08\u81EA\u52A8\u8FFD\u52A0\u5230\u7535\u5546/\u5546\u54C1\u63D0\u793A\u8BCD\uFF09" }), _jsx("textarea", { className: "settings-textarea", rows: 7, value: draft.productFacts || "", onChange: (event) => onDraft({ ...draft, productFacts: event.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u4E3B\u9A7E\u811A\u57AB\u6709\u4E0E\u6BEF\u9762\u540C\u8272\u7684\u77E9\u5F62\u9632\u6ED1\u811A\u8DDF\u57AB\uFF0C\u526F\u9A7E/\u540E\u6392\u6CA1\u6709\u2026\u2026" }), _jsx("div", { className: "settings-hint", children: "\u6BCF\u6B21\u8FD0\u884C\u7535\u5546/\u5546\u54C1\u7C7B\u63D0\u793A\u8BCD\u65F6\uFF0C\u8FD9\u6BB5\u4E8B\u5B9E\u4F1A\u81EA\u52A8\u8FFD\u52A0\u5230\u63D0\u793A\u8BCD\u672B\u5C3E\uFF1B\u540C\u65F6\u628A\u4E3B\u9A7E\u9632\u6ED1\u57AB\u5B9E\u62CD\u8FDE\u63A5\u5230\u63D0\u793A\u8BCD\u8282\u70B9\uFF0C\u6A21\u578B\u624D\u80FD\u770B\u5230\u5177\u4F53\u7EB9\u7406\u3002" }), _jsx("label", { children: "\u8FDE\u7EBF\u914D\u8272" }), _jsxs("div", { className: "edge-mode-toggle", role: "group", "aria-label": "\u8FDE\u7EBF\u914D\u8272\u6A21\u5F0F", children: [_jsx("button", { type: "button", className: `edge-mode-option${draft.edgeColorMode === "single" ? " active" : ""}`, onClick: () => onDraft({ ...draft, edgeColorMode: "single" }), children: "\u5355\u8272\u6D41\u5149" }), _jsx("button", { type: "button", className: `edge-mode-option${draft.edgeColorMode === "multi" ? " active" : ""}`, onClick: () => onDraft({ ...draft, edgeColorMode: "multi" }), children: "\u591A\u5F69\u6D41\u5149" })] }), draft.edgeColorMode === "multi" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "edge-multi-preview", children: [_jsx("div", { className: "edge-multi-sample" }), _jsxs("div", { className: "edge-multi-labels", children: [_jsx("span", { children: "\u51B0\u84DD" }), _jsx("span", { children: "\u975B\u7D2B" }), _jsx("span", { children: "\u73AB\u7470" }), _jsx("span", { children: "\u7425\u73C0" }), _jsx("span", { children: "\u8584\u8377" })] })] }), _jsx("div", { className: "settings-hint", children: "\u6BCF\u6761\u8FDE\u7EBF\u90FD\u4F1A\u540C\u65F6\u5448\u73B0\u591A\u79CD\u989C\u8272\uFF0C\u76F8\u90BB\u8FDE\u7EBF\u4F1A\u9519\u5F00\u6E10\u53D8\u8D77\u70B9\uFF0C\u7EE7\u7EED\u4FDD\u7559\u6D41\u52A8\u6548\u679C\u3002" })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "edge-color-row", children: [_jsx("input", { className: "edge-color-picker", type: "color", value: normalizeEdgeColor(draft.edgeColor), onChange: (event) => onDraft({ ...draft, edgeColor: event.target.value }), title: "\u81EA\u5B9A\u4E49\u8FDE\u7EBF\u989C\u8272" }), _jsx("input", { className: "edge-color-hex", value: draft.edgeColor || "", maxLength: 7, onChange: (event) => onDraft({ ...draft, edgeColor: event.target.value }), placeholder: DEFAULT_EDGE_COLOR, "aria-label": "\u8FDE\u7EBF\u989C\u8272\u5341\u516D\u8FDB\u5236\u503C" })] }), _jsx("div", { className: "edge-color-presets", children: EDGE_COLOR_PRESETS.map((preset) => (_jsxs("button", { type: "button", className: `edge-color-preset${normalizeEdgeColor(draft.edgeColor).toLowerCase() === preset.value.toLowerCase()
                                    ? " active"
                                    : ""}`, style: { "--swatch-color": preset.value }, onClick: () => onDraft({ ...draft, edgeColor: preset.value }), title: preset.name, children: [_jsx("span", { className: "edge-color-swatch" }), preset.name] }, preset.value))) }), _jsx("div", { className: "settings-hint", children: "\u70B9\u51FB\u8272\u5757\u81EA\u7531\u53D6\u8272\uFF0C\u6216\u76F4\u63A5\u8F93\u5165\u5341\u516D\u8FDB\u5236\u989C\u8272\u3002\u4FDD\u5B58\u540E\u6240\u6709\u8FDE\u7EBF\u4F1A\u7ACB\u5373\u53D8\u6210\u8BE5\u989C\u8272\u3002" })] })), _jsx("label", { children: "\u63A5\u53E3\u5730\u5740" }), _jsx("input", { value: draft.baseUrl, onChange: (event) => onDraft({ ...draft, baseUrl: event.target.value }), placeholder: "https://ark.cn-beijing.volces.com/api/v3" }), _jsx("label", { children: "API Key" }), _jsx("input", { type: "password", value: draft.apiKey, onChange: (event) => onDraft({ ...draft, apiKey: event.target.value }), placeholder: "\u7C98\u8D34\u706B\u5C71\u65B9\u821F API Key" }), _jsx("label", { children: "\u56FE\u751F\u56FE\u6A21\u578B / \u63A5\u5165\u70B9" }), _jsx("input", { list: "workflow-image-models", value: draft.imageModel, onChange: (event) => onDraft({ ...draft, imageModel: event.target.value }), placeholder: "ep-xxxxxxxx \u6216 doubao-seedream-5-0-flash-260915" }), _jsx("datalist", { id: "workflow-image-models", children: IMAGE_MODEL_PRESETS.map((model) => (_jsx("option", { value: model.id, children: model.label }, model.id))) }), _jsx("div", { className: "model-presets", children: IMAGE_MODEL_PRESETS.map((model) => (_jsx("button", { className: draft.imageModel === model.id ? "model-preset active" : "model-preset", onClick: () => onDraft({ ...draft, imageModel: model.id }), children: model.label }, model.id))) }), _jsx("label", { children: "\u89C6\u9891\u6A21\u578B / \u63A5\u5165\u70B9\uFF08Seedance\uFF09" }), _jsx("input", { list: "workflow-video-models", value: draft.videoModel || "", onChange: (event) => onDraft({ ...draft, videoModel: event.target.value }), placeholder: "ep-xxxxxxxx \u6216 doubao-seedance-... \u6A21\u578B ID" }), _jsx("datalist", { id: "workflow-video-models", children: VIDEO_MODEL_PRESETS.map((model) => (_jsx("option", { value: model.id, children: model.label }, model.id))) }), _jsx("div", { className: "model-presets", children: VIDEO_MODEL_PRESETS.map((model) => (_jsx("button", { className: draft.videoModel === model.id ? "model-preset active" : "model-preset", onClick: () => onDraft({ ...draft, videoModel: model.id }), children: model.label }, model.id))) }), _jsxs("div", { className: "settings-hint", children: ["Seedance 2.5 / 2.0 \u8BF7\u4F18\u5148\u586B\u706B\u5C71\u65B9\u821F\u63A7\u5236\u53F0\u91CC\u8BE5\u6A21\u578B\u7684 ", _jsx("code", { children: "ep-..." }), " \u63A8\u7406\u63A5\u5165\u70B9 ID\u3002"] }), _jsx("label", { children: "\u8F93\u51FA\u5C3A\u5BF8" }), _jsxs("select", { value: isCustomSize ? "custom" : "adaptive", onChange: (event) => {
                        if (event.target.value === "custom") {
                            applyCustomSize(customWidth, customHeight);
                        }
                        else {
                            onOutputSize(event.target.value);
                        }
                    }, children: [_jsx("option", { value: "adaptive", children: "\u6309\u539F\u56FE\u5C3A\u5BF8\u751F\u6210\uFF08\u63A8\u8350\uFF09" }), _jsx("option", { value: "custom", children: "\u81EA\u5B9A\u4E49\u5C3A\u5BF8" })] }), isCustomSize && (_jsxs(_Fragment, { children: [_jsx("label", { children: "\u81EA\u5B9A\u4E49\u5BBD \u00D7 \u9AD8\uFF08\u50CF\u7D20\uFF09" }), _jsxs("div", { className: "size-dimensions", children: [_jsx("input", { type: "number", min: 256, max: 4096, step: 16, value: customWidth, onChange: (event) => {
                                        setCustomWidth(event.target.value);
                                        applyCustomSize(event.target.value, customHeight);
                                    }, "aria-label": "\u8F93\u51FA\u5BBD\u5EA6" }), _jsx("span", { children: "\u00D7" }), _jsx("input", { type: "number", min: 256, max: 4096, step: 16, value: customHeight, onChange: (event) => {
                                        setCustomHeight(event.target.value);
                                        applyCustomSize(customWidth, event.target.value);
                                    }, "aria-label": "\u8F93\u51FA\u9AD8\u5EA6" })] }), _jsxs("div", { className: "settings-hint", children: ["\u4F1A\u4EE5 ", _jsx("code", { children: "\u5BBDx\u9AD8" }), " \u53D1\u9001\u7ED9\u65B9\u821F\uFF0C\u4F8B\u5982 ", _jsx("code", { children: "1536x2048" }), "\u3002\u8303\u56F4 256\u20134096\uFF0C\u5E73\u53F0\u6700\u9AD8 4K\u3002"] })] })), !isCustomSize && (_jsx("div", { className: "settings-hint", children: "\u76F4\u63A5\u4F7F\u7528\u7B2C\u4E00\u5F20\u53C2\u8003\u56FE\u7684\u5BBD\u9AD8\uFF1B\u8D85\u8FC7 4096 \u50CF\u7D20\u65F6\u81EA\u52A8\u7B49\u6BD4\u7F29\u5230 4K \u4E0A\u9650\u3002" })), _jsx("label", { children: "\u4E3B\u56FE\u5C3A\u5BF8\uFF081:1\uFF09" }), _jsx("input", { value: draft.mainImageSize || "1440x1440", onChange: (event) => onDraft({ ...draft, mainImageSize: event.target.value }), placeholder: "1440x1440" }), _jsx("div", { className: "settings-hint", children: "\u6240\u6709\u201C\u7535\u5546\u4E3B\u56FE / \u5546\u54C1\u4E3B\u56FE\u201D\u63D0\u793A\u8BCD\u90FD\u4F1A\u5F3A\u5236\u4F7F\u7528\u8FD9\u4E2A\u5C3A\u5BF8\uFF0C\u9ED8\u8BA4 1440x1440\uFF1B\u957F\u56FE\u6D77\u62A5\u6BCF\u5C4F\u6309\u5BF9\u5E94\u539F\u56FE\u5C3A\u5BF8\u751F\u6210\uFF08\u5355\u6B21\u4E0D\u8D85\u8FC7 4096px\uFF09\uFF0C22 \u5C4F\u9010\u5C4F\u751F\u6210\u540E\u62FC\u63A5\u3002" }), _jsx("div", { className: "settings-hint", children: "\u591A\u56FE\u53C2\u8003\u65F6\u6309\u7B2C\u4E00\u5F20\u539F\u56FE\u7684\u5B9E\u9645\u5BBD\u9AD8\u751F\u6210\uFF1B\u6574\u5F20\u4E24\u4E07\u591A\u50CF\u7D20\u7684\u957F\u56FE\u4E0D\u80FD\u4E00\u6B21\u751F\u6210\uFF0C\u5FC5\u987B\u9010\u5C4F\u751F\u6210\u540E\u62FC\u63A5\u3002" }), _jsx("div", { className: "settings-note", children: "\u5DE5\u4F5C\u6D41\u4F1A\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\u3002\u4E0A\u4F20\u7684\u5927\u56FE\u5982\u679C\u8D85\u8FC7\u672C\u5730\u5B58\u50A8\u5BB9\u91CF\uFF0C\u53EA\u4F1A\u4FDD\u7559\u5728\u5F53\u524D\u4F1A\u8BDD\u4E2D\u3002" }), _jsxs("div", { className: "settings-actions", children: [_jsx("button", { className: "secondary-btn", onClick: onClose, children: "\u53D6\u6D88" }), _jsxs("button", { className: "primary-btn", onClick: onSave, children: [_jsx(Icon, { name: "check", size: 14 }), "\u4FDD\u5B58\u8BBE\u7F6E"] })] })] }) }));
}
export function WorkflowCanvas() {
    const [{ state: initial, restored }] = useState(() => {
        const saved = loadWorkflow();
        return { state: saved ?? createInitialWorkflow(), restored: Boolean(saved) };
    });
    const stageRef = useRef(null);
    const fileInputRef = useRef(null);
    const toastTimerRef = useRef(null);
    const quotaWarnedRef = useRef(false);
    const insertPointRef = useRef(null);
    const uploadTargetRef = useRef(null);
    const videoAbortRef = useRef(new Map());
    const [title, setTitle] = useState(initial.title);
    const [nodes, setNodes] = useState(initial.nodes);
    const [edges, setEdges] = useState(initial.edges);
    const [viewport, setViewport] = useState(initial.viewport);
    const [outputSize, setOutputSize] = useState(() => initial.outputSize === "2K" || initial.outputSize === "4K"
        ? "adaptive"
        : initial.outputSize);
    const [selectedId, setSelectedId] = useState(null);
    const [panning, setPanning] = useState(false);
    const [connection, setConnection] = useState(null);
    const [saveState, setSaveState] = useState("saved");
    const [toast, setToast] = useState(null);
    const [settings, setSettings] = useState(() => loadSettings());
    const [settingsDraft, setSettingsDraft] = useState(settings);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [annotationId, setAnnotationId] = useState(null);
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const viewportRef = useRef(viewport);
    const selectedRef = useRef(selectedId);
    const dragRef = useRef(null);
    const resizeRef = useRef(null);
    const panRef = useRef(null);
    const connectRef = useRef(null);
    useEffect(() => { nodesRef.current = nodes; }, [nodes]);
    useEffect(() => { edgesRef.current = edges; }, [edges]);
    useEffect(() => { viewportRef.current = viewport; }, [viewport]);
    useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
    const notify = useCallback((message, kind = "info") => {
        setToast({ message, kind });
        if (toastTimerRef.current)
            window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(null), 4200);
    }, []);
    useEffect(() => {
        return () => {
            if (toastTimerRef.current)
                window.clearTimeout(toastTimerRef.current);
            for (const controller of videoAbortRef.current.values())
                controller.abort();
            videoAbortRef.current.clear();
        };
    }, []);
    const patchNode = useCallback((id, patch) => {
        setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)));
    }, []);
    const deleteNode = useCallback((id) => {
        videoAbortRef.current.get(id)?.abort();
        videoAbortRef.current.delete(id);
        setNodes((current) => current.filter((node) => node.id !== id));
        setEdges((current) => current.filter((edge) => edge.from !== id && edge.to !== id));
        setSelectedId((current) => (current === id ? null : current));
    }, []);
    const deleteEdge = useCallback((id) => {
        setEdges((current) => current.filter((edge) => edge.id !== id));
    }, []);
    const clientToWorld = useCallback((clientX, clientY) => {
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
        if (!stage)
            return;
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
        const y = TOPBAR_HEIGHT +
            38 +
            (stage.clientHeight - TOPBAR_HEIGHT - 90 - contentH * zoom) / 2 -
            minY * zoom;
        setViewport({ x, y, zoom });
    }, []);
    useEffect(() => {
        if (restored)
            return;
        const timer = window.setTimeout(fitToContent, 80);
        return () => window.clearTimeout(timer);
    }, [fitToContent, restored]);
    const zoomBy = useCallback((factor, screenX, screenY) => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const cx = screenX ?? stage.clientWidth / 2;
        const cy = screenY ?? stage.clientHeight / 2;
        setViewport((current) => {
            const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
            const worldX = (cx - current.x) / current.zoom;
            const worldY = (cy - current.y) / current.zoom;
            return { x: cx - worldX * nextZoom, y: cy - worldY * nextZoom, zoom: nextZoom };
        });
    }, []);
    const resetZoom = useCallback(() => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const cx = stage.clientWidth / 2;
        const cy = stage.clientHeight / 2;
        setViewport((current) => {
            const worldX = (cx - current.x) / current.zoom;
            const worldY = (cy - current.y) / current.zoom;
            return { x: cx - worldX, y: cy - worldY, zoom: 1 };
        });
    }, []);
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage)
            return;
        const handleWheel = (event) => {
            const target = event.target;
            if (target.closest("textarea, input, select, .settings-backdrop"))
                return;
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
    const beginNodeDrag = useCallback((event, node) => {
        if (event.button !== 0)
            return;
        const target = event.target;
        if (target.closest("[data-no-drag], button, input, textarea, select, a, .port"))
            return;
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
    }, []);
    const startNodeResize = useCallback((event, node) => {
        if (event.button !== 0)
            return;
        event.preventDefault();
        event.stopPropagation();
        const minimum = nodeMinSize(node.kind);
        setSelectedId(node.id);
        resizeRef.current = {
            id: node.id,
            startX: event.clientX,
            startY: event.clientY,
            width: node.w,
            height: node.h,
            minWidth: minimum.width,
            minHeight: minimum.height,
        };
        document.body.classList.add("resizing-node");
    }, []);
    const startConnection = useCallback((event, node) => {
        event.preventDefault();
        event.stopPropagation();
        const start = { x: node.x + node.w, y: node.y + node.h / 2 };
        const pointer = clientToWorld(event.clientX, event.clientY);
        connectRef.current = { from: node.id, x1: start.x, y1: start.y };
        setConnection({ from: node.id, x1: start.x, y1: start.y, x2: pointer.x, y2: pointer.y });
    }, [clientToWorld]);
    useEffect(() => {
        const handlePointerMove = (event) => {
            const resize = resizeRef.current;
            if (resize) {
                const view = viewportRef.current;
                const dx = (event.clientX - resize.startX) / view.zoom;
                const dy = (event.clientY - resize.startY) / view.zoom;
                const width = clamp(resize.width + dx, resize.minWidth, 1800);
                const height = clamp(resize.height + dy, resize.minHeight, 1800);
                setNodes((current) => current.map((node) => node.id === resize.id ? { ...node, w: width, h: height } : node));
            }
            const drag = dragRef.current;
            if (drag) {
                const view = viewportRef.current;
                const dx = (event.clientX - drag.startX) / view.zoom;
                const dy = (event.clientY - drag.startY) / view.zoom;
                setNodes((current) => current.map((node) => node.id === drag.id ? { ...node, x: drag.nodeX + dx, y: drag.nodeY + dy } : node));
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
        const handlePointerUp = (event) => {
            if (connectRef.current) {
                const element = document.elementFromPoint(event.clientX, event.clientY);
                const inputPort = element?.closest("[data-input-node]");
                const to = inputPort?.dataset.inputNode;
                const from = connectRef.current.from;
                if (to && from !== to) {
                    setEdges((current) => {
                        if (current.some((edge) => edge.from === from && edge.to === to))
                            return current;
                        return [...current, { id: uid("edge"), from, to }];
                    });
                }
                connectRef.current = null;
                setConnection(null);
            }
            dragRef.current = null;
            resizeRef.current = null;
            panRef.current = null;
            setPanning(false);
            document.body.classList.remove("dragging-node");
            document.body.classList.remove("resizing-node");
        };
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            document.body.classList.remove("dragging-node");
            document.body.classList.remove("resizing-node");
        };
    }, [clientToWorld]);
    const addNode = useCallback((kind, point) => {
        const center = point ?? clientToWorld(window.innerWidth / 2, window.innerHeight / 2 + 30);
        const node = createNode(kind, 0, 0);
        node.x = center.x - node.w / 2;
        node.y = center.y - node.h / 2;
        setNodes((current) => [...current, node]);
        setSelectedId(node.id);
        notify(kind === "prompt"
            ? "已添加提示词节点。连接参考图后点击运行。"
            : kind === "output"
                ? "已添加输出节点。把一个结果节点连接到它即可预览成品。"
                : kind === "video"
                    ? "已添加视频节点。连接图片节点生成视频，或切换到视频编辑模式。"
                    : "已添加节点。");
    }, [clientToWorld, notify]);
    const createCommerceSet = useCallback(() => {
        const selected = selectedRef.current
            ? nodesRef.current.find((node) => node.id === selectedRef.current)
            : null;
        const selectedSource = selected && (selected.annotatedSrc || selected.src) ? selected : null;
        let sourceNode = selectedSource;
        if (!sourceNode) {
            const center = clientToWorld(window.innerWidth / 2, window.innerHeight / 2 + 30);
            sourceNode = createNode("image", center.x - 620, center.y - 300, {
                title: "商品原图",
                subtitle: "上传商品图片",
            });
        }
        const groupId = uid("commerce");
        const promptX = sourceNode.x + sourceNode.w + 120;
        const promptY = sourceNode.y - 30;
        const resultX = promptX + 520;
        const rowGap = 450;
        const promptSpecs = [
            {
                title: "电商主图 A",
                subtitle: "1:1 白底主图",
                resultTitle: "电商主图 A 结果",
                prompt: COMMERCE_MAIN_PROMPT,
                preset: "commerce-main",
                outputSize: "1440x1440",
            },
            {
                title: "电商主图 B",
                subtitle: "1:1 场景主图",
                resultTitle: "电商主图 B 结果",
                prompt: COMMERCE_MAIN_SCENE_PROMPT,
                preset: "commerce-main-2",
                outputSize: "1440x1440",
            },
            {
                title: "电商主图 C",
                subtitle: "1:1 细节主图",
                resultTitle: "电商主图 C 结果",
                prompt: COMMERCE_MAIN_DETAIL_PROMPT,
                preset: "commerce-main-3",
                outputSize: "1440x1440",
            },
            {
                title: "长图海报",
                subtitle: "3:8 竖版长图",
                resultTitle: "长图海报结果",
                prompt: COMMERCE_LONG_POSTER_PROMPT,
                preset: "commerce-poster",
                outputSize: "adaptive",
            },
        ];
        const promptNodes = promptSpecs.map((spec, index) => createNode("prompt", promptX, promptY + index * rowGap, {
            w: 400,
            h: 390,
            ...spec,
            commerceGroup: groupId,
        }));
        const resultNodes = promptSpecs.map((spec, index) => createNode("result", resultX, promptY + index * rowGap + 10, {
            w: 350,
            h: 360,
            title: spec.resultTitle,
        }));
        const mainPrompt = promptNodes[0];
        setNodes((current) => [
            ...current,
            ...(selectedSource ? [] : [sourceNode]),
            ...promptNodes,
            ...resultNodes,
        ]);
        setEdges((current) => [
            ...current,
            ...promptNodes.map((prompt) => ({
                id: uid("edge"),
                from: sourceNode.id,
                to: prompt.id,
            })),
            ...promptNodes.map((prompt, index) => ({
                id: uid("edge"),
                from: prompt.id,
                to: resultNodes[index].id,
            })),
        ]);
        setSelectedId(mainPrompt.id);
        window.setTimeout(fitToContent, 120);
        notify(selectedSource
            ? "整套电商图已创建：3 张主图 + 1 张长图海报。补充卖点后点“生成套图”。"
            : "整套电商图已创建：3 张主图 + 1 张长图海报。请先上传商品图，再点“生成套图”。", "success");
    }, [clientToWorld, fitToContent, notify]);
    const addBuckleReference = useCallback(async () => {
        try {
            notify("正在加载 CHAOPAI 品牌卡扣参考图…", "info");
            const response = await fetch("./reference/brand-buckle-chaopai.jpg?v=tight-1", { cache: "no-store" });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const file = new File([blob], "brand-buckle-chaopai.jpg", {
                type: blob.type || "image/jpeg",
            });
            const src = await fileToDataUrl(file, 1280);
            const existing = nodesRef.current.find((node) => node.kind === "image" && node.title === "品牌卡扣参考");
            const promptNodes = nodesRef.current.filter((node) => node.kind === "prompt" &&
                (node.preset?.startsWith("commerce") ||
                    /电商|商品|主图|海报|详情|脚垫/.test(node.prompt || "")));
            const center = clientToWorld(window.innerWidth / 2, window.innerHeight / 2 + 30);
            const node = existing ||
                createNode("image", center.x - 140, center.y - 135, {
                    title: "品牌卡扣参考",
                    subtitle: "CHAOPAI 金属徽标 · 图二",
                    src,
                    status: "done",
                });
            if (existing) {
                setNodes((current) => current.map((item) => item.id === existing.id
                    ? {
                        ...item,
                        src,
                        status: "done",
                        subtitle: "CHAOPAI 金属徽标 · 图二特写",
                    }
                    : item));
            }
            else {
                setNodes((current) => [...current, node]);
            }
            if (promptNodes.length > 0) {
                setEdges((current) => {
                    const additions = promptNodes
                        .filter((prompt) => !current.some((edge) => edge.from === node.id && edge.to === prompt.id))
                        .map((prompt) => ({
                        id: uid("edge"),
                        from: node.id,
                        to: prompt.id,
                    }));
                    return additions.length ? [...current, ...additions] : current;
                });
            }
            window.setTimeout(fitToContent, 120);
            notify(promptNodes.length > 0
                ? `已添加卡扣参考图，并连接到 ${promptNodes.length} 个电商提示词。`
                : "已添加卡扣参考图。请把它连接到需要出现卡扣的提示词节点。", "success");
        }
        catch (error) {
            notify(`卡扣参考图加载失败：${error?.message || error}`, "error");
        }
    }, [clientToWorld, fitToContent, notify, setEdges, setNodes]);
    const chooseImages = useCallback((point) => {
        insertPointRef.current = point ?? null;
        uploadTargetRef.current = { kind: "new" };
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    }, []);
    const chooseNodeImage = useCallback((id) => {
        uploadTargetRef.current = { kind: "node", id };
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    }, []);
    const addImageFiles = useCallback(async (files, point) => {
        const images = files.filter((file) => file.type.startsWith("image/"));
        if (images.length === 0)
            return;
        const origin = point ??
            insertPointRef.current ??
            clientToWorld(window.innerWidth / 2, window.innerHeight / 2 + 30);
        const created = [];
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
            }
            catch (error) {
                notify(error?.message || "读取图片失败", "error");
            }
        }
        if (created.length > 0) {
            setNodes((current) => [...current, ...created]);
            setSelectedId(created[created.length - 1].id);
            notify(`已添加 ${created.length} 个图片节点`, "success");
        }
    }, [clientToWorld, notify]);
    const handleFileInput = useCallback(async (files) => {
        if (!files || files.length === 0)
            return;
        const target = uploadTargetRef.current;
        if (target?.kind === "node") {
            try {
                const src = await fileToDataUrl(files[0]);
                patchNode(target.id, {
                    src,
                    subtitle: files[0].name,
                    status: "done",
                    annotatedSrc: undefined,
                    annotationNote: undefined,
                    annotationStrokes: undefined,
                });
                notify("参考图已更新", "success");
            }
            catch (error) {
                notify(error?.message || "读取图片失败", "error");
            }
        }
        else {
            await addImageFiles(Array.from(files));
        }
        uploadTargetRef.current = null;
        insertPointRef.current = null;
    }, [addImageFiles, notify, patchNode]);
    const autoLayout = useCallback(() => {
        setNodes((current) => {
            const xByKind = {
                image: 80,
                prompt: 430,
                result: 910,
                output: 1340,
                video: 1810,
            };
            const yByKind = {
                image: 90,
                prompt: 150,
                result: 130,
                output: 205,
                video: 120,
            };
            const counts = {
                image: 0,
                prompt: 0,
                result: 0,
                output: 0,
                video: 0,
            };
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
        if (!window.confirm("清空当前画布上的所有节点和连线？"))
            return;
        for (const controller of videoAbortRef.current.values())
            controller.abort();
        videoAbortRef.current.clear();
        setNodes([]);
        setEdges([]);
        setSelectedId(null);
        setConnection(null);
        notify("画布已清空");
    }, [notify]);
    const runPromptNode = useCallback(async (promptId) => {
        const promptNode = nodesRef.current.find((node) => node.id === promptId && node.kind === "prompt");
        if (!promptNode || promptNode.status === "running")
            return;
        if (!settings.apiKey.trim()) {
            setSettingsDraft(settings);
            setSettingsOpen(true);
            notify("请先在设置里填写方舟 API Key", "error");
            return;
        }
        if (/^apikey-/i.test(settings.apiKey.trim())) {
            setSettingsDraft(settings);
            setSettingsOpen(true);
            notify("现在填的是资源 ID，不是 API Key。请回到方舟 API Key 管理，点眼睛图标复制完整密钥。", "error");
            return;
        }
        if (!settings.imageModel) {
            setSettingsDraft(settings);
            setSettingsOpen(true);
            notify("请先在设置里填写图生图模型或接入点", "error");
            return;
        }
        const sourceNodes = nodesRef.current.filter((node) => {
            const connected = edgesRef.current.some((edge) => edge.to === promptId && edge.from === node.id);
            return connected && Boolean(node.annotatedSrc || node.src);
        });
        const sources = sourceNodes
            .map((node) => node.annotatedSrc || node.src)
            .filter((src) => Boolean(src));
        if (sources.length === 0) {
            notify("先把至少一张图片节点连接到提示词节点左侧端口", "error");
            return;
        }
        if (!promptNode.prompt?.trim()) {
            notify("提示词还是空的，先写下你想怎么生成", "error");
            return;
        }
        const annotationNotes = sourceNodes
            .map((node, index) => {
            if (!node.annotatedSrc)
                return "";
            const note = node.annotationNote?.trim();
            if (!note)
                return "";
            return sourceNodes.length === 1
                ? `标注修改说明：${note}`
                : `第 ${index + 1} 张参考图的标注修改说明：${note}`;
        })
            .filter((note) => Boolean(note));
        const hasAnnotations = sourceNodes.some((node) => Boolean(node.annotatedSrc));
        const hasBuckleReference = sourceNodes.some((node) => node.title === "品牌卡扣参考");
        const productFacts = (settings.productFacts || "").trim();
        const shouldAppendProductFacts = Boolean(productFacts) &&
            /电商|商品|主驾|脚垫|海报|详情|淘宝|天猫|京东/.test(promptNode.prompt);
        const fullPrompt = [
            promptNode.prompt.trim(),
            shouldAppendProductFacts
                ? `【商品事实锁定 · 必须遵守】\n${productFacts}`
                : "",
            hasBuckleReference
                ? "其中标题为“品牌卡扣参考”的图片只用于锁定 CHAOPAI 卡扣的 logo、字标、金属质感和结构，不要把该特写构图、背景或视角复制到成品画面；卡扣应按实际位置嵌入对应毯面。画面中禁止出现黑色圆形固定扣、黑色圆孔或黑色塑料件，只展示 CHAOPAI 银色品牌徽标扣。"
                : "",
            ...annotationNotes,
            hasAnnotations
                ? "参考图上的彩色涂抹、线条或框选只表示需要修改的位置。只修改标注区域，未标注区域保持原样，不要把彩色标注线保留在最终画面中。"
                : "",
        ]
            .filter(Boolean)
            .join("\n\n");
        const isCommerceMain = Boolean(promptNode.preset?.startsWith("commerce-main")) ||
            /电商.*主图|商品主图/.test(promptNode.prompt);
        const isCommercePoster = promptNode.preset === "commerce-poster" ||
            /长图海报|详情长图|海报长图/.test(promptNode.prompt);
        const resolvedOutputSize = isCommerceMain
            ? settings.mainImageSize || "1440x1440"
            : isCommercePoster
                ? "adaptive"
                : promptNode.outputSize || outputSize;
        patchNode(promptId, { status: "running" });
        try {
            const resultSrc = await editImage(sources.length === 1 ? sources[0] : sources, fullPrompt, settings, resolvedOutputSize);
            const outgoing = edgesRef.current
                .filter((edge) => edge.from === promptId)
                .map((edge) => nodesRef.current.find((node) => node.id === edge.to))
                .filter(Boolean);
            const emptyResult = outgoing.find((node) => node.kind === "result" &&
                (!node.src || Boolean(promptNode.preset)));
            if (emptyResult) {
                patchNode(emptyResult.id, {
                    src: resultSrc,
                    status: "done",
                    annotatedSrc: undefined,
                    annotationNote: undefined,
                    annotationStrokes: undefined,
                });
                setSelectedId(emptyResult.id);
            }
            else {
                const resultCount = outgoing.filter((node) => node.kind === "result").length;
                const resultNode = createNode("result", promptNode.x + promptNode.w + 110, promptNode.y + resultCount * 72, { src: resultSrc, status: "done", title: `生成结果 ${resultCount + 1}` });
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
        }
        catch (error) {
            patchNode(promptId, { status: "idle" });
            notify(String(error?.message || error), "error");
        }
    }, [notify, outputSize, patchNode, settings]);
    const runCommerceSet = useCallback(async (groupId) => {
        const presetOrder = [
            "commerce-main",
            "commerce-main-2",
            "commerce-main-3",
            "commerce-poster",
        ];
        const prompts = nodesRef.current
            .filter((node) => node.kind === "prompt" && node.commerceGroup === groupId)
            .sort((a, b) => presetOrder.indexOf(a.preset || "") -
            presetOrder.indexOf(b.preset || ""));
        if (prompts.length === 0) {
            notify("没有找到这套电商提示词节点", "error");
            return;
        }
        if (prompts.some((node) => node.status === "running")) {
            notify("这套电商图正在生成中，请等当前任务完成", "info");
            return;
        }
        notify("整套生成开始：3 张主图 + 1 张长图海报，将依次生成。", "info");
        for (const prompt of prompts) {
            await runPromptNode(prompt.id);
        }
    }, [notify, runPromptNode]);
    const runVideoNode = useCallback(async (videoId) => {
        const videoNode = nodesRef.current.find((node) => node.id === videoId && node.kind === "video");
        if (!videoNode || videoNode.status === "running")
            return;
        if (!settings.apiKey) {
            setSettingsDraft(settings);
            setSettingsOpen(true);
            notify("请先在设置里填写方舟 API Key", "error");
            return;
        }
        if (!settings.videoModel) {
            setSettingsDraft(settings);
            setSettingsOpen(true);
            notify("请先在设置里填写 Seedance 视频模型或接入点", "error");
            return;
        }
        const mode = videoNode.videoMode === "edit" ? "edit" : "image";
        const incoming = edgesRef.current
            .filter((edge) => edge.to === videoId)
            .map((edge) => nodesRef.current.find((node) => node.id === edge.from))
            .filter(Boolean);
        const imageUrls = incoming
            .map((node) => node.src)
            .filter((src) => Boolean(src));
        const upstreamVideo = incoming
            .map((node) => node.videoResultUrl || node.videoSourceUrl)
            .find((url) => Boolean(url));
        const sourceVideo = videoNode.videoSourceUrl?.trim() || upstreamVideo || "";
        if (mode === "image" && imageUrls.length === 0) {
            notify("图生视频需要先把至少一张图片节点连接到视频节点", "error");
            return;
        }
        if (mode === "edit" && !sourceVideo) {
            notify("视频编辑需要连接一个上游视频，或填写公网视频 URL", "error");
            return;
        }
        if (!videoNode.prompt?.trim()) {
            notify("视频提示词还是空的，先写下镜头或修改要求", "error");
            return;
        }
        const controller = new AbortController();
        videoAbortRef.current.set(videoId, controller);
        patchNode(videoId, {
            status: "running",
            videoTaskStatus: "queued",
            videoError: undefined,
        });
        try {
            const result = await generateVideo({
                mode,
                prompt: videoNode.prompt,
                imageUrls,
                videoUrl: sourceVideo,
                resolution: videoNode.resolution || "720p",
                ratio: videoNode.ratio || "adaptive",
                duration: videoNode.duration || 5,
                generateAudio: videoNode.generateAudio !== false,
                watermark: false,
            }, settings, (task) => {
                patchNode(videoId, {
                    videoTaskId: task.id || undefined,
                    videoTaskStatus: task.status || "running",
                    ...(task.videoUrl ? { videoResultUrl: task.videoUrl } : {}),
                });
            }, controller.signal);
            patchNode(videoId, {
                status: "done",
                videoTaskId: result.id,
                videoTaskStatus: result.status || "succeeded",
                videoResultUrl: result.videoUrl,
                videoError: undefined,
            });
            setSelectedId(videoId);
            notify("视频生成完成，结果已写入视频节点", "success");
        }
        catch (error) {
            const cancelled = error?.name === "AbortError";
            patchNode(videoId, {
                status: "idle",
                videoTaskStatus: cancelled ? "cancelled" : "failed",
                videoError: cancelled ? undefined : String(error?.message || error),
            });
            notify(cancelled ? "已停止等待视频任务" : String(error?.message || error), cancelled ? "info" : "error");
        }
        finally {
            videoAbortRef.current.delete(videoId);
        }
    }, [notify, patchNode, settings]);
    const runSelected = useCallback(() => {
        const selected = selectedRef.current
            ? nodesRef.current.find((node) => node.id === selectedRef.current)
            : null;
        if (selected?.kind === "video") {
            if (selected.status === "running") {
                notify("这个视频节点正在生成中", "info");
                return;
            }
            void runVideoNode(selected.id);
            return;
        }
        let promptNode = selected?.kind === "prompt"
            ? selected
            : nodesRef.current.find((node) => node.kind === "prompt" && node.status !== "running");
        if (!promptNode && selected) {
            const incoming = edgesRef.current.find((edge) => edge.to === selected.id);
            promptNode = nodesRef.current.find((node) => node.id === incoming?.from && node.kind === "prompt");
        }
        if (!promptNode) {
            const videoNode = nodesRef.current.find((node) => node.kind === "video" && node.status !== "running");
            if (videoNode) {
                void runVideoNode(videoNode.id);
                return;
            }
            notify("先选择一个提示词或视频节点，或添加一个新节点", "info");
            return;
        }
        void runPromptNode(promptNode.id);
    }, [notify, runPromptNode, runVideoNode]);
    const useAsReference = useCallback((node) => {
        const source = node.annotatedSrc || node.src;
        if (!source)
            return;
        const imageNode = createNode("image", node.x - 320, node.y + 12, {
            src: source,
            title: "结果参考",
            subtitle: node.annotatedSrc ? "From annotated result" : "From result",
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
    }, [notify]);
    const saveSettingsDraft = useCallback(() => {
        const mainSizeMatch = /^(\d{2,5})[xX×](\d{2,5})$/.exec((settingsDraft.mainImageSize || "").trim());
        const mainImageSize = mainSizeMatch
            ? `${mainSizeMatch[1]}x${mainSizeMatch[2]}`
            : "1440x1440";
        const next = {
            ...settingsDraft,
            brandName: (settingsDraft.brandName || "").trim() || "AI Workflow",
            brandSubtitle: (settingsDraft.brandSubtitle || "").trim(),
            brandLogo: settingsDraft.brandLogo || "",
            productFacts: settingsDraft.productFacts || "",
            mainImageSize,
            edgeColorMode: settingsDraft.edgeColorMode === "single" ? "single" : "multi",
            edgeColor: normalizeEdgeColor(settingsDraft.edgeColor),
            baseUrl: settingsDraft.baseUrl.trim(),
            apiKey: settingsDraft.apiKey.trim().replace(/^Bearer\s+/i, "").trim(),
            imageModel: settingsDraft.imageModel.trim(),
            videoModel: (settingsDraft.videoModel || "").trim(),
            model: settingsDraft.model.trim(),
        };
        saveSettings(next);
        setSettings(next);
        setSettingsOpen(false);
        notify("画布与模型设置已保存", "success");
    }, [notify, settingsDraft]);
    useEffect(() => {
        document.title = (settings.brandName || "").trim() || "AI Workflow";
    }, [settings.brandName]);
    useEffect(() => {
        let link = document.querySelector('link[data-app-favicon="true"]');
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            link.dataset.appFavicon = "true";
            document.head.appendChild(link);
        }
        link.href = settings.brandLogo || DEFAULT_FAVICON;
    }, [settings.brandLogo]);
    useEffect(() => {
        setSaveState("saving");
        const timer = window.setTimeout(() => {
            const state = { title, nodes, edges, viewport, outputSize };
            if (saveWorkflow(state)) {
                setSaveState("saved");
                return;
            }
            const withoutLargeImages = {
                ...state,
                nodes: nodes.map((node) => ({
                    ...node,
                    ...(node.src?.startsWith("data:") ? { src: undefined } : {}),
                    ...(node.annotatedSrc?.startsWith("data:")
                        ? { annotatedSrc: undefined }
                        : {}),
                })),
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
        const handleKeyDown = (event) => {
            const target = event.target;
            const typing = target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;
            if (event.key === "Escape") {
                if (annotationId) {
                    setAnnotationId(null);
                    return;
                }
                if (settingsOpen) {
                    setSettingsOpen(false);
                }
                else {
                    connectRef.current = null;
                    setConnection(null);
                    setSelectedId(null);
                }
                return;
            }
            if (annotationId)
                return;
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
    }, [annotationId, deleteNode, runSelected, settingsOpen]);
    const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
    const annotationNode = annotationId ? nodeById.get(annotationId) : undefined;
    const inputStats = useMemo(() => {
        const map = new Map();
        for (const edge of edges) {
            const source = nodeById.get(edge.from);
            if (!source)
                continue;
            const entry = map.get(edge.to) || { imageCount: 0, videoUrl: "" };
            if (source.src)
                entry.imageCount += 1;
            if (source.kind === "video" && (source.videoResultUrl || source.videoSourceUrl)) {
                entry.videoUrl = source.videoResultUrl || source.videoSourceUrl || entry.videoUrl;
            }
            map.set(edge.to, entry);
        }
        return map;
    }, [edges, nodeById]);
    const displaySources = useMemo(() => {
        const map = new Map();
        for (const node of nodes) {
            const nodeSource = node.annotatedSrc || node.src;
            if (nodeSource)
                map.set(node.id, nodeSource);
            if (node.kind === "video" && !node.videoResultUrl) {
                const firstImage = edges
                    .filter((edge) => edge.to === node.id)
                    .map((edge) => nodeById.get(edge.from))
                    .find((source) => source?.annotatedSrc || source?.src);
                const firstImageSrc = firstImage?.annotatedSrc || firstImage?.src;
                if (firstImageSrc)
                    map.set(node.id, firstImageSrc);
            }
            if (node.kind === "output" && !node.src) {
                const incoming = [...edges].reverse().find((edge) => edge.to === node.id);
                const source = incoming ? nodeById.get(incoming.from) : undefined;
                const outputSrc = source?.annotatedSrc || source?.src;
                if (outputSrc)
                    map.set(node.id, outputSrc);
            }
        }
        return map;
    }, [edges, nodeById, nodes]);
    const displayVideoSources = useMemo(() => {
        const map = new Map();
        for (const edge of edges) {
            const target = nodeById.get(edge.to);
            if (target?.kind !== "output")
                continue;
            const source = nodeById.get(edge.from);
            const url = source?.kind === "video" ? source.videoResultUrl : undefined;
            if (url)
                map.set(target.id, url);
        }
        return map;
    }, [edges, nodeById]);
    const modelLabel = useMemo(() => {
        const model = settings.imageModel.toLowerCase();
        if (model.includes("pro"))
            return "Seedream 5.0 Pro";
        if (model.includes("flash"))
            return "Seedream 5.0 Flash";
        if (model.includes("seededit"))
            return "SeedEdit 3.0";
        return "图生图模型";
    }, [settings.imageModel]);
    const videoModelLabel = useMemo(() => {
        const model = (settings.videoModel || "").toLowerCase();
        if (!model)
            return "";
        if (model.includes("seedance")) {
            return model.includes("pro") ? "Seedance Pro" : "Seedance";
        }
        if (model.startsWith("ep-"))
            return "Seedance 接入点";
        return "Seedance";
    }, [settings.videoModel]);
    const isRunning = nodes.some((node) => node.status === "running");
    const visibleEdges = edges
        .map((edge) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to)
            return null;
        return { edge, path: edgePath(from, to) };
    })
        .filter(Boolean);
    const edgeColor = normalizeEdgeColor(settings.edgeColor);
    const edgePaintStyle = (index) => {
        if (settings.edgeColorMode === "multi") {
            const colors = rotatedEdgeColors(index);
            return {
                "--edge-paint": `url(#edge-paint-${index})`,
                "--edge-glow-color": colors[0],
            };
        }
        return {
            "--edge-paint": edgeColor,
            "--edge-flow-paint": `color-mix(in srgb, ${edgeColor} 58%, white)`,
            "--edge-glow-color": edgeColor,
        };
    };
    return (_jsxs("div", { className: "workflow-app", style: { "--edge-color": edgeColor }, children: [_jsxs("header", { className: "workflow-topbar", children: [_jsxs("div", { className: "brand-block", children: [_jsx("span", { className: `app-mark${settings.brandLogo ? " has-logo" : ""}`, children: settings.brandLogo ? (_jsx("img", { src: settings.brandLogo, alt: "\u753B\u5E03 Logo" })) : (_jsx(Icon, { name: "workflow", size: 18 })) }), _jsxs("div", { className: "brand-copy", children: [_jsx("span", { className: "brand-name", children: settings.brandName || "AI Workflow" }), settings.brandSubtitle && (_jsx("span", { className: "brand-sub", children: settings.brandSubtitle }))] }), _jsx("span", { className: "topbar-divider" }), _jsxs("div", { className: "title-block", children: [_jsx("span", { className: "title-prefix", children: "\u5DE5\u4F5C\u6D41" }), _jsx("input", { className: "workflow-title-input", value: title, onChange: (event) => setTitle(event.target.value), "aria-label": "\u5DE5\u4F5C\u6D41\u540D\u79F0" })] })] }), _jsxs("div", { className: "topbar-center", children: [_jsxs("button", { className: "tool-btn", onClick: () => chooseImages(), children: [_jsx(Icon, { name: "plus", size: 14 }), "\u56FE\u7247"] }), _jsxs("button", { className: "tool-btn", onClick: () => addNode("prompt"), children: [_jsx(Icon, { name: "text", size: 14 }), "\u63D0\u793A\u8BCD"] }), _jsxs("button", { className: "tool-btn", onClick: () => addNode("video"), children: [_jsx(Icon, { name: "video", size: 14 }), "\u89C6\u9891"] }), _jsxs("button", { className: "tool-btn", onClick: () => addNode("output"), children: [_jsx(Icon, { name: "grid", size: 14 }), "\u8F93\u51FA"] }), _jsxs("button", { className: "tool-btn", onClick: createCommerceSet, title: "\u521B\u5EFA 3 \u5F20\u7535\u5546\u4E3B\u56FE\u4E0E 1 \u5F20\u957F\u56FE\u6D77\u62A5", children: [_jsx(Icon, { name: "sparkles", size: 14 }), "\u7535\u5546\u5957\u56FE"] }), _jsxs("button", { className: "tool-btn", onClick: addBuckleReference, title: "\u6DFB\u52A0 CHAOPAI \u54C1\u724C\u5361\u6263\u53C2\u8003\u56FE\uFF0C\u5E76\u8FDE\u63A5\u5230\u7535\u5546\u63D0\u793A\u8BCD", children: [_jsx(Icon, { name: "image", size: 14 }), "\u5361\u6263\u53C2\u8003"] }), _jsxs("button", { className: "tool-btn", onClick: () => window.open("./main-image.html", "_blank"), title: "\u7ED9\u751F\u6210\u56FE\u52A0\u4E2D\u6587\u6807\u9898\u548C\u5356\u70B9\uFF0C\u8F93\u51FA 1440\u00D71440 \u6210\u54C1\u4E3B\u56FE", children: [_jsx(Icon, { name: "text", size: 14 }), "\u4E3B\u56FE\u6392\u7248"] }), _jsx("span", { className: "tool-separator" }), _jsx("button", { className: "icon-tool-btn", title: "\u81EA\u52A8\u6392\u5217", onClick: autoLayout, children: _jsx(Icon, { name: "workflow", size: 15 }) }), _jsx("button", { className: "icon-tool-btn", title: "\u5168\u89C8\u753B\u5E03", onClick: fitToContent, children: _jsx(Icon, { name: "fit", size: 15 }) }), _jsx("button", { className: "icon-tool-btn", title: "\u6E05\u7A7A\u753B\u5E03", onClick: clearWorkflow, children: _jsx(Icon, { name: "trash", size: 15 }) })] }), _jsxs("div", { className: "topbar-right", children: [_jsxs("span", { className: `save-indicator ${saveState}`, children: [_jsx("span", { className: "save-dot" }), saveState === "saving"
                                        ? "保存中"
                                        : saveState === "partial"
                                            ? "部分保存"
                                            : saveState === "failed"
                                                ? "保存失败"
                                                : "已保存"] }), _jsx("button", { className: "icon-tool-btn", title: "\u753B\u5E03\u8BBE\u7F6E", onClick: () => {
                                    setSettingsDraft(settings);
                                    setSettingsOpen(true);
                                }, children: _jsx(Icon, { name: "settings", size: 16 }) }), _jsxs("button", { className: "primary-btn run-top-btn", disabled: isRunning, onClick: runSelected, children: [isRunning ? _jsx("span", { className: "spinner small" }) : _jsx(Icon, { name: "play", size: 13 }), isRunning ? "运行中" : "运行工作流"] })] })] }), _jsxs("main", { ref: stageRef, className: `workflow-stage${panning ? " panning" : ""}`, style: {
                    backgroundColor: "#0a0a0b",
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.105) 1px, transparent 1px)",
                    backgroundSize: `${26 * viewport.zoom}px ${26 * viewport.zoom}px`,
                    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                }, onPointerDown: (event) => {
                    if (event.button !== 0)
                        return;
                    const target = event.target;
                    if (target.closest(".node-card, .canvas-ui, .empty-workflow"))
                        return;
                    setSelectedId(null);
                    panRef.current = {
                        startX: event.clientX,
                        startY: event.clientY,
                        viewportX: viewportRef.current.x,
                        viewportY: viewportRef.current.y,
                    };
                    setPanning(true);
                }, onDragOver: (event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                }, onDrop: (event) => {
                    event.preventDefault();
                    const point = clientToWorld(event.clientX, event.clientY);
                    void addImageFiles(Array.from(event.dataTransfer.files), point);
                }, children: [_jsx("div", { className: "workflow-world", style: {
                            transform: `translate(${viewport.x}px, ${viewport.y}px)`,
                        }, children: _jsxs("div", { className: "workflow-zoom", style: { zoom: `${viewport.zoom}` }, children: [_jsxs("svg", { className: "edge-layer", width: "1", height: "1", "aria-hidden": "true", children: [_jsx("defs", { children: visibleEdges.map(({ edge, path }, index) => {
                                                const colors = rotatedEdgeColors(index);
                                                return (_jsx("linearGradient", { id: `edge-paint-${index}`, gradientUnits: "userSpaceOnUse", x1: path.x1, y1: path.y1, x2: path.x2, y2: path.y2, children: colors.map((color, stopIndex) => (_jsx("stop", { offset: `${(stopIndex / (colors.length - 1)) * 100}%`, stopColor: color }, `${edge.id}-${stopIndex}`))) }, edge.id));
                                            }) }), visibleEdges.map(({ edge, path }, index) => (_jsxs("g", { style: edgePaintStyle(index), children: [_jsx("path", { className: "edge-shadow", d: path.d }), _jsx("path", { className: "edge-glow", d: path.d }), _jsx("path", { className: "edge-line", d: path.d }), _jsx("path", { className: "edge-flow-halo", d: path.d, pathLength: 100, style: { animationDelay: `${-(index % 7) * 0.24}s` } }), _jsx("path", { className: "edge-flow", d: path.d, pathLength: 100, style: { animationDelay: `${-(index % 7) * 0.24}s` } }), _jsx("path", { className: "edge-hit", d: path.d, onDoubleClick: () => deleteEdge(edge.id), children: _jsx("title", { children: "\u53CC\u51FB\u5220\u9664\u8FDE\u7EBF" }) }), _jsx("circle", { className: "edge-dot", cx: path.x1, cy: path.y1, r: "2.7" }), _jsx("circle", { className: "edge-dot", cx: path.x2, cy: path.y2, r: "2.7" })] }, edge.id))), connection && (_jsx("path", { className: "edge-draft", d: `M ${connection.x1} ${connection.y1} C ${connection.x1 + Math.max(70, Math.abs(connection.x2 - connection.x1) * 0.4)} ${connection.y1}, ${connection.x2 - Math.max(70, Math.abs(connection.x2 - connection.x1) * 0.4)} ${connection.y2}, ${connection.x2} ${connection.y2}` }))] }), nodes.map((node) => (_jsx(NodeCard, { node: node, displaySrc: displaySources.get(node.id) || "", displayVideo: displayVideoSources.get(node.id) || "", inputImageCount: inputStats.get(node.id)?.imageCount || 0, inputVideoUrl: inputStats.get(node.id)?.videoUrl || "", selected: selectedId === node.id, running: node.status === "running", modelLabel: modelLabel, videoModelLabel: videoModelLabel, onPointerDown: beginNodeDrag, onStartResize: startNodeResize, onStartConnect: startConnection, onPatch: patchNode, onPickImage: chooseNodeImage, onAnnotate: (id) => setAnnotationId(id), onDelete: deleteNode, onDownload: (target) => {
                                        const source = displayVideoSources.get(target.id) ||
                                            target.videoResultUrl ||
                                            target.src ||
                                            displaySources.get(target.id) ||
                                            "";
                                        if (source)
                                            void downloadMedia(source);
                                    }, onUseAsReference: useAsReference, onRun: (id) => {
                                        if (nodeById.get(id)?.kind === "video") {
                                            void runVideoNode(id);
                                        }
                                        else {
                                            void runPromptNode(id);
                                        }
                                    }, onRunCommerceSet: (groupId) => void runCommerceSet(groupId), onStopVideo: (id) => {
                                        videoAbortRef.current.get(id)?.abort();
                                    } }, node.id)))] }) }), nodes.length === 0 && (_jsxs("div", { className: "empty-workflow canvas-ui", onPointerDown: (event) => event.stopPropagation(), children: [_jsx("span", { className: "empty-mark", children: _jsx(Icon, { name: "workflow", size: 28 }) }), _jsx("h2", { children: "\u642D\u5EFA\u7B2C\u4E00\u6761 AI \u56FE\u50CF\u5DE5\u4F5C\u6D41" }), _jsx("p", { children: "\u4E0A\u4F20\u53C2\u8003\u56FE\uFF0C\u6DFB\u52A0\u63D0\u793A\u8BCD\uFF0C\u7528\u8282\u70B9\u7AEF\u53E3\u8FDE\u63A5\u5B83\u4EEC\uFF0C\u7136\u540E\u8FD0\u884C\u751F\u6210\u3002" }), _jsxs("div", { children: [_jsxs("button", { className: "primary-btn", onClick: () => chooseImages(), children: [_jsx(Icon, { name: "image", size: 14 }), "\u6DFB\u52A0\u53C2\u8003\u56FE"] }), _jsxs("button", { className: "secondary-btn", onClick: () => addNode("prompt"), children: [_jsx(Icon, { name: "text", size: 14 }), "\u6DFB\u52A0\u63D0\u793A\u8BCD"] })] })] })), _jsxs("div", { className: "canvas-hud canvas-ui", onPointerDown: (event) => event.stopPropagation(), children: [_jsx("button", { title: "\u7F29\u5C0F", onClick: () => zoomBy(0.84), children: _jsx(Icon, { name: "minus", size: 14 }) }), _jsxs("button", { className: "zoom-readout", onClick: fitToContent, title: "\u70B9\u51FB\u67E5\u770B\u5168\u90E8\u8282\u70B9", children: [Math.round(viewport.zoom * 100), "%"] }), _jsx("button", { title: "\u653E\u5927", onClick: () => zoomBy(1.18), children: _jsx(Icon, { name: "plus", size: 14 }) }), _jsx("button", { className: "zoom-reset", onClick: resetZoom, title: "\u56DE\u5230 100% \u6E05\u6670\u663E\u793A", children: "1:1" })] }), _jsx("div", { className: "canvas-tip canvas-ui", children: "\u62D6\u52A8\u753B\u5E03 \u00B7 \u6EDA\u8F6E\u7F29\u653E \u00B7 \u62D6\u8282\u70B9\u53F3\u4E0B\u89D2\u8C03\u6574\u5927\u5C0F \u00B7 \u53CC\u51FB\u8FDE\u7EBF\u5220\u9664" })] }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", multiple: true, hidden: true, onChange: (event) => void handleFileInput(event.target.files) }), settingsOpen && (_jsx(SettingsModal, { draft: settingsDraft, outputSize: outputSize, onDraft: setSettingsDraft, onOutputSize: setOutputSize, onClose: () => setSettingsOpen(false), onSave: saveSettingsDraft })), annotationNode && (_jsx(AnnotationModal, { node: annotationNode, onClose: () => setAnnotationId(null), onSave: (patch) => {
                    patchNode(annotationNode.id, patch);
                    setAnnotationId(null);
                    notify("标注已保存。运行提示词时会按标注区域修改。", "success");
                }, onClear: () => {
                    patchNode(annotationNode.id, {
                        annotatedSrc: undefined,
                        annotationNote: undefined,
                        annotationStrokes: undefined,
                    });
                    setAnnotationId(null);
                    notify("已清除这张图片的标注", "info");
                } }, annotationNode.id)), toast && (_jsxs("div", { className: `workflow-toast ${toast.kind}`, onClick: () => setToast(null), children: [_jsx("span", { className: "toast-icon", children: _jsx(Icon, { name: toast.kind === "success"
                                ? "check"
                                : toast.kind === "error"
                                    ? "x"
                                    : "sparkles", size: 14 }) }), _jsx("span", { children: toast.message })] }))] }));
}
