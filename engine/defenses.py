from abc import ABC, abstractmethod
from .models import AttackKind

class Defense(ABC):
    name = "Defense"
    @abstractmethod
    def inspect(self, packet):
        """True allows the packet; False blocks it."""

class Firewall(Defense):
    name = "Firewall"
    def inspect(self, packet):
        return not (packet.malicious and packet.kind in {AttackKind.PORT_SCAN.value, AttackKind.MITM.value})

class RateLimiter(Defense):
    name = "Rate limiter"
    def __init__(self, per_tick_limit=3): self.limit, self.seen = per_tick_limit, 0
    def reset_tick(self): self.seen = 0
    def inspect(self, packet):
        self.seen += 1
        return not (packet.kind == AttackKind.DDOS.value and self.seen > self.limit)

class Dnssec(Defense):
    name = "DNSSEC"
    def inspect(self, packet):
        return not (packet.kind == AttackKind.DNS_SPOOF.value and packet.malicious)

class Encryption(Defense):
    name = "End-to-end encryption"
    def inspect(self, packet):
        return not (packet.kind == AttackKind.MITM.value and packet.malicious)
