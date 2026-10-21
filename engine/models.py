from dataclasses import dataclass
from enum import Enum

class AttackKind(str, Enum):
    DDOS = "ddos"
    DNS_SPOOF = "dns_spoof"
    PORT_SCAN = "port_scan"
    MITM = "mitm"

@dataclass(frozen=True)
class Packet:
    source: str
    destination: str
    kind: str
    label: str
    malicious: bool = False

@dataclass
class SimEvent:
    type: str
    message: str
    source: str = ""
    target: str = ""
    packet_kind: str = "normal"
    blocked: bool = False
    load: int = 0
    tick: int = 0
    def as_dict(self):
        return {"type": self.type, "message": self.message, "source": self.source,
                "target": self.target, "packet_kind": self.packet_kind,
                "blocked": self.blocked, "load": self.load, "tick": self.tick}
