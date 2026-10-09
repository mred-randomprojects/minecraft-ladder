// Checks index.html before it deploys: the inline scripts parse, every module
// imported from another server is pinned by an integrity hash in the import
// map, and the TREES data is well formed (unique tree ids, every Detour points
// at a tree that exists, every step has its required fields and no misspelled
// ones).
// No dependencies: `node scripts/check.mjs [path/to/index.html]`.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const file = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html");
const html = fs.readFileSync(file, "utf8");
const problems = [];

// --- Inline scripts parse --------------------------------------------------

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({
  type: /\btype\s*=\s*"([^"]*)"/i.exec(m[1])?.[1] ?? "",
  src: m[2],
  // Line in index.html where the script's body starts, for error messages.
  line: html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length,
}));

let classic = null;
let importMap = null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "minecraft-ladder-check-"));
try {
  for (const s of scripts) {
    const where = `<script${s.type ? ` type="${s.type}"` : ""}> at ${path.basename(file)}:${s.line}`;
    if (s.type === "" || s.type === "text/javascript") {
      classic ??= s;
      try {
        new vm.Script(s.src, { filename: path.basename(file), lineOffset: s.line - 1 });
      } catch (e) {
        // The stack's first lines are file:line:column, the source line and a caret.
        problems.push(`${where} does not parse: ${e.message}\n${e.stack.split("\n").slice(0, 3).join("\n")}`);
      }
    } else if (s.type === "module") {
      const out = path.join(tmp, `line-${s.line}.mjs`);
      fs.writeFileSync(out, "\n".repeat(s.line - 1) + s.src);
      const r = spawnSync(process.execPath, ["--check", out], { encoding: "utf8" });
      if (r.status !== 0) problems.push(`${where} does not parse:\n${r.stderr.trim()}`);
    } else if (s.type === "importmap") {
      try {
        importMap = { line: s.line, ...JSON.parse(s.src) };
      } catch (e) {
        problems.push(`${where} is not valid JSON: ${e.message}`);
      }
    } else {
      problems.push(`${where}: unexpected script type; teach scripts/check.mjs about it`);
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- Outside modules are pinned ------------------------------------------------

// A module from a CDN runs on the origin every mred-randomprojects app shares,
// so each one needs a hash in the import map, which must come before any
// module script (a later one is ignored).
const modules = scripts.filter((s) => s.type === "module");
for (const s of modules) {
  for (const [, url] of s.src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](https?:\/\/[^"']+)["']/g)) {
    const hash = importMap?.integrity?.[url];
    if (!hash) problems.push(`${url} is imported without an integrity hash in the <script type="importmap">`);
    else if (!/^sha(256|384|512)-[A-Za-z0-9+/]+={0,2}$/.test(hash)) problems.push(`Malformed integrity for ${url}: ${hash}`);
  }
}
if (importMap && modules.some((s) => s.line < importMap.line)) {
  problems.push(`The <script type="importmap"> (line ${importMap.line}) must come before every <script type="module">`);
}

// --- TREES -----------------------------------------------------------------

// TREES is plain data declared before the code that touches the page, which
// starts at STORAGE_KEY. Evaluate only that part, with no browser around it.
let TREES = null;
const cut = classic ? classic.src.indexOf("\nconst STORAGE_KEY") : -1;
if (cut === -1) {
  problems.push("Could not find `const STORAGE_KEY` after TREES in the main <script>: update scripts/check.mjs");
} else {
  try {
    TREES = vm.runInNewContext(`${classic.src.slice(0, cut)}\n;TREES`, {}, { filename: "index.html (TREES)" });
  } catch (e) {
    problems.push(`Evaluating TREES failed: ${e.message}`);
  }
}

const isText = (v) => typeof v === "string" && v.trim() !== "";
const TREE_TEXT = ["id", "name", "emoji", "color", "intro"];
const TREE_FIELDS = [...TREE_TEXT, "steps"];
const STEP_REQUIRED = ["icon", "title", "desc", "wiki"];
const STEP_OPTIONAL = ["tip", "sub", "detour"];

if (TREES !== null) {
  if (!Array.isArray(TREES) || TREES.length === 0) {
    problems.push("TREES is not a non-empty array");
  } else {
    const ids = TREES.map((t) => t?.id);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`Duplicate tree id "${id}"`);
      seen.add(id);
    }

    TREES.forEach((tree, ti) => {
      const at = `TREES[${ti}] (${tree?.id ?? "no id"})`;
      if (tree === null || typeof tree !== "object") {
        problems.push(`${at}: not an object`);
        return;
      }
      for (const k of TREE_TEXT) if (!isText(tree[k])) problems.push(`${at}: missing "${k}"`);
      for (const k of Object.keys(tree)) if (!TREE_FIELDS.includes(k)) problems.push(`${at}: unknown field "${k}"`);
      // Used as `${color}bb` in the progress bar, so it must be #rrggbb.
      if (isText(tree.color) && !/^#[0-9a-f]{6}$/i.test(tree.color)) {
        problems.push(`${at}: color "${tree.color}" is not #rrggbb`);
      }
      if (!Array.isArray(tree.steps) || tree.steps.length === 0) {
        problems.push(`${at}: "steps" is not a non-empty array`);
        return;
      }

      tree.steps.forEach((step, si) => {
        const sat = `${tree.id}, step ${si + 1} (${step?.title ?? "no title"})`;
        if (step === null || typeof step !== "object") {
          problems.push(`${sat}: not an object`);
          return;
        }
        for (const k of STEP_REQUIRED) if (!isText(step[k])) problems.push(`${sat}: missing "${k}"`);
        for (const k of Object.keys(step)) {
          if (!STEP_REQUIRED.includes(k) && !STEP_OPTIONAL.includes(k)) problems.push(`${sat}: unknown field "${k}"`);
        }
        if ("tip" in step && !isText(step.tip)) problems.push(`${sat}: "tip" is empty`);
        if ("sub" in step && (!Array.isArray(step.sub) || step.sub.length === 0 || !step.sub.every(isText))) {
          problems.push(`${sat}: "sub" must be a non-empty list of non-empty strings`);
        }
        if ("detour" in step) {
          const d = step.detour;
          if (!isText(d?.tree) || !isText(d?.text)) {
            problems.push(`${sat}: a detour needs "tree" and "text"`);
          } else if (!ids.includes(d.tree)) {
            problems.push(`${sat}: detour to tree "${d.tree}", which does not exist (trees: ${ids.join(", ")})`);
          }
          for (const k of Object.keys(d ?? {})) if (k !== "tree" && k !== "text") problems.push(`${sat}: unknown detour field "${k}"`);
        }
      });
    });
  }
}

// --- Report ----------------------------------------------------------------

if (problems.length > 0) {
  console.error(`scripts/check.mjs: ${problems.length} problem(s) in ${file}\n`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}

const steps = TREES.flatMap((t) => t.steps);
const subs = steps.reduce((n, s) => n + (s.sub?.length ?? 0), 0);
const detours = steps.filter((s) => s.detour).length;
console.log(
  `ok: ${scripts.length} inline scripts parse, outside modules pinned; ${TREES.length} trees, ${steps.length} steps, ` +
    `${subs} subtasks, ${detours} detours`,
);
