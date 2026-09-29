from .attacks import AttackFactory
from .defenses import Dnssec, Encryption, Firewall, RateLimiter
from .devices import BotFleet, Client, Router, Server
from .models import SimEvent

class Simulation:
    """Composes device objects, defense strategies and the attack factory."""
    def __init__(self):
        self.devices = {"client": Client("client", "Explorer"), "bots": BotFleet("bots", "Bot fleet"),
                        "router": Router("router", "Relay"), "web": Server("web", "Web station"),
                        "dns": Server("dns", "DNS station")}
        self.defenses = {"firewall": Firewall(), "rate_limiter": RateLimiter(),
                         "dnssec": Dnssec(), "encryption": Encryption()}
        self.enabled = {"firewall": True, "rate_limiter": False, "dnssec": True, "encryption": True}
        self.attack, self.tick_count = AttackFactory.create("ddos"), 0
    def configure(self, kind, enabled):
        if kind not in self.enabled: raise ValueError("Unknown defense")
        self.enabled[kind] = bool(enabled)
    def select(self, kind):
        self.attack, self.tick_count = AttackFactory.create(kind), 0
    def reset(self): self.__init__()
    def tick(self):
        self.tick_count += 1
        self.defenses["rate_limiter"].reset_tick()
        events = [SimEvent("tick", f"Simulation tick {self.tick_count}", tick=self.tick_count)]
        for packet in self.attack.packets(self.tick_count):
            passed = True
            for key in ("firewall", "rate_limiter", "dnssec", "encryption"):
                defense = self.defenses[key]
                if self.enabled[key] and not defense.inspect(packet):
                    passed = False
                    events.append(SimEvent("blocked", f"{defense.name} blocked {packet.label}.", packet.source,
                        packet.destination, packet.kind, True, self.devices["web"].load, self.tick_count))
                    break
            if passed:
                device = self.devices.get(packet.destination)
                detail = device.receive(packet) if device else "Packet moved through the simulated relay."
                events.append(SimEvent("packet", detail, packet.source, packet.destination, packet.kind,
                    False, self.devices["web"].load, self.tick_count))
        self.devices["web"].cool_down()
        events.append(SimEvent("status", "Simulation step complete.", load=self.devices["web"].load, tick=self.tick_count))
        return [event.as_dict() for event in events]
