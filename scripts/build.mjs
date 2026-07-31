import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "src"), { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(resolve(root, file), resolve(dist, file));
}

await cp(resolve(root, "src", "logic.mjs"), resolve(dist, "src", "logic.mjs"));
await writeFile(resolve(dist, ".nojekyll"), "");

console.log("Built static site in dist/");
