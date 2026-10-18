import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeDir = path.join(root, "native");
const appDir = path.join(nativeDir, "app");
const vendorDir = path.join(nativeDir, "vendor");

if (!nativeDir.startsWith(root + path.sep)) {
  throw new Error("native 目录不在项目内，停止生成。");
}

fs.mkdirSync(appDir, { recursive: true });
fs.mkdirSync(vendorDir, { recursive: true });

if (!fs.existsSync(appDir) || fs.readdirSync(appDir).length === 0) {
  throw new Error("native/app 为空，请先运行 tsc -p tsconfig.native.json。");
}

function rewriteImports(file) {
  let code = fs.readFileSync(file, "utf8");
  code = code.replace(/import\s+["']\.\/styles\.css["'];?\r?\n?/g, "");
  code = code.replace(/(\bfrom\s+["'])(\.[^"']+)(["'])/g, (match, start, spec, end) => {
    if (/\.(js|mjs|css)$/.test(spec)) return match;
    return `${start}${spec}.js${end}`;
  });
  code = code.replace(
    /from\s+["']react\/jsx-runtime["']/g,
    'from "../vendor/jsx-runtime.mjs"'
  );
  code = code.replace(
    /from\s+["']react-dom\/client["']/g,
    'from "../vendor/react-dom-client.mjs"'
  );
  code = code.replace(/from\s+["']react["']/g, 'from "../vendor/react.mjs"');
  code = code.replace(/import\.meta\.env/g, "(window.__ENV__ || {})");
  fs.writeFileSync(file, code, "utf8");
}

for (const entry of fs.readdirSync(appDir)) {
  if (entry.endsWith(".js")) rewriteImports(path.join(appDir, entry));
}

fs.copyFileSync(path.join(root, "src", "styles.css"), path.join(nativeDir, "styles.css"));

const demoSource = path.join(root, "public", "demo");
if (fs.existsSync(demoSource)) {
  fs.cpSync(demoSource, path.join(nativeDir, "demo"), { recursive: true });
}

const referenceSource = path.join(root, "public", "reference");
if (fs.existsSync(referenceSource)) {
  fs.cpSync(referenceSource, path.join(nativeDir, "reference"), { recursive: true });
}

const mainImageTool = path.join(root, "public", "main-image.html");
if (fs.existsSync(mainImageTool)) {
  fs.copyFileSync(mainImageTool, path.join(nativeDir, "main-image.html"));
}

const reactUmd = path.join(root, "node_modules", "react", "umd", "react.production.min.js");
const reactDomUmd = path.join(
  root,
  "node_modules",
  "react-dom",
  "umd",
  "react-dom.production.min.js"
);
if (!fs.existsSync(reactUmd) || !fs.existsSync(reactDomUmd)) {
  throw new Error("找不到 React UMD 文件，请先执行 npm install。");
}
fs.copyFileSync(reactUmd, path.join(vendorDir, "react.production.min.js"));
fs.copyFileSync(reactDomUmd, path.join(vendorDir, "react-dom.production.min.js"));

fs.writeFileSync(
  path.join(vendorDir, "react.mjs"),
  `const React = window.React;
if (!React) throw new Error("React UMD 没有加载");
export default React;
export const {
  Children, Component, Fragment, Profiler, PureComponent, StrictMode, Suspense,
  cloneElement, createContext, createElement, createFactory, createRef,
  forwardRef, isValidElement, lazy, memo, startTransition, useCallback,
  useContext, useDebugValue, useDeferredValue, useEffect, useId,
  useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo,
  useReducer, useRef, useState, useSyncExternalStore, useTransition, version
} = React;
`,
  "utf8"
);

fs.writeFileSync(
  path.join(vendorDir, "jsx-runtime.mjs"),
  `const React = window.React;
if (!React) throw new Error("React UMD 没有加载");
export const Fragment = React.Fragment;
export function jsx(type, props, key) {
  return React.createElement(type, key === undefined ? props : { ...props, key });
}
export const jsxs = jsx;
export const jsxDEV = jsx;
`,
  "utf8"
);

fs.writeFileSync(
  path.join(vendorDir, "react-dom-client.mjs"),
  `const ReactDOM = window.ReactDOM;
if (!ReactDOM) throw new Error("ReactDOM UMD 没有加载");
export function createRoot(container, options) {
  return ReactDOM.createRoot(container, options);
}
export function hydrateRoot(container, element, options) {
  return ReactDOM.hydrateRoot(container, element, options);
}
export default { createRoot, hydrateRoot };
`,
  "utf8"
);

function readEnv() {
  const env = {};
  for (const name of [".env", ".env.local"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || !match[1].startsWith("VITE_")) continue;
      env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
  return env;
}

fs.writeFileSync(
  path.join(nativeDir, "env.js"),
  `window.__ENV__ = ${JSON.stringify(readEnv(), null, 2)};\n`,
  "utf8"
);

fs.writeFileSync(
  path.join(nativeDir, "index.html"),
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Workflow · 图像与视频工作流</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <noscript>请启用 JavaScript 后使用画布。</noscript>
    <script src="./env.js"></script>
    <script src="./vendor/react.production.min.js"></script>
    <script src="./vendor/react-dom.production.min.js"></script>
    <script type="module" src="./app/main.js"></script>
  </body>
</html>
`,
  "utf8"
);

console.log(`静态版本已生成：${nativeDir}`);
