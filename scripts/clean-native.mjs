import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeDir = path.join(root, "native");

if (!nativeDir.startsWith(root + path.sep)) {
  throw new Error("native 目录不在项目内，停止清理。");
}

fs.rmSync(nativeDir, { recursive: true, force: true });
