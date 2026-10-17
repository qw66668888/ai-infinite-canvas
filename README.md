# AI Infinite Canvas（你自己的开源 AI 无限画布）

基于 [tldraw](https://tldraw.dev)（Apache-2.0）+ React + Vite 的无限画布，接入任意 **OpenAI 兼容接口**（火山方舟/豆包、DeepSeek、OpenAI、本地代理等）。输入一句话，AI 自动把内容拆解成结构化便签铺到画布上；可继续选中多张便签让 AI 总结重组，再自由拖拽、连线、编辑。

## 功能
- 界面全中文（面板 + tldraw 画布工具栏），AI 默认输出简体中文便签
- 无限缩放/平移画布，便签、图形、箭头、手绘（tldraw 原生）
- AI 一句话生成 4–10 张结构化卡片，自动排版并聚焦
- **AI 自动连线**：模型返回从属/依赖关系，自动在卡片间画箭头
- **单卡 AI 改写**：选中一张便签，可扩写 / 精简 / 译英
- 选中多张便签 → 一键 AI 总结重组
- **一键导出 PNG**（整张画布，2x 清晰度）、全览、清空
- 模型设置（Base URL / Key / Model）保存在浏览器本地
- 画布自动保存到浏览器（localStorage，persistenceKey）
- 纯前端，可免费部署到 Vercel / Netlify / GitHub Pages

## 本地运行
```bash
cd ai-infinite-canvas
npm install
npm run dev
```
打开 http://localhost:5173 。左上角 ⚙ 填入你的接口地址、Key、模型名即可（或用 .env）。

## 配置模型（二选一）

方式 A：界面里点 ⚙ 填写（推荐，存在浏览器 localStorage）
- Base URL：填到 `/v3` 或 `/v1`，不要带 `/chat/completions`
  - 火山方舟豆包：`https://ark.cn-beijing.volces.com/api/v3`，模型如 `doubao-seed-evolving`
  - DeepSeek：`https://api.deepseek.com/v1`，模型 `deepseek-chat`
  - OpenAI：`https://api.openai.com/v1`
- API key：对应平台的 Key
- Model：模型/接入点 ID

方式 B：`.env`
```bash
cp .env.example .env
# 编辑 VITE_OPENAI_BASE_URL / VITE_OPENAI_API_KEY / VITE_OPENAI_MODEL
```
> 注意：Vite 的环境变量会打进前端包。自用没问题；若公开部署，建议把 Key 放到你自己的后端/代理，前端只调你的代理（见 src/ai.ts 中的 fetch 地址）。

## 构建与部署
```bash
npm run build      # 产物在 dist/
npm run preview
```
- Vercel / Netlify：导入仓库，框架选 Vite，直接部署。
- 任意静态服务器托管 `dist/` 即可。

## 项目结构
- `src/App.tsx`：画布与 AI 面板、便签排版
- `src/ai.ts`：模型调用（OpenAI 兼容，json_object）与设置存取
- `src/styles.css`：界面样式

## 开源到 GitHub
```bash
git init
git add .
git commit -m "feat: AI infinite canvas on tldraw"
gh repo create ai-infinite-canvas --public --source=. --push
```
需要的话可以直接让 Codex 用已连接的 GitHub 插件帮你建仓并推送。

## 许可
MIT（你的代码）。tldraw 遵循其 Apache-2.0 / 商用许可条款，个人与多数商用场景免费，请以 tldraw 官方许可为准。

## 后续可加（路线图）
- 节点间自动连线（AI 返回父子关系）
- 流式生成、编辑单卡（选中卡片 → AI 扩写/翻译）
- 接多模型、导出 PNG/PDF、多人协作（tldraw sync）