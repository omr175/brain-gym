import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("public page contains product, privacy, accessibility, and release contracts", async () => {
  const [html, css, app] = await Promise.all([
    readFile(resolve(root, "index.html"), "utf8"),
    readFile(resolve(root, "styles.css"), "utf8"),
    readFile(resolve(root, "app.js"), "utf8"),
  ]);

  assert.match(html, /思考体力室/);
  assert.match(html, /shiko-tairyoku-v1/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /NO LOGIN/);
  assert.match(html, /aria-live="polite"/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(app, /localStorage/);
  assert.doesNotMatch(app, /fetch\s*\(/);
  assert.doesNotMatch(app, /XMLHttpRequest/);
});
