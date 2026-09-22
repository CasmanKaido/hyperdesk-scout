import { readFileSync } from "node:fs";

// Single source of truth for the deployed version: package.json.
export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
