import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(projectRoot, "native");
const port = Number(process.argv[2] || process.env.PORT || 5180);
const indexFile = path.join(root, "index.html");
const ocrScript = path.join(projectRoot, "ocr-test.ps1");
const ARK_HOST = "ark.cn-beijing.volces.com";
const execFileAsync = promisify(execFile);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

if (!fs.existsSync(indexFile)) {
  console.error("native/index.html 不存在，请先运行 npm run build:native。");
  process.exit(1);
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function proxyArk(request, response) {
  const rawUrl = request.url || "/ark-proxy";
  const targetPath = `/api/v3${rawUrl.slice("/ark-proxy".length)}`;
  const headers = { ...request.headers, host: ARK_HOST };
  delete headers.origin;
  delete headers.referer;
  for (const name of HOP_BY_HOP_HEADERS) delete headers[name];

  const upstream = https.request(
    {
      hostname: ARK_HOST,
      port: 443,
      path: targetPath,
      method: request.method,
      headers,
      timeout: 180000,
    },
    (upstreamResponse) => {
      const responseHeaders = {};
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) {
          responseHeaders[name] = value;
        }
      }
      responseHeaders["cache-control"] = "no-store";
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
    }
  );

  upstream.on("timeout", () => upstream.destroy(new Error("连接方舟超时")));
  upstream.on("error", (error) => {
    if (response.headersSent) {
      response.end();
      return;
    }
    response.writeHead(502, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify({
        error: {
          message: `本地代理无法连接火山方舟：${error.message}`,
        },
      })
    );
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

function readJsonBody(request, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("图片太大，请上传 20MB 以内的图片"));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("请求内容不是有效 JSON"));
      }
    });
    request.on("error", reject);
  });
}

async function handleOcr(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "只支持 POST" }));
    return;
  }

  let tempFile = null;
  try {
    const body = await readJsonBody(request);
    const match = String(body.image || "").match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("没有收到有效图片");
    const extension = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
    tempFile = path.join(os.tmpdir(), `codex-ocr-${crypto.randomUUID()}.${extension}`);
    await fs.promises.writeFile(tempFile, Buffer.from(match[2], "base64"));
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ocrScript, "-Path", tempFile],
      { timeout: 60000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, encoding: "utf8" }
    );
    const text = String(stdout || "").trim();
    const jsonStart = text.indexOf("{");
    if (jsonStart < 0) throw new Error("OCR 没有返回结果");
    const result = JSON.parse(text.slice(jsonStart));
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(500, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ error: error.message || "OCR 识别失败" }));
  } finally {
    if (tempFile) fs.promises.unlink(tempFile).catch(() => {});
  }
}

const server = http.createServer((request, response) => {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (pathname === "/ark-proxy" || pathname.startsWith("/ark-proxy/")) {
    proxyArk(request, response);
    return;
  }

  if (pathname === "/ocr") {
    handleOcr(request, response);
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mime[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store, max-age=0",
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${port} 已被占用，请关闭之前的窗口或换一个端口。`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI Workflow Canvas: http://localhost:${port}`);
  console.log("保持这个窗口开启；按 Ctrl+C 可以停止。");
});
