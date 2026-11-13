// `pnpm run free-port [port]` (default 3000): stops the servers left listening on the port, but
// only node processes. Anything else is left alone and reported (exit code 1). Used by the
// autopilot (`/pilote`) before a production build, since only one Next server can run at once.
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const port = Number(process.argv[2] ?? 3000);
const isWindows = process.platform === "win32";

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

// Windows `netstat -ano`: "TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  1234". The state word is
// translated on non-English Windows, so a listening socket is recognised by its foreign
// address (0.0.0.0:0 or [::]:0) instead.
export function listeningPidsFromNetstat(output, wantedPort) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 5 || cols[0].toUpperCase() !== "TCP") continue;
    const [, local, foreign] = cols;
    const pid = Number(cols.at(-1));
    const listening = foreign === "0.0.0.0:0" || foreign === "[::]:0";
    if (listening && local.endsWith(`:${wantedPort}`) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

// Windows `tasklist /FO CSV /NH`: "\"node.exe\",\"1234\",\"Console\",\"1\",\"52 000 K\"".
export function imageNameFromTasklist(output) {
  const match = output.trim().match(/^"([^"]+)"/);
  return match ? match[1] : null;
}

function listeningPids() {
  if (isWindows) return listeningPidsFromNetstat(run("netstat", ["-ano"]), port);
  return run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])
    .split(/\s+/)
    .map(Number)
    .filter((pid) => pid > 0);
}

function processName(pid) {
  if (isWindows) {
    return imageNameFromTasklist(run("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]));
  }
  return run("ps", ["-p", String(pid), "-o", "comm="]).trim() || null;
}

function isNode(name) {
  const base = (name ?? "").toLowerCase().split(/[\\/]/).at(-1);
  return base === "node" || base === "node.exe";
}

function stop(pid) {
  if (isWindows) run("taskkill", ["/PID", String(pid), "/T", "/F"]);
  else run("kill", [String(pid)]);
}

const runDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (runDirectly) {
  const pids = listeningPids();
  if (pids.length === 0) {
    console.log(`port ${port} : libre`);
    process.exit(0);
  }
  let blocked = false;
  for (const pid of pids) {
    const name = processName(pid);
    if (isNode(name)) {
      stop(pid);
      console.log(`port ${port} : node arrêté (PID ${pid})`);
    } else {
      blocked = true;
      console.log(
        `port ${port} : PID ${pid} n'est pas node (${name ?? "inconnu"}), laissé tel quel`,
      );
    }
  }
  // The socket can stay listed for a moment after the process is gone: wait up to 3 s.
  let left = listeningPids();
  for (let i = 0; i < 10 && left.length > 0 && !blocked; i += 1) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    left = listeningPids();
  }
  console.log(left.length === 0 ? `port ${port} : libre` : `port ${port} : encore occupé`);
  process.exit(blocked || left.length > 0 ? 1 : 0);
}
