from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from engine.simulation import Simulation

ROOT = Path(__file__).parent
app = FastAPI(title="Packet Lab Space Simulator")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")

@app.get("/")
async def home(): return FileResponse(ROOT / "static" / "index.html")

@app.websocket("/ws")
async def simulation_socket(socket: WebSocket):
    await socket.accept()
    sim = Simulation()
    await socket.send_json({"type": "ready", "message": "Local sandbox ready.", "load": 8})
    try:
        while True:
            message = await socket.receive_json()
            action = message.get("action")
            if action == "select":
                sim.select(str(message.get("kind", "ddos")))
                await socket.send_json({"type": "selected", "kind": sim.attack.kind.value, "message": f"{sim.attack.title} loaded."})
            elif action == "defense":
                sim.configure(str(message.get("kind", "")), bool(message.get("enabled")))
                await socket.send_json({"type": "defense", "kind": message.get("kind"), "enabled": bool(message.get("enabled")), "message": "Defense setting updated."})
            elif action == "tick":
                for event in sim.tick(): await socket.send_json(event)
            elif action == "reset":
                sim.reset()
                await socket.send_json({"type": "reset", "message": "Sandbox reset.", "load": 8})
            else:
                await socket.send_json({"type": "error", "message": "Unknown simulation action."})
    except (WebSocketDisconnect, ValueError):
        return
