from abc import ABC, abstractmethod
from .models import AttackKind, Packet

class Attack(ABC):
    kind: AttackKind
    title: str
    @abstractmethod
    def packets(self, tick: int) -> list[Packet]:
        raise NotImplementedError

class DdosAttack(Attack):
    kind, title = AttackKind.DDOS, "DDoS surge"
    def packets(self, tick):
        return [Packet("bots", "web", self.kind.value, "request burst", True) for _ in range(7)]

class DnsSpoofAttack(Attack):
    kind, title = AttackKind.DNS_SPOOF, "DNS spoof"
    def packets(self, tick):
        return [Packet("forged-beacon", "dns", self.kind.value, "forged DNS answer", True),
                Packet("client", "dns", "normal", "trusted DNS lookup")]

class PortScanAttack(Attack):
    kind, title = AttackKind.PORT_SCAN, "Port scan"
    def packets(self, tick):
        ports = (22, 80, 443, 8080)
        return [Packet("probe", "web", self.kind.value, f"demo port {ports[tick % len(ports)]}", True)]

class MitmAttack(Attack):
    kind, title = AttackKind.MITM, "Intercept attempt"
    def packets(self, tick):
        return [Packet("interceptor", "router", self.kind.value, "intercepted demo packet", True),
                Packet("client", "web", "normal", "encrypted session")]

class AttackFactory:
    _attacks = {a.kind.value: a for a in (DdosAttack, DnsSpoofAttack, PortScanAttack, MitmAttack)}
    @classmethod
    def create(cls, kind):
        if kind not in cls._attacks: raise ValueError("Unknown demo scenario")
        return cls._attacks[kind]()
