import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PIPELINE = join(__dirname, "pipeline.py");
const REQUIREMENTS = join(__dirname, "requirements.txt");

function venvPython(): string {
  const win = process.platform === "win32";
  return join(ROOT, ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");
}

function systemPython(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function ensureVenv(): string {
  const python = venvPython();
  if (existsSync(python)) {
    return python;
  }

  const py = systemPython();
  console.log("Creating Python venv at .venv ...");
  const venv = spawnSync(py, ["-m", "venv", join(ROOT, ".venv")], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (venv.status !== 0) {
    throw new Error("Failed to create Python venv — install Python 3.10+ and retry");
  }

  console.log("Installing ingest dependencies ...");
  const pip = spawnSync(python, ["-m", "pip", "install", "-r", REQUIREMENTS], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (pip.status !== 0) {
    throw new Error("Failed to install Python dependencies");
  }

  return python;
}

function main() {
  const python = existsSync(venvPython()) ? venvPython() : ensureVenv();

  console.log("WeldPilot — running offline ingestion pipeline\n");

  const result = spawnSync(python, [PIPELINE], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env },
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error("\nIngestion failed.");
    process.exit(result.status ?? 1);
  }
}

main();
