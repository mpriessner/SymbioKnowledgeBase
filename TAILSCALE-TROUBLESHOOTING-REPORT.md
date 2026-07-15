# Tailscale TCP Connectivity Troubleshooting Report

**Date:** 2026-03-28
**Goal:** Mac Mini (Clawdbot gateway) needs to reach MacBook Pro (Next.js server on port 3000) over Tailscale for voice agent KB queries.

---

## Environment

| Machine | Role | Tailscale Device Name | Tailscale IP | OS |
|---------|------|-----------------------|--------------|----|
| MacBook Pro | Next.js server (SKB) on port 3000 | martins-macbook-pro-1 | 100.105.235.96 | macOS (Darwin 24.6.0) |
| Mac Mini | Clawdbot gateway (Python, port 18799) | martins-mac-mini-1 | 100.95.127.102 | macOS |

Both machines are on the same Tailscale tailnet under `martin.priessner@gmail.com` (Free plan).

There are also stale device entries from before the reinstall:
- `martins-macbook-pro` at `100.73.144.62` (offline)
- `martins-mac-mini` at `100.83.160.127` (offline)

---

## The Problem

The Mac Mini cannot establish any TCP connection to the MacBook Pro over Tailscale. Tailscale's own ICMP-like ping works, but all TCP connections (any port) time out after 15 seconds.

This causes HTTP 504 (gateway timeout) when the voice agent on an iPhone calls Clawdbot on the Mac Mini, which tries to proxy the request to the SKB server on the MacBook Pro.

---

## What Works

1. **Tailscale ping (both directions):**
   ```
   # Mac Mini → MacBook Pro
   pong from martins-macbook-pro-1 (100.105.235.96) via DERP(nyc) in 617ms

   # MacBook Pro → Mac Mini
   pong from martins-mac-mini-1 (100.95.127.102) via DERP(ams) in 371ms
   ```

2. **Next.js server is running and bound correctly on MacBook Pro:**
   ```
   $ lsof -iTCP:3000 -sTCP:LISTEN -P -n
   node  15520  mpriessner  16u  IPv4  TCP *:3000 (LISTEN)

   $ netstat -an | grep "\.3000" | grep LISTEN
   tcp4  0  0  *.3000  *.*  LISTEN
   ```

3. **Local requests on MacBook Pro work:**
   ```
   $ curl http://127.0.0.1:3000/api/agent/kb-query → HTTP 307 (auth redirect, expected)
   $ curl with auth header → HTTP 401 (invalid key, expected)
   $ curl with valid API key → HTTP 200 with search results
   ```

4. **LAN IP works from Mac Mini (when on same network):**
   ```
   $ curl http://192.168.32.8:3000/api/agent/kb-query → HTTP 307 (connected successfully)
   ```

5. **Tailscale status shows both machines online and connected:**
   ```
   100.105.235.96  martins-macbook-pro-1  macOS  -
   100.95.127.102  martins-mac-mini-1     macOS  active; relay "ams", tx 400 rx 2632
   ```

---

## What Does NOT Work

1. **Any TCP connection from Mac Mini to MacBook Pro via Tailscale IP — times out:**
   ```
   $ curl -v --max-time 15 http://100.105.235.96:3000/...
   * Connection timed out after 15003 milliseconds

   $ curl -v --max-time 10 http://100.105.235.96:9999/   (test python HTTP server)
   * Connection timed out after 10006 milliseconds
   ```

2. **Tailscale hostname also times out:**
   ```
   $ curl -v --max-time 10 http://martins-macbook-pro-1.tail3a744f.ts.net:3000/...
   * Host resolved to 100.105.235.96
   * Connection timed out after 10003 milliseconds
   ```

3. **Tailscale Serve (HTTPS proxy on port 443) — also times out:**
   ```
   # On MacBook Pro:
   $ tailscale serve --bg 3000
   → Available within your tailnet: https://martins-macbook-pro-1.tail3a744f.ts.net/

   # On Mac Mini:
   $ curl -v --max-time 15 https://martins-macbook-pro-1.tail3a744f.ts.net/...
   * Connected to port 443, TLS handshake started
   * Connection timed out after 15002 milliseconds
   ```

4. **Tailscale Funnel (public HTTPS proxy) — enabled but not yet tested from Mac Mini:**
   ```
   # On MacBook Pro:
   $ tailscale funnel --bg 3000
   → Available on the internet: https://martins-macbook-pro-1.tail3a744f.ts.net/
   ```

5. **TCP from MacBook Pro to Mac Mini also times out (bidirectional failure):**
   ```
   $ curl -s --max-time 10 http://100.95.127.102:18799/health
   * Connection timed out
   ```

6. **MacBook Pro cannot reach its own Tailscale IP (expected macOS loopback limitation):**
   ```
   $ nc -z -w 5 100.105.235.96 3000 → exit: 1
   $ curl http://100.105.235.96:3000 → timeout
   ```

---

## Steps Taken

### 1. Initial Diagnosis (HTTP 504 from voice agent)
- Confirmed server running on MacBook Pro, responding locally
- Found Next.js was bound to IPv6 only (`[::]:3000`)
- Added `-H 0.0.0.0` to dev script → server now binds IPv4 `*:3000`
- Still 504 from voice agent

### 2. Tailscale Connectivity Check
- `ping -c 3 100.73.144.62` from Mac Mini → 100% packet loss
- `curl http://192.168.32.8:3000` from Mac Mini → worked (LAN IP)
- Concluded: Tailscale tunnel not passing traffic

### 3. Shields-Up Check
- Ran: `tailscale set --accept-routes --shields-up=false`
- No change

### 4. macOS Firewall Check
- `/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate` → Firewall is disabled
- Not the issue

### 5. Tailscale ACL Check
- Checked https://login.tailscale.com/admin/acls
- Rule: "All users and devices" → "All users and devices" → "All ports and protocols"
- ACLs are wide open, not the issue

### 6. Discovered App Store vs Standalone Version Issue
- MacBook Pro had App Store version: bundle ID `io.tailscale.ipn.macos`
- No system network extension installed (`systemextensionsctl list` showed nothing for Tailscale)
- App Store version uses userspace networking (sandboxed) — cannot accept incoming TCP connections
- **Action:** Uninstalled App Store version, installed standalone from tailscale.com/download
- Verified: bundle ID now `io.tailscale.ipn.macsys`, system extension `io.tailscale.ipn.macsys.network-extension [activated enabled]`
- MacBook Pro got new device name `martins-macbook-pro-1` and new IP `100.105.235.96`

### 7. Also Reinstalled on Mac Mini
- Mac Mini also upgraded to standalone version
- Confirmed: `io.tailscale.ipn.macsys.network-extension (1.96.2/101.96.2) [activated enabled]`
- New device name `martins-mac-mini-1`, new IP `100.95.127.102`

### 8. Post-Reinstall Testing
- Tailscale ping works both directions (via DERP relay)
- TCP still times out on all ports (3000, 9999, 443)
- Both directions fail (Mac Mini → MacBook Pro AND MacBook Pro → Mac Mini)

### 9. Tailscale Serve
- Enabled `tailscale serve --bg 3000` on MacBook Pro
- HTTPS on port 443 via Tailscale → still times out from Mac Mini

### 10. Tailscale Funnel
- Enabled `tailscale funnel --bg 3000` on MacBook Pro
- Routes through Tailscale's public servers → not yet tested from Mac Mini

### 11. Tailscale Netcheck (on MacBook Pro)
```
* UDP: true
* IPv4: yes, 185.190.141.169:58176
* IPv6: no, but OS has support
* MappingVariesByDestIP: false
* Nearest DERP: New York City
* DERP latency: nyc 147ms, lhr 207ms, ams 218ms, fra 222ms
```
- Also showed error: `routerIP/FetchRIB: sysctl: cannot allocate memory`
- No direct peer connection established — all traffic goes through DERP relay
- Machines may be on different public networks (MacBook Pro public IP: 185.190.141.169, Mac Mini public IP: unknown)

---

## Key Observations

1. **Tailscale WireGuard ping works but TCP doesn't** — this is unusual and suggests the network extension is not properly routing TCP packets through the tunnel, even though it's activated and enabled.

2. **Bidirectional TCP failure** — neither machine can reach the other via TCP over Tailscale, ruling out a one-sided firewall or configuration issue.

3. **DERP relay only** — no direct peer connection is established. Both machines connect through DERP relays (nyc/ams). The machines may be on different networks (one possibly on VPN or mobile hotspot).

4. **Memory error in netcheck** — `routerIP/FetchRIB: sysctl: cannot allocate memory` on the MacBook Pro may indicate the network extension is not functioning properly.

5. **LAN works** — when both machines are on the same local network, direct IP connectivity works fine. The issue is isolated to Tailscale's tunnel.

6. **Tailscale version:** 1.96.2 (standalone, with system network extension) on both machines.

---

## Not Yet Tried

- Testing Tailscale Funnel from Mac Mini (public HTTPS proxy, bypasses peer-to-peer tunnel entirely)
- Rebooting either machine after installing the standalone Tailscale version
- Running `tailscale netcheck` on the Mac Mini
- Checking if a VPN or other network overlay is conflicting with Tailscale's network extension
- Checking macOS `pfctl` packet filter rules (requires sudo)
- Checking Console.app for Tailscale network extension errors/logs
- Downgrading Tailscale version
- Testing with Tailscale's `--netfilter-mode` options

---

## Current State

- Tailscale Funnel is enabled on MacBook Pro (`tailscale funnel --bg 3000`)
- Tailscale Serve is also enabled on MacBook Pro
- Server is running on `*:3000`
- Clawdbot gateway `.env` has `SKB_BASE_URL=http://100.105.235.96:3000` (needs updating to `https://martins-macbook-pro-1.tail3a744f.ts.net` if Funnel works)
