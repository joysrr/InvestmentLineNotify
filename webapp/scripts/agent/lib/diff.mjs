import fs from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

function padTo(png, targetW, targetH) {
  if (png.width === targetW && png.height === targetH) return png;
  const out = new PNG({ width: targetW, height: targetH });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

export function diffPngs(baseBuf, currBuf, diffPath) {
  const base = PNG.sync.read(baseBuf);
  const curr = PNG.sync.read(currBuf);
  const sizeMismatch = base.width !== curr.width || base.height !== curr.height;
  const width = Math.max(base.width, curr.width);
  const height = Math.max(base.height, curr.height);
  const diff = new PNG({ width, height });

  let diffPixels = 0;
  try {
    diffPixels = pixelmatch(
      padTo(base, width, height).data,
      padTo(curr, width, height).data,
      diff.data,
      width,
      height,
      { threshold: 0.1 },
    );
  } catch (e) {
    return { diffPercent: 100, diffPixels: 0, sizeMismatch: true, error: e.message };
  }

  if (diffPath) {
    try { fs.writeFileSync(diffPath, PNG.sync.write(diff)); } catch { /* best effort */ }
  }

  const totalPixels = width * height;
  return {
    diffPercent: (diffPixels / totalPixels) * 100,
    diffPixels,
    sizeMismatch,
    width,
    height,
  };
}
