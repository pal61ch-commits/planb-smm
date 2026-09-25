import http from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = path.resolve(HERE, "../../..");

const MIME = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mp4", "video/mp4"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".vtt", "text/vtt; charset=utf-8"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"]
]);

function safePath(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relative = decoded.replace(/^\/+/, "");
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return absolute;
}

async function regularFile(candidate) {
  try {
    const stat = await fs.stat(candidate);
    return stat.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

export async function resolveRequestPath(root, pathname) {
  const absolute = safePath(root, pathname);
  if (!absolute) return null;
  if (pathname === "/") return regularFile(path.join(root, "index.html"));

  const candidates = [];
  if (pathname.endsWith("/")) {
    candidates.push(path.join(absolute, "index.html"));
  } else {
    candidates.push(absolute);
    if (!path.extname(pathname)) candidates.push(absolute + ".html");
  }

  for (const candidate of candidates) {
    const found = await regularFile(candidate);
    if (found) return found;
  }
  return null;
}

export async function startServer({ root = DEFAULT_ROOT, host = "127.0.0.1", port = 0 } = {}) {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://localhost");
      const file = await resolveRequestPath(resolvedRoot, url.pathname);
      if (!file) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        response.end("Not found\n");
        return;
      }
      const extension = path.extname(file).toLowerCase();
      const contentType = MIME.get(extension) || "application/octet-stream";
      const media = extension === ".mp4" || extension === ".webm";
      const range = media ? request.headers.range : null;
      if (range) {
        const stat = await fs.stat(file);
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        const suffixLength = match && !match[1] && match[2] ? Number(match[2]) : null;
        const start = suffixLength == null
          ? (match && match[1] ? Number(match[1]) : 0)
          : Math.max(0, stat.size - suffixLength);
        const end = suffixLength == null
          ? (match && match[2] ? Number(match[2]) : stat.size - 1)
          : stat.size - 1;
        if (!match || start < 0 || end < start || end >= stat.size) {
          response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
          response.end();
          return;
        }
        response.writeHead(206, {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Cache-Control": "no-store"
        });
        if (request.method === "HEAD") response.end();
        else createReadStream(file, { start, end }).pipe(response);
        return;
      }
      const body = await fs.readFile(file);
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": String(body.length),
        ...(media ? { "Accept-Ranges": "bytes" } : {}),
        "Cache-Control": "no-store"
      });
      if (request.method === "HEAD") response.end();
      else response.end(body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      response.end("Server error\n");
      console.error(error);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const baseURL = `http://${host}:${address.port}`;
  return {
    server,
    baseURL,
    root: resolvedRoot,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  const root = process.env.PLANB_SITE_ROOT || DEFAULT_ROOT;
  const port = Number(process.env.PLANB_SITE_PORT || 4519);
  const running = await startServer({ root, port });
  console.log(`Plan B QA server: ${running.baseURL}`);
  console.log(`Root: ${running.root}`);
}
