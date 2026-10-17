# AI 图生图画布（开源）

基于 [tldraw](https://tldraw.dev) + React + Vite 的无限画布，接入火山方舟豆包 Seedream / SeedEdit 等支持图片编辑的模型。上传原图，写一句改图要求，就能在画布上得到改图结果。

重点不是“文字生成卡片”：打开后默认进入 **图生图（改图）** 页面。

## 图生图功能
- 上传、拖入图片，或直接选中画布上的图片作为原图
- 输入改图指令，例如“把毯面颜色改成白色星空毯，其他内容保持不变”
- 保持原图比例，支持 2K / 4K 输出
- 原图与改图结果预览，一键下载、放到画布继续编辑
- 自动压缩过大的原图，避免接口 10MB 限制
- 支持 Seedream 5.0 Flash / Pro、SeedEdit 3.0 等图生图模型

> 火山方舟目前最高支持 4K 输出；需要 8K 时，建议下载 4K 结果后再做无损放大。

## 其他功能
- 无限缩放 / 平移画布，便签、图形、箭头、手绘
- AI 一句话拆解成结构化卡片并自动连线（附加功能）
- 单卡 AI 扩写 / 精简 / 译英，多卡总结
- 导出画布 PNG、全览、清空
- 接口配置和画布自动保存在浏览器本地
- 纯前端，可部署到 Vercel / Netlify / GitHub Pages

## 本地运行
```bash
cd ai-infinite-canvas
npm install
npm run dev
```

打开 http://localhost:5180 ，左上角 ⚙ 填写接口配置。

Windows 也可以双击 `start-dev.bat`，保持窗口开启即可。

## 模型配置

点击左上角 ⚙：

1. **接口地址**：`https://ark.cn-beijing.volces.com/api/v3`
2. **API Key**：火山方舟 API Key
3. **图生图模型**：填 Seedream / SeedEdit 的模型 ID 或推理接入点 ID，例如：
   - `doubao-seedream-5-0-flash-260915`
   - `doubao-seedream-5-0-pro-260628`
   - `doubao-seededit-3-0-i2i-250628`
   - 或你在方舟控制台创建的 `ep-...` 接入点 ID
4. **文本模型**：只有使用 “AI 卡片” 附加功能时才需要

也可以使用 `.env.local`：
```bash
VITE_OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VITE_OPENAI_API_KEY=你的密钥
VITE_IMAGE_MODEL=doubao-seedream-5-0-flash-260915
VITE_OPENAI_MODEL=doubao-seed-2-1-lite-260915
```

修改 `.env.local` 后需要重启开发服务器。

## 常见问题

**提示 ModelNotOpen**

账号还没有开通该模型。到火山方舟控制台开通对应模型，或创建该模型的推理接入点，再把 `ep-...` 填进“图生图模型”。

**上传后无法发送**

请使用 JPG / PNG / WebP；单张图片建议不超过 10MB。应用会把最长边压到 4096px，仍保留足够细节。

**结果不能下载 / 放到画布**

部分对象存储结果地址不允许浏览器跨域读取。应用会把结果留在预览区，可以直接“下载”；放画布后保存的图片可能需要在画布中重新导出一次。

## 构建与部署
```bash
npm run build
npm run preview
```

产物在 `dist/`。Vercel / Netlify 导入仓库后选择 Vite 即可。

## 项目结构
- `src/App.tsx`：画布、图生图界面、上传与结果处理
- `src/ai.ts`：方舟图片编辑接口、错误解析、设置存取
- `src/styles.css`：界面样式

## 安全提示
Vite 的 `VITE_*` 环境变量会进入前端包。自用没问题；公开部署时建议通过自己的后端代理 API，不要把长期密钥直接放在公开静态站点。

## 许可
MIT。tldraw 遵循其 Apache-2.0 / 商用许可条款，请以 tldraw 官方许可为准。
