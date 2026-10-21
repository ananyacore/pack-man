# Packet Lab — TODO / Feature Roadmap

The current build already has scenario-specific visual groups, a four-step walkthrough with camera focus, an attack/defense comparison, and a basic port-probe visual. The items below describe the next, more interactive versions of those ideas.

## 1. Ride the packet — main experience (active build)

- **In progress:** slow packet walkthrough now stops at source, router, defense check, and destination. Each stop explains what happens and waits for the user to continue; blocked packets end at the defense.
- Add a first-person/follow camera that travels beside one selected packet through the network.
- Show normal hops between client, router, and service before introducing the attack.
- Make attack behavior alter the packet's journey:
  - **MITM:** bend the route through the interceptor and visibly create a copy.
  - **DDoS:** fill the route with competing packets, show a growing queue, and make the followed packet slow or wait.
  - **DNS poisoning / ARP spoofing:** visibly redirect the packet toward a false destination.
- Keep the existing orbit camera as an alternate view and provide a clear return-to-network control.
- **Done when:** users can switch between network overview and packet-follow view, and can identify how the attack changed that packet's route.

## 2. Attacker / defender replay

- Turn the current defense comparison into a clear two-sided flow: observe the attack, switch to defender, choose a relevant defense, and replay the same scenario.
- Keep the attack inputs identical between runs so only the defense changes.
- Synchronize packet IDs/timing enough to compare paths, blocks, and server load side by side or with a before/after overlay.
- **Done when:** the user can explain what changed when a defense was enabled and see the corresponding event in both runs.

## 3. Attack-specific hands-on controls

- Upgrade the current port-probe visual into a scanner beam the user sweeps across a clear row of server ports.
- Make open and closed ports respond differently and explain what each response means.
- Keep a direct mouse/touch control; optionally let head direction aim the beam when head tracking is enabled.
- Then extend DDoS with user-controlled bot nodes and a visible queue/load meter.
- **Done when:** the user's input visibly controls the scan, and the results correspond to the simulated port responses.

## 4. Optional head-tracking inspection mode

- Add an explicit, opt-in webcam mode with a calibration step; process head pose locally in the browser and do not store or transmit video.
- Map small left/right movement to peeking around a router/firewall and forward lean to inspect a packet or reveal its headers.
- Add a dead zone, sensitivity control, recenter action, and immediate disable control.
- Preserve mouse/keyboard controls as the full-featured fallback.
- **Done when:** head movement makes it easier to inspect a route or packet, stays stable during normal movement, and can be disabled at any time.

## Supporting polish after the core interactions

- Add pause, slow motion, and single-step controls for packet journeys and replay comparisons.
- Add a packet X-ray panel for source, destination, protocol/type, and a clearly labeled demo payload.
- Add short missions only after the mechanics teach the attack and defense clearly.
- Use pop-art effects sparingly as feedback: a brief blocked-packet burst, subtle load shake, or corruption effect. Keep the network state readable.

## Suggested build order

1. Packet-follow camera and one complete MITM route/copy interaction.
2. Rework defense comparison into matched attacker/defender replay.
3. Make port scanning directly controllable, then add DDoS queue controls.
4. Prototype head tracking as an optional inspection control.
5. Add time controls, packet X-ray, missions, and visual/audio feedback.
