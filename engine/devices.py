from abc import ABC, abstractmethod
from .models import Packet

class Device(ABC):
    """Abstract network node in the in-memory sandbox."""
    def __init__(self, device_id: str, label: str):
        self.id, self.label = device_id, label
    @abstractmethod
    def receive(self, packet: Packet) -> str:
        raise NotImplementedError

class Client(Device):
    def receive(self, packet):
        return f"{self.label} received {packet.label}."

class BotFleet(Client):
    def receive(self, packet):
        return f"Bot fleet simulated {packet.label}."

class Router(Device):
    def receive(self, packet):
        return f"Router forwarded {packet.label} inside the demo network."

class Server(Device):
    def __init__(self, device_id, label, capacity=100):
        super().__init__(device_id, label)
        self.capacity, self.load = capacity, 8
    def receive(self, packet):
        work = 8 if packet.malicious else 4
        self.load = min(100, self.load + work)
        return f"{self.label} load is {self.load}%."
    def cool_down(self):
        self.load = max(8, self.load - 2)
