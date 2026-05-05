#!/usr/bin/env python3
"""mempalace-export.py — MemPalace MCP cold backup export (PROPOSAL_502_027 port).

Python 3.9+ stdlib-only port of mempalace-export.mjs (PROPOSAL_502_020 T-1, Plan G).

透過 MCP stdio JSON-RPC 協定 dump 所有 drawer 至 markdown 作為 cold backup。

設計理由：
  mempalace 3.3.4 CLI 無 native export；唯一 export 路徑是透過 MCP tools
  (mempalace_list_drawers + mempalace_get_drawer) 組合。
  本 script 對齊 ADR-0039 v2 (Plan G)：mempalace 為 primary SoT；markdown 為 export artifact。

輸出：
  .agents/memory/.export/<wing>/<room>/<drawer-id>.md
  每個 drawer 一檔；frontmatter 含 metadata；body 含 verbatim content。

使用：
  python3 .agents/scripts/mempalace-export.py                # export all wings/rooms
  python3 .agents/scripts/mempalace-export.py --wing framework  # 限定 wing
  python3 .agents/scripts/mempalace-export.py --dry-run      # 不寫檔；只列出
  python3 .agents/scripts/mempalace-export.py --verbose      # 詳細 RPC trace
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from queue import Empty, Queue

SCRIPT_DIR = Path(__file__).resolve().parent
AGENTS_ROOT = SCRIPT_DIR.parent
EXPORT_ROOT = AGENTS_ROOT / "memory" / ".export"


def now_iso() -> str:
    n = datetime.now(timezone.utc)
    return n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond // 1000:03d}Z"


# ──────── CLI 參數 ────────
def parse_args(argv):
    verbose = "--verbose" in argv
    dry_run = "--dry-run" in argv
    wing_filter = None
    if "--wing" in argv:
        idx = argv.index("--wing")
        if idx + 1 < len(argv) and not argv[idx + 1].startswith("--"):
            wing_filter = argv[idx + 1]
    return verbose, dry_run, wing_filter


# ──────── MCP stdio JSON-RPC client ────────
class MCPClient:
    """Subprocess-based MCP JSON-RPC stdio client (mirrors mjs MCPClient)."""

    def __init__(self, command: str, args=None, verbose=False):
        self.verbose = verbose
        self.proc = subprocess.Popen(
            [command] + (args or []),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
        )
        self.next_id = 1
        self._lock = threading.Lock()
        self._pending = {}  # id → (event, container)
        self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._reader_thread.start()
        self._stderr_thread = threading.Thread(target=self._stderr_loop, daemon=True)
        self._stderr_thread.start()
        self._closed = False

    def _vlog(self, msg: str):
        if self.verbose:
            print(f"[trace] {msg}", file=sys.stderr)

    def _stderr_loop(self):
        # mempalace-mcp emits logs/init banner on stderr; preserve them
        try:
            for line in iter(self.proc.stderr.readline, b""):
                if not line:
                    break
                # Pass through to parent stderr (matches stdio: 'inherit' in mjs)
                sys.stderr.write(line.decode("utf-8", errors="replace"))
                sys.stderr.flush()
        except Exception:
            pass

    def _reader_loop(self):
        buf = ""
        try:
            for chunk_bytes in iter(lambda: self.proc.stdout.read(4096), b""):
                if not chunk_bytes:
                    break
                buf += chunk_bytes.decode("utf-8", errors="replace")
                while "\n" in buf:
                    line, buf = buf.split("\n", 1)
                    line = line.strip()
                    if not line or not line.startswith("{"):
                        continue
                    try:
                        msg = json.loads(line)
                    except Exception:
                        self._vlog(f"(skip non-JSON line) {line[:80]}")
                        continue
                    self._vlog(f"<< {json.dumps(msg)[:200]}")
                    msg_id = msg.get("id")
                    if msg_id is not None:
                        with self._lock:
                            entry = self._pending.pop(msg_id, None)
                        if entry is not None:
                            event, container = entry
                            container["msg"] = msg
                            event.set()
        except Exception as e:
            self._vlog(f"reader exception: {e}")

    def request(self, method: str, params=None, timeout=30):
        with self._lock:
            req_id = self.next_id
            self.next_id += 1
            event = threading.Event()
            container = {"msg": None}
            self._pending[req_id] = (event, container)

        req = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}}
        self._vlog(f">> {method} (id={req_id})")
        try:
            self.proc.stdin.write((json.dumps(req) + "\n").encode("utf-8"))
            self.proc.stdin.flush()
        except Exception as e:
            with self._lock:
                self._pending.pop(req_id, None)
            raise RuntimeError(f"stdin write failed: {e}") from e

        if not event.wait(timeout=timeout):
            with self._lock:
                self._pending.pop(req_id, None)
            raise TimeoutError(f"RPC timeout: {method}")

        msg = container["msg"]
        if msg is None:
            raise RuntimeError(f"RPC response empty: {method}")
        if "error" in msg and msg["error"]:
            err = msg["error"]
            err_msg = err.get("message") if isinstance(err, dict) else json.dumps(err)
            raise RuntimeError(err_msg or json.dumps(err))
        return msg.get("result")

    def notify(self, method: str, params=None):
        req = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        self._vlog(f">> {method} (notification)")
        try:
            self.proc.stdin.write((json.dumps(req) + "\n").encode("utf-8"))
            self.proc.stdin.flush()
        except Exception:
            pass

    def call_tool(self, name: str, arguments=None):
        result = self.request("tools/call", {"name": name, "arguments": arguments or {}})
        # MCP tool result: {content: [{type: 'text', text: '...'}], ...}
        if isinstance(result, dict):
            content = result.get("content")
            if isinstance(content, list) and content and content[0].get("type") == "text":
                text = content[0].get("text", "")
                try:
                    return json.loads(text)
                except Exception:
                    return text
        return result

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.terminate()
            self.proc.wait(timeout=2)
        except Exception:
            try:
                self.proc.kill()
            except Exception:
                pass


# ──────── frontmatter 工具 ────────
def escape_yaml(v) -> str:
    if v is None:
        return ""
    s = str(v)
    if re.search(r'[:#\n"\']', s):
        return json.dumps(s, ensure_ascii=False)
    return s


def drawer_to_markdown(drawer: dict) -> str:
    fm = ["---"]
    fm.append(f"drawer_id: {escape_yaml(drawer.get('id') or drawer.get('drawer_id'))}")
    fm.append(f"wing: {escape_yaml(drawer.get('wing'))}")
    fm.append(f"room: {escape_yaml(drawer.get('room'))}")
    if drawer.get("source_file"):
        fm.append(f"source_file: {escape_yaml(drawer['source_file'])}")
    if drawer.get("added_by"):
        fm.append(f"added_by: {escape_yaml(drawer['added_by'])}")
    if drawer.get("created_at"):
        fm.append(f"created_at: {escape_yaml(drawer['created_at'])}")
    fm.append(f"exported_at: {now_iso()}")
    fm.append("exported_by: mempalace-export.py (PROPOSAL_502_020 T-1)")
    fm.append("---")
    fm.append("")
    fm.append(drawer.get("content", "") or "")
    return "\n".join(fm)


def safe_filename(s) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(s or "unnamed"))[:120]


# ──────── 主流程 ────────
def main() -> int:
    args = sys.argv[1:]
    if "--help" in args or "-h" in args:
        print(__doc__)
        return 0
    verbose, dry_run, wing_filter = parse_args(args)

    def log(msg: str):
        print(f"[export] {msg}")

    def vlog(msg: str):
        if verbose:
            print(f"[trace] {msg}", file=sys.stderr)

    def err(msg: str):
        print(f"[ERROR] {msg}", file=sys.stderr)

    log("Starting MemPalace export via MCP RPC")
    if dry_run:
        log("DRY-RUN: 不寫檔；只列出")
    if wing_filter:
        log(f"Wing 過濾：{wing_filter}")

    mcp = MCPClient("mempalace-mcp", verbose=verbose)
    total_exported = 0
    total_skipped = 0

    try:
        # 1. initialize
        mcp.request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mempalace-export", "version": "1.0.0"},
        })
        mcp.notify("notifications/initialized")
        vlog("MCP initialized")

        # 2. list_wings
        wings_result = mcp.call_tool("mempalace_list_wings")
        wings = []
        if isinstance(wings_result, list):
            wings = wings_result
        elif isinstance(wings_result, dict):
            w = wings_result.get("wings")
            if isinstance(w, dict):
                wings = list(w.keys())
            elif isinstance(w, list):
                wings = w
            elif isinstance(wings_result.get("items"), list):
                wings = wings_result["items"]

        def wing_name_of(o):
            if isinstance(o, str):
                return o
            if isinstance(o, dict):
                return o.get("wing") or o.get("name")
            return None

        names_str = ", ".join(filter(None, (wing_name_of(w) for w in wings)))
        log(f"Found {len(wings)} wing(s): {names_str}")

        # 3. 遍歷每個 wing/room/drawer
        for wing_obj in wings:
            wing_name = wing_name_of(wing_obj)
            if not wing_name:
                continue
            if wing_filter and wing_name != wing_filter:
                vlog(f"Skip wing {wing_name} (filter)")
                continue

            rooms_result = mcp.call_tool("mempalace_list_rooms", {"wing": wing_name})
            rooms = []
            if isinstance(rooms_result, list):
                rooms = rooms_result
            elif isinstance(rooms_result, dict):
                rs = rooms_result.get("rooms")
                if isinstance(rs, dict):
                    rooms = list(rs.keys())
                elif isinstance(rs, list):
                    rooms = rs
                elif isinstance(rooms_result.get("items"), list):
                    rooms = rooms_result["items"]

            def room_name_of(o):
                if isinstance(o, str):
                    return o
                if isinstance(o, dict):
                    return o.get("room") or o.get("name")
                return None

            r_names_str = ", ".join(filter(None, (room_name_of(r) for r in rooms)))
            log(f"Wing {wing_name}: {len(rooms)} room(s): {r_names_str}")

            for room_obj in rooms:
                room_name = room_name_of(room_obj)
                if not room_name:
                    continue

                offset = 0
                room_count = 0
                while True:
                    list_result = mcp.call_tool("mempalace_list_drawers", {
                        "wing": wing_name, "room": room_name,
                        "limit": 100, "offset": offset,
                    })
                    drawers = []
                    if isinstance(list_result, list):
                        drawers = list_result
                    elif isinstance(list_result, dict):
                        drawers = list_result.get("drawers") or list_result.get("items") or []
                    if not drawers:
                        break

                    for meta in drawers:
                        if not isinstance(meta, dict):
                            continue
                        drawer_id = meta.get("id") or meta.get("drawer_id")
                        if not drawer_id:
                            continue
                        try:
                            drawer = mcp.call_tool("mempalace_get_drawer", {"drawer_id": drawer_id})
                        except Exception as e:
                            err(f"get_drawer {drawer_id}: {e}")
                            total_skipped += 1
                            continue
                        if not isinstance(drawer, dict) or not drawer.get("content"):
                            total_skipped += 1
                            continue
                        drawer["id"] = drawer_id
                        drawer["wing"] = drawer.get("wing") or wing_name
                        drawer["room"] = drawer.get("room") or room_name

                        out_dir = EXPORT_ROOT / safe_filename(wing_name) / safe_filename(room_name)
                        out_path = out_dir / f"{safe_filename(drawer_id)}.md"
                        md = drawer_to_markdown(drawer)
                        if dry_run:
                            vlog(f"would write: {out_path} ({len(md)} chars)")
                        else:
                            out_dir.mkdir(parents=True, exist_ok=True)
                            out_path.write_text(md, encoding="utf-8")
                            vlog(f"wrote: {out_path}")
                        room_count += 1
                        total_exported += 1

                    if len(drawers) < 100:
                        break
                    offset += len(drawers)

                log(f"  {wing_name}/{room_name}: {room_count} drawer(s)")

        log("─────────────────────────────")
        log(f"Exported {total_exported} drawer(s); skipped {total_skipped}")
        if not dry_run:
            log(f"Output: {EXPORT_ROOT}/")
        log("Done.")
        return 0
    except Exception as e:
        import traceback
        err(traceback.format_exc())
        return 1
    finally:
        mcp.close()


if __name__ == "__main__":
    sys.exit(main())
