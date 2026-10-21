// Claude Code hook. `record` (PostToolUse): remember files Claude edited.
// `check` (Stop): lint those files; on errors exit 2 so Claude must fix them before stopping.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const listFile = path.join(root, ".claude", "hooks", ".edited-files");
const input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");

if (process.argv[2] === "record") {
  const f = input.tool_input?.file_path;
  if (f) fs.appendFileSync(listFile, f + "\n");
  process.exit(0);
}

const files = fs.existsSync(listFile)
  ? [...new Set(fs.readFileSync(listFile, "utf8").split("\n").filter(Boolean))].filter(fs.existsSync)
  : [];

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8" });
  if (r.error) return null; // tool not installed
  return r.status === 0 ? "" : (r.stdout + r.stderr).trim();
};
const has = (cmd) => spawnSync(cmd, ["--version"]).status === 0;
const eslint = path.join(root, "node_modules", "eslint", "bin", "eslint.js");

const errors = [];
for (const f of files) {
  const ext = path.extname(f).toLowerCase();
  let out = "";
  if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
    if (fs.existsSync(eslint)) out = run("node", [eslint, f]);
    else if ([".js", ".mjs", ".cjs"].includes(ext)) out = run("node", ["--check", f]);
  } else if (ext === ".py") {
    out = has("ruff") ? run("ruff", ["check", f]) : run("python", ["-m", "py_compile", f]);
  } else if (ext === ".json") {
    try { JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { out = e.message; }
  }
  if (out) errors.push(`--- ${f}\n${out}`);
}

if (!errors.length) {
  fs.rmSync(listFile, { force: true });
  process.exit(0);
}
// Already blocked once this turn: let Claude stop to avoid a loop; files stay listed for next time.
if (input.stop_hook_active) {
  console.log(JSON.stringify({ systemMessage: `Lint still failing in ${errors.length} file(s).` }));
  process.exit(0);
}
console.error("Lint errors in files you edited. Fix them before finishing:\n\n" + errors.join("\n\n"));
process.exit(2);
