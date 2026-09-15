import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { ensureDir, writeJson } from "./utils.js";

function cropPng(img: PNG, width: number, height: number) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (img.width * y + x) << 2;
      const dst = (width * y + x) << 2;
      out.data[dst] = img.data[src];
      out.data[dst + 1] = img.data[src + 1];
      out.data[dst + 2] = img.data[src + 2];
      out.data[dst + 3] = img.data[src + 3];
    }
  }
  return out;
}

const sourceRoot = path.resolve("recreation/source/pages");
const generatedRoot = path.resolve("recreation/generated/pages");
const diffRoot = path.resolve("recreation/diff");
ensureDir(diffRoot);

const refs = await fg(["**/{desktop,tablet,mobile}.png"], { cwd: sourceRoot });
const report: any[] = [];

for (const rel of refs) {
  const aPath = path.join(sourceRoot, rel);
  const bPath = path.join(generatedRoot, rel);
  if (!fs.existsSync(bPath)) {
    report.push({ file: rel, status: "missing-generated" });
    continue;
  }

  const a = PNG.sync.read(fs.readFileSync(aPath));
  const b = PNG.sync.read(fs.readFileSync(bPath));

  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const aCrop = cropPng(a, width, height);
  const bCrop = cropPng(b, width, height);

  const diff = new PNG({ width, height });
  const pixels = pixelmatch(aCrop.data, bCrop.data, diff.data, width, height, {
    threshold: 0.12
  });
  const ratio = pixels / (width * height);

  const out = path.join(diffRoot, rel);
  ensureDir(path.dirname(out));
  fs.writeFileSync(out, PNG.sync.write(diff));
  report.push({ file: rel, status: "compared", diffRatio: ratio });
}

writeJson(path.resolve("recreation/diff-report.json"), report);
console.log("Wrote recreation/diff-report.json");
