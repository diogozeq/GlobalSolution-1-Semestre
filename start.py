"""
OrbitGuard – start.py
=====================
Run once on any machine and the app goes up.

  python start.py                   # default port 8079
  python start.py --backend-port 9000

Bootstrap sequence (runs only what is missing):
  1. Python ≥ 3.11 check
  2. Node.js / npm  — auto-installs via winget (Windows) or gives exact command
  3. Python venv    — created if absent
  4. pip install    — re-runs when requirements.txt changes
  5. npm install    — runs when node_modules is absent
  6. .env           — writes VITE_API_URL for the frontend

Then it starts backend + frontend, streams their logs with coloured prefixes,
and auto-restarts either process if it crashes (exponential back-off, up to 10x).
Ctrl-C kills both children cleanly.
"""

# ─── stdlib only — no third-party imports at the top level ───────────────────
import argparse
import os
import platform
import shutil
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path

# ── Platform ──────────────────────────────────────────────────────────────────
IS_WIN  = platform.system() == "Windows"
IS_MAC  = platform.system() == "Darwin"
IS_LIN  = platform.system() == "Linux"

# Enable ANSI colours on Windows 10+
if IS_WIN:
    try:
        import ctypes
        ctypes.windll.kernel32.SetConsoleMode(
            ctypes.windll.kernel32.GetStdHandle(-11), 7
        )
    except Exception:
        pass

RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BLUE   = "\033[94m"
WHITE  = "\033[97m"


def _log(prefix: str, colour: str, msg: str) -> None:
    ts = time.strftime("%H:%M:%S")
    for line in str(msg).rstrip("\n").splitlines() or [""]:
        print(f"{BLUE}{ts}{RESET} {colour}{BOLD}[{prefix}]{RESET} {line}", flush=True)

def info(msg: str)  -> None: _log("run",   GREEN,  msg)
def warn(msg: str)  -> None: _log("run",   YELLOW, msg)
def err(msg: str)   -> None: _log("run",   RED,    msg)
def step(msg: str)  -> None: _log("setup", CYAN,   msg)
def fatal(msg: str) -> None:
    _log("FATAL", RED, msg)
    sys.exit(1)


# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT     = Path(__file__).parent.resolve()
BACKEND  = ROOT / "src" / "backend"
FRONTEND = ROOT / "src" / "frontend"
VENV     = BACKEND / ".venv"
VENV_PY  = VENV / ("Scripts/python.exe" if IS_WIN else "bin/python")
VENV_PIP  = VENV / ("Scripts/pip.exe"    if IS_WIN else "bin/pip")
REQ_FILE  = BACKEND / "requirements.txt"
NM        = FRONTEND / "node_modules"
FENV      = FRONTEND / ".env"
# Stamps live outside watched dirs to avoid triggering uvicorn --reload
STAMPS    = ROOT / ".run_stamps"


# ─────────────────────────────────────────────────────────────────────────────
# 1. Python version
# ─────────────────────────────────────────────────────────────────────────────
def check_python() -> None:
    major, minor = sys.version_info[:2]
    if (major, minor) < (3, 11):
        fatal(
            f"Python 3.11+ required, but you have {major}.{minor}.\n"
            "  Download: https://www.python.org/downloads/"
        )
    info(f"Python {major}.{minor} ✓")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Node.js / npm
# ─────────────────────────────────────────────────────────────────────────────
def _run_quiet(cmd: list[str], **kw) -> int:
    """Run a command, return exit code. Suppress output."""
    r = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)
    return r.returncode


def _try_install_node_windows() -> bool:
    """Attempt to install Node.js LTS via winget (Windows 10+)."""
    if shutil.which("winget") is None:
        return False
    step("winget found – installing Node.js LTS (this may take a minute) …")
    rc = _run_quiet(["winget", "install", "--id", "OpenJS.NodeJS.LTS",
                     "--silent", "--accept-package-agreements",
                     "--accept-source-agreements"])
    if rc != 0:
        return False
    # Refresh PATH from registry so npm is visible in this process
    try:
        import winreg
        for root, sub in [
            (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
            (winreg.HKEY_CURRENT_USER,  r"Environment"),
        ]:
            with winreg.OpenKey(root, sub) as k:
                try:
                    val, _ = winreg.QueryValueEx(k, "Path")
                    os.environ["PATH"] = os.environ["PATH"] + ";" + val
                except FileNotFoundError:
                    pass
    except Exception:
        pass
    return shutil.which("npm") is not None


def ensure_node() -> str:
    npm = shutil.which("npm")
    if npm:
        ver = subprocess.check_output(["node", "--version"], text=True).strip()
        info(f"Node.js {ver} / npm ✓")
        return npm

    warn("npm not found — attempting automatic install …")

    installed = False
    if IS_WIN:
        installed = _try_install_node_windows()

    if not installed:
        hint = {
            True:  "  winget install OpenJS.NodeJS.LTS\n  (or https://nodejs.org/en/download)",
            False: ("  macOS:  brew install node\n"
                    "  Linux:  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\n"
                    "          sudo apt-get install -y nodejs"),
        }[IS_WIN]
        fatal(
            "Could not install Node.js automatically.\n"
            "Please install it manually and re-run start.py:\n" + hint
        )

    npm = shutil.which("npm")
    if not npm:
        fatal(
            "Node.js was installed but 'npm' is still not in PATH.\n"
            "Close this terminal, open a new one, and run start.py again."
        )
    return npm


# ─────────────────────────────────────────────────────────────────────────────
# 3 + 4. Python venv + pip deps
# ─────────────────────────────────────────────────────────────────────────────
def setup_backend() -> None:
    if not VENV_PY.exists():
        step(f"Creating Python venv → {VENV}")
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)

    # Upgrade pip silently (avoids nagging warnings)
    _run_quiet([str(VENV_PY), "-m", "pip", "install", "--upgrade", "pip"])

    STAMPS.mkdir(exist_ok=True)
    req_mtime  = REQ_FILE.stat().st_mtime if REQ_FILE.exists() else 0
    stamp_path = STAMPS / "backend_req"          # outside watched dirs
    prev_mtime = float(stamp_path.read_text()) if stamp_path.exists() else 0

    if req_mtime > prev_mtime:
        step("Installing / updating backend Python deps …")
        subprocess.run(
            [str(VENV_PIP), "install", "-r", str(REQ_FILE), "-q"],
            check=True,
        )
        stamp_path.write_text(str(req_mtime))
    else:
        info("Backend Python deps up-to-date ✓")


# ─────────────────────────────────────────────────────────────────────────────
# 5. npm deps
# ─────────────────────────────────────────────────────────────────────────────
def setup_frontend(npm: str, backend_port: int) -> None:
    pkg_json  = FRONTEND / "package.json"
    lock_file = FRONTEND / "package-lock.json"

    pkg_mtime  = pkg_json.stat().st_mtime  if pkg_json.exists()  else 0
    lock_mtime = lock_file.stat().st_mtime if lock_file.exists() else 0
    STAMPS.mkdir(exist_ok=True)
    stamp_path = STAMPS / "frontend_npm"         # outside watched dirs
    prev_mtime = float(stamp_path.read_text()) if stamp_path.exists() else 0
    newest     = max(pkg_mtime, lock_mtime)

    if not NM.exists() or newest > prev_mtime:
        step("Installing frontend Node deps (npm install) …")
        subprocess.run([npm, "install"], cwd=str(FRONTEND), check=True)
        stamp_path.write_text(str(newest))
    else:
        info("Frontend node_modules up-to-date ✓")

    # Write .env so Vite knows which port the backend is on
    if backend_port != 8000:
        FENV.write_text(
            f"VITE_API_URL=http://localhost:{backend_port}\n",
            encoding="utf-8",
        )
    elif FENV.exists():
        FENV.unlink()


# ─────────────────────────────────────────────────────────────────────────────
# Port cleanup — kill stale processes squatting on our ports
# ─────────────────────────────────────────────────────────────────────────────
def _pids_on_port_windows(port: int) -> list[int]:
    try:
        out = subprocess.check_output(
            ["netstat", "-ano"], text=True, stderr=subprocess.DEVNULL
        )
        pids: list[int] = []
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 5 and f":{port}" in parts[1] and parts[3] == "LISTENING":
                try:
                    pids.append(int(parts[4]))
                except ValueError:
                    pass
        return list(set(pids))
    except Exception:
        return []


def free_ports(*ports: int) -> None:
    if not IS_WIN:
        return
    for port in ports:
        for pid in _pids_on_port_windows(port):
            try:
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/F"],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                warn(f"Killed stale process PID {pid} on port {port}")
            except Exception:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# Process supervisor
# ─────────────────────────────────────────────────────────────────────────────
class ManagedProcess:
    """Spawns a child process, pipes its output, and restarts on crash."""

    MAX_RESTARTS = 10
    BASE_DELAY   = 1.5   # doubles each restart, capped at 30 s

    def __init__(self, name: str, colour: str, cmd: list[str], cwd: str):
        self.name   = name
        self.colour = colour
        self.cmd    = cmd
        self.cwd    = cwd
        self.proc: "subprocess.Popen | None" = None
        self._stop  = threading.Event()
        self._thread = threading.Thread(target=self._supervise, daemon=True, name=name)

    # public ──────────────────────────────────────────────────────────────────
    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        proc = self.proc
        if proc and proc.poll() is None:
            try:
                if IS_WIN:
                    proc.send_signal(signal.CTRL_BREAK_EVENT)
                else:
                    proc.terminate()
                proc.wait(timeout=6)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    # private ─────────────────────────────────────────────────────────────────
    def _emit(self, msg: str) -> None:
        _log(self.name, self.colour, msg)

    def _spawn(self) -> "subprocess.Popen":
        kw: dict = dict(
            args=self.cmd,
            cwd=self.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        if IS_WIN:
            kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        return subprocess.Popen(**kw)

    def _stream(self, proc: "subprocess.Popen") -> None:
        assert proc.stdout
        for line in proc.stdout:
            if self._stop.is_set():
                break
            self._emit(line.rstrip("\n"))

    def _supervise(self) -> None:
        restarts = 0
        delay    = self.BASE_DELAY
        while not self._stop.is_set():
            try:
                self.proc = self._spawn()
                self._stream(self.proc)
                self.proc.wait()
            except Exception as exc:
                err(f"{self.name} spawn error: {exc}")

            if self._stop.is_set():
                break

            rc = self.proc.returncode if self.proc else -1
            restarts += 1
            if restarts > self.MAX_RESTARTS:
                err(f"{self.name} crashed {restarts}× — giving up. Fix the error above.")
                return
            wait = f"{delay:.0f}s"
            warn(f"{self.name} exited (code {rc}) — restart {restarts}/{self.MAX_RESTARTS} in {wait} …")
            time.sleep(delay)
            delay = min(delay * 2, 30)


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="OrbitGuard – start everything")
    parser.add_argument("--backend-port", type=int, default=8079,
                        help="Port for the FastAPI backend (default: 8079)")
    args = parser.parse_args()
    port: int = args.backend_port

    banner = f"""
{BOLD}{BLUE}╔══════════════════════════════════════╗
║      OrbitGuard  –  start.py         ║
╚══════════════════════════════════════╝{RESET}
"""
    print(banner)

    # ── Bootstrap ─────────────────────────────────────────────────────────────
    check_python()
    npm = ensure_node()
    setup_backend()
    setup_frontend(npm, port)

    # ── Free ports before launch ───────────────────────────────────────────────
    free_ports(port, 5173)

    # ── Launch ────────────────────────────────────────────────────────────────
    print()
    info(f"Backend  → {GREEN}http://localhost:{port}/docs{RESET}")
    info(f"Frontend → {CYAN}http://localhost:5173{RESET}")
    info("Press Ctrl+C to stop both services.")
    print()

    backend = ManagedProcess(
        name="backend",
        colour=GREEN,
        cmd=[
            str(VENV_PY), "-m", "uvicorn",
            "app.main:app",
            "--reload",
            f"--port={port}",
            "--host=0.0.0.0",
            "--reload-exclude", ".venv",
            "--reload-exclude", "tests",
            "--reload-exclude", "*.db",
        ],
        cwd=str(BACKEND),
    )

    frontend = ManagedProcess(
        name="frontend",
        colour=CYAN,
        cmd=[npm, "run", "dev"],
        cwd=str(FRONTEND),
    )

    backend.start()
    time.sleep(1.2)   # let uvicorn bind before Vite's proxy probes it
    frontend.start()

    # ── Shutdown handler ──────────────────────────────────────────────────────
    def _shutdown(sig, frame):
        print()
        warn("Shutting down …")
        frontend.stop()
        backend.stop()
        info("All processes stopped. Bye!")
        sys.exit(0)

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        _shutdown(None, None)


if __name__ == "__main__":
    main()
