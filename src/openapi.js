import { readFileSync } from "node:fs";

export function loadOpenApiSpec() {
  return JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));
}
