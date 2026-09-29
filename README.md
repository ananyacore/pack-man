# Packet Lab — Network Simulator

A local, interactive demonstration of common network threats and defenses. Select an incident, change the defenses, and run the same synthetic traffic through the Python simulation to compare outcomes. The topology supports drag-to-orbit, scroll-to-zoom, and selecting a device for a short explanation.

## Run locally

Requires Python 3.10 or later.

```powershell
cd "C:\Users\Ananya\Documents\Codex\2026-09-29\you-pasted-the-whole-thread-without\outputs\space-packet-lab"
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload
```

Open <http://127.0.0.1:8000>. The page connects to the local Python engine over WebSocket. The Three.js view is loaded from unpkg over HTTPS; if it is unavailable, an interactive local topology remains visible.

## Scenarios

- **Traffic surge:** many clients send requests at once; request throttling limits the burst.
- **Fake DNS reply:** an altered lookup reply attempts to redirect a client; signed DNS checks its authenticity.
- **Port probing:** a client checks which services answer; firewall rules can reject unwanted probes.
- **Traffic interception:** a device attempts to read a message in transit; encryption keeps its contents unreadable.

All traffic is generated inside the demonstration and never targets real systems.

## OOP concepts in the Python engine

The engine uses abstraction and inheritance for devices and attacks, polymorphic packet handling, composition to build a simulation, defense strategy objects, and an attack factory.

During a run, the playback panel explains the path in four steps: source, router, defense, and service. **Compare this defense** automatically replays the same scenario once with its relevant defense off and once on, then summarizes how many events were blocked or reached the service and the final service load.
