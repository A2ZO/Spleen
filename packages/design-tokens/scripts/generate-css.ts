import { mkdirSync, writeFileSync } from "node:fs";

import { buildThemeCss } from "../src/css";

const outDir = new URL("../generated/", import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL("theme.css", outDir), buildThemeCss());
console.log("design-tokens: generated/theme.css written");
