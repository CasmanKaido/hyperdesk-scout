import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkDirectory(path);
    else if (path.endsWith(".js")) execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
  }
}
for (const directory of ["src", "public", "scripts", "test"]) checkDirectory(directory);
for (const path of ["openapi.json", ".impeccable/design.json"]) JSON.parse(readFileSync(path, "utf8"));
console.log("JavaScript syntax and JSON checks passed.");
