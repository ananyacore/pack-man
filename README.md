# Packet Lab — Orbital Defense

A local educational network simulator with a Python OOP engine and a Three.js 3D frontend. Every device, packet, and attack is an in-memory demonstration. It never connects to or sends traffic to a real target.

## Run locally

Requires Python 3.10 or later.

```powershell
cd space-packet-lab
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app:app --reload
```

Open <http://127.0.0.1:8000>. The JavaScript module loads Three.js from unpkg over HTTPS; the app itself and Python engine run locally.

## Scenarios

- **DDoS surge:** a fixed, small synthetic burst; compare server load with the rate limiter on and off.
- **DNS spoof:** a fake answer is rejected by DNSSEC when enabled.
- **Port scan:** a few hard-coded demo port labels; the firewall can reject the probe.
- **Intercept attempt:** a toy packet interception event; firewall or encryption can reject it.

The controls send `select`, `defense`, `tick`, and `reset` JSON messages over the `/ws` WebSocket. Python sends event objects back for the Three.js frontend to animate.

## OOP map

- **Abstraction:** `Device` and `Attack` define common interfaces.
- **Inheritance:** `BotFleet`, `Router`, and `Server` extend `Device`; attack classes extend `Attack`.
- **Polymorphism:** devices implement their own `receive(packet)` behavior.
- **Composition:** `Simulation` owns the devices, strategies, and current attack.
- **Strategy pattern:** `Firewall`, `RateLimiter`, `Dnssec`, and `Encryption` implement `Defense`.
- **Factory pattern:** `AttackFactory` creates the selected scenario.
