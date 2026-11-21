import { cpSync, existsSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// The hosted build only receives the backend folder, so the console that ships
// is the one already in backend/admin. When the frontend sits next to it, rebuild.
const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const frontend = path.resolve(backend, "../frontend");
const bundled = path.join(backend, "admin");

if (!existsSync(path.join(frontend, "package.json"))) {
  if (!existsSync(path.join(bundled, "index.html"))) {
    console.error("Admin console is missing. Build frontend/ first.");
    process.exit(1);
  }
  console.log("Using the admin console already in backend/admin");
  process.exit(0);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const build = spawnSync(npm, ["run", "build"], { cwd: frontend, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

rmSync(bundled, { recursive: true, force: true });
cpSync(path.join(frontend, "dist"), bundled, { recursive: true });
console.log("Admin console bundled into backend/admin");
