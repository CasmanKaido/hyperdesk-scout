import { readFileSync } from "node:fs";

const SECURITY_HEADERS = {
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

const FILES = [
  ["/", "../public/index.html", "text/html; charset=utf-8", "no-cache"],
  ["/styles.css", "../public/styles.css", "text/css; charset=utf-8", "public, max-age=300"],
  ["/app.js", "../public/app.js", "text/javascript; charset=utf-8", "public, max-age=300"],
  ["/assets/liquidflux-avatar.png", "../assets/liquidflux-avatar.png", "image/png", "public, max-age=86400"],
];

export function loadStaticAssets() {
  return new Map(FILES.map(([pathname, path, contentType, cacheControl]) => [pathname, {
    body: readFileSync(new URL(path, import.meta.url)),
    headers: {
      ...SECURITY_HEADERS,
      "cache-control": cacheControl,
      "content-type": contentType,
    },
  }]));
}

export function getStaticAsset(assets, method, pathname) {
  if (method !== "GET" && method !== "HEAD") return null;
  return assets.get(pathname) || null;
}
