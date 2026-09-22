import { readFileSync } from "node:fs";
import { VERSION } from "./version.js";

export function loadOpenApiSpec() {
  const spec = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
  spec.info.version = VERSION;
  return spec;
}
