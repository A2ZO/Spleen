/**
 * PWA and Apple icons from src/app/icon.svg (pnpm --filter @spleen/web icons). Drawn with
 * next/og (no sharp): the regular icons keep the SVG's rounded square; the maskable and
 * Apple ones fill the square with the ink background and keep the moon inside the safe
 * zone (80 %), since the system cuts the corners itself. Run again after editing icon.svg.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";

const root = path.resolve(import.meta.dirname, "..");
const svg = await readFile(path.join(root, "src/app/icon.svg"), "utf8");
const INK = /<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/.exec(svg)[1];
const asImage = (source) => `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
// Without its rounded square, for icons whose corners the system cuts.
const bare = svg.replace(/<rect[^>]*\/>/, "");

async function draw(file, size, { fullBleed = false, scale = 1 } = {}) {
  const inner = Math.round(size * scale);
  const element = h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: fullBleed ? INK : "transparent",
      },
    },
    h("img", { src: asImage(fullBleed ? bare : svg), width: inner, height: inner }),
  );
  const png = await new ImageResponse(element, { width: size, height: size }).arrayBuffer();
  await writeFile(path.join(root, file), Buffer.from(png));
  console.log(`${file} (${size}px, ${png.byteLength} bytes)`);
}

await draw("public/icons/icon-192.png", 192);
await draw("public/icons/icon-512.png", 512);
await draw("public/icons/maskable-512.png", 512, { fullBleed: true, scale: 0.8 });
await draw("src/app/apple-icon.png", 180, { fullBleed: true, scale: 0.86 });
