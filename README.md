# Cut Stream

Self-hosted review sessions for edit suites. A LiveKit room where clients join
by link, plus a high-bitrate feed from OBS (screen capture or NDI straight out
of Avid) published into the same room as another participant.

## What it does

- One link per session, passphrase-protected
- 1080p H.264 at 6 Mbps from OBS via WHIP, alongside webcam participants
- Three layouts: Stream, Hybrid, Grid
- Drawing over the picture, synced, persists until cleared
- Per-viewer volume on the feed
- Admin manages editor accounts; editors run their own sessions

## Requirements

- A server running Docker (built on TrueNAS)
- A domain with three subdomains: livekit. / whip. / meet.
- A reverse proxy with TLS (Nginx Proxy Manager here)
- Port forwarding, and ~8 Mbps upstream per remote participant
- OBS 30+ on the streaming machine

## Architecture

    Avid --NDI--> OBS --WHIP--> ingress --+
                                          +--> livekit-server --> browsers
                       browsers ----------+

Four containers: redis, livekit-server, livekit-ingress, and the Next.js
frontend. The first three run host-networked because ingress needs it.

## Setup

### 1. Configs

    cd livekit
    for f in *.example; do cp "$f" "${f%.example}"; done
    cd ../meet && cp compose.yaml.example compose.yaml
    cp app/.env.example app/.env.local

Generate an API key pair:

    docker run --rm livekit/generate --keys

It goes in three places and must match exactly: livekit/livekit.yaml,
livekit/ingress.yaml, and meet/app/.env.local.

Then replace throughout: example.com with your domain, eth0 with the interface
carrying your default route (ip route get 1.1.1.1), and 192.168.1.50 with your
server's LAN IP.

### 2. Ports

| Port | Proto | Purpose |
|---|---|---|
| 443 | TCP | signaling + WHIP handshake, via the proxy |
| 7881 | TCP | media fallback for UDP-blocked clients |
| 7882 | UDP | all WebRTC media |
| 7885 | UDP | WHIP media, only if OBS is off-LAN |

### 3. Reverse proxy

| Subdomain | Port | Notes |
|---|---|---|
| livekit. | 7880 | Websockets MUST be enabled |
| whip. | 8085 | disable "block common exploits" |
| meet. | 3002 | websockets on |

All three need valid TLS. Browsers refuse WebRTC over plain HTTP.

### 4. Start

    cd livekit && docker compose up -d
    cd ../meet && docker compose up -d

Check it found your public IP:

    docker logs livekit-server 2>&1 | grep 'external IPs'

You want public/lan. Both showing the LAN address means NAT detection failed.

### 5. First login

Visit https://meet.example.com/admin, username admin, password from
ADMIN_PASSWORD. That first login creates the account; the env var is ignored
afterwards.

## OBS settings

Stream: Service WHIP, Server = the URL from the admin page, Bearer Token =
the stream key.

| Setting | Value |
|---|---|
| Encoder | NVENC H.264 / Apple VT H.264 |
| Rate control | CBR |
| Bitrate | 6000 Kbps |
| Keyframe interval | 1s |
| B-frames | 0 |
| Look-ahead | off |
| Multipass | disabled |
| Tuning | low latency |

B-frames at 0 is not optional. They encode out of display order and the result
looks like the picture is jogging backwards. NVENC defaults to 2.

Video: 1920x1080 in and out, FPS matching your timeline exactly. "24 NTSC" is
23.976, not 24 - a mismatch makes OBS resample and adds latency.

## NDI from Avid

Avid has had native NDI output since 2018.7. Install DistroAV in OBS and add
an NDI Source.

- Avid disables its other outputs when NDI is on, including full-screen
  playback. Tell your editor before they find out mid-session.
- Avid hands its audio to NDI exclusively. You hear nothing locally unless you
  enable Audio Monitoring on the NDI source in OBS.

## Gotchas

The WHIP stream key goes in the URL path, not just the bearer header:
https://whip.example.com/w/STREAMKEY

whip_base_url in livekit.yaml must be your public URL, or CreateIngress hands
OBS an internal address it can't reach.

Pin the network interface. With many docker bridges, LiveKit advertises ICE
candidates on all of them and clients waste seconds failing.

Raise the UDP buffer and make it survive reboots:
sysctl -w net.core.rmem_max=5000000 net.core.wmem_max=5000000

Audio interfaces can loop back. A monitor controller set to record its 2-track
bus rather than its inputs makes clients hear the stream audio twice.

iOS ignores programmatic volume and can't fullscreen arbitrary elements, so
both controls hide there.

## Limitations

- 8-bit 4:2:0 H.264. Fine for cut review, not grade approval.
- Single-layer by default (transcoding bypassed), so no simulcast fallback.
  A participant who can't sustain the bitrate stutters rather than degrading.
- One ingress per room, so switching projects means a new stream key in OBS.
- One server, one region. Long-haul participants eat the full round trip.

## Licence

Built on livekit-examples/meet, Apache 2.0.
