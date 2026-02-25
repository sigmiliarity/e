// Raw SW
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

// MIME type map
const MIME = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  wasm: "application/wasm",
  txt: "text/plain",
  xml: "application/xml",
  pdf: "application/pdf",
  zip: "application/zip",
  ico: "image/x-icon",
};

const getMime = (path) => {
  const ext = path.split(".").pop()?.toLowerCase();
  return MIME[ext] || "application/octet-stream";
};

const createResponse = (res, path) =>
  new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: {
      "Content-Type": getMime(path),
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });

const fetchApi = async (owner, repo, path) => {
  const url = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/${path}`;
  try {
    const res = await fetch(url);
    return res.ok ? createResponse(res, path) : null;
  } catch {
    return null;
  }
};

const fetchGitHub = async (owner, repo, path) => {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
  try {
    const res = await fetch(url);
    return res.ok ? createResponse(res, path) : null;
  } catch {
    return null;
  }
};

self.addEventListener("fetch", (e) => {
  const { origin, pathname } = new URL(e.request.url);

  // Pass through non-origin or /d/ paths
  if (origin !== self.location.origin || pathname.startsWith("/d/")) {
    return;
  }

  const path = pathname.endsWith("/") ? pathname + "index.html" : pathname;

  // Route:  /github/{owner}/{repo}/{path}
  const gh = path.match(/^\/github\/([^/]+)\/([^/]+)\/(.+)$/);
  if (gh) {
    return e.respondWith(
      fetchGitHub(gh[1], gh[2], gh[3]).then(
        (res) => res || new Response("GitHub Fetch Failed", { status: 500 }),
      ),
    );
  }

  // Route:  /api/{owner}/{repo}/{path}
  const api = path.match(/^\/api\/([^/]+)\/([^/]+)\/(.+)$/);
  if (api) {
    return e.respondWith(
      fetchApi(api[1], api[2], api[3]).then(
        (res) => res || new Response("GitHub Fetch Failed", { status: 500 }),
      ),
    );
  }

  // Route:  /m/{repo}/{path} → sigmiliarity/{repo}
  const m = path.match(/^\/m\/([^/]+)\/(.+)$/);
  if (m) {
    return e.respondWith(
      fetchGitHub("sigmiliarity", m[1], m[2]).then(
        (res) => res || new Response("Repo Fetch Failed", { status: 500 }),
      ),
    );
  }
});
