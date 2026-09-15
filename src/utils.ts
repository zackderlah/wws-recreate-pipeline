import fs from "node:fs";
import path from "node:path";

export function slugifyUrl(url: string) {
  const u = new URL(url);
  const p = u.pathname === "/" ? "home" : u.pathname.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-");
  return p || "home";
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(file: string, value: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export function sameOrigin(a: string, b: string) {
  return new URL(a).origin === new URL(b).origin;
}

export function cleanUrl(raw: string, base: string) {
  try {
    const u = new URL(raw, base);
    u.hash = "";
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid"].forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}
