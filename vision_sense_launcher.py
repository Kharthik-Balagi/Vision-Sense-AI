import json
import os
import signal
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8766
SCRIPT_PATH = Path(__file__).resolve().with_name("AI_Segmentation_Classroom.py")

process = None


def cors(handler):
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def send_json(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    cors(handler)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def process_running():
    return process is not None and process.poll() is None


def start_ai():
    global process
    if process_running():
        return {"ok": True, "message": "Vision Sense AI is already running."}

    process = subprocess.Popen(
        [sys.executable, str(SCRIPT_PATH)],
        cwd=str(SCRIPT_PATH.parent),
        creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
    )
    return {"ok": True, "message": "Vision Sense AI process started."}


def stop_ai():
    global process
    if not process_running():
        return {"ok": True, "message": "Vision Sense AI is already stopped."}

    if os.name == "nt":
        try:
            process.send_signal(signal.CTRL_BREAK_EVENT)
        except (AttributeError, OSError):
            process.terminate()
    else:
        process.send_signal(signal.SIGINT)

    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.terminate()

    return {"ok": True, "message": "Vision Sense AI stop requested."}


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        cors(self)
        self.end_headers()

    def do_POST(self):
        if self.path == "/start":
            send_json(self, 200, start_ai())
        elif self.path == "/stop":
            send_json(self, 200, stop_ai())
        else:
            send_json(self, 404, {"ok": False, "message": "Not found."})

    def do_GET(self):
        send_json(self, 200, {"ok": True, "running": process_running()})

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print("======================================")
    print("VISION SENSE LOCAL CONTROLLER")
    print("Start the website and use START SYSTEM.")
    print("Controller: http://127.0.0.1:8766")
    print("======================================")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
