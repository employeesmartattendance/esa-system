# 🔒 Hikvision Fingerprint Device — Complete Setup Guide

This guide walks you through connecting your **Hikvision DS-K1T802-series
fingerprint terminal** (the device in your photos) to ESA, end to end, so
employees can check in/out with a finger scan instead of (or alongside)
face verification.

## What was actually verified, and how

I checked every ISAPI call the code makes against Hikvision's own
published ISAPI protocol documentation (not just against itself), and
found and fixed **two real bugs** that would have silently broken
enrollment on real hardware:

1. **Enrollment progress was polling an endpoint that doesn't exist.**
   The code was checking `/CaptureFingerPrintProgress` for capture
   status — that endpoint isn't part of Hikvision's fingerprint-capture
   flow (only face-capture has a `/Progress` endpoint; fingerprint
   capture responds to a single blocking call instead). This meant every
   enrollment would have appeared to "time out" after 60 seconds **even
   when the employee scanned successfully on the device.** Fixed: the
   agent now waits on the one call Hikvision actually documents, with a
   long enough timeout to cover the device's own ~60-second capture
   window.
2. **Re-enrollment after a failed attempt would have been rejected by
   the device.** The code was sending a person-update as `PUT` to the
   "add new person" endpoint, which isn't a valid operation there. Fixed:
   it now adds new people the documented way, and correctly *edits* the
   record on the device for anyone who already has one from a prior
   attempt.

I can't physically plug into your exact unit and firmware from here, so
this is real, protocol-level verification against Hikvision's public
documentation — the strongest check possible without hands-on-hardware
access — not a live test. Section 7 below tells you exactly what to
watch for on your **first real enrollment** so you can confirm it end to
end yourself in a couple of minutes, and what to do if anything looks
off.

**Good news:** none of this needed re-coding from scratch — the overall
integration (routes, database models, every dashboard screen) was
already fully built and wired up correctly. What's below is mostly
configuration, plus the fixes above.

---

## 0. How this actually works (read this first)

ESA itself runs on the internet (e.g. on Render). Your fingerprint
scanner sits on your local Wi-Fi/LAN at home or at the school, behind
your router. A server on the internet can **never** open a connection
directly into a device behind a router — that's just how home/office
networks work, not a limitation of this app.

So ESA uses the standard workaround: a small helper program called the
**connector** (`hikvision-agent/` folder) runs on any always-on
computer on the **same network as the device** (a spare PC, an old
laptop, or a Raspberry Pi). It:

1. Talks to the fingerprint device directly (easy — same network).
2. Talks to ESA over normal internet (the same direction your browser
   already uses — no port forwarding, no VPN).

```
[Fingerprint Scanner] <--LAN--> [Connector on a PC] <--Internet--> [ESA] <--Internet--> [Dashboard/Teacher phones]
```

You need **three** things configured correctly for this to work:
Device → Agent → ESA Dashboard. The sections below do each one in order.

---

## 1. What's in the box vs. what you still need

Looking at your photos: you have the terminal itself (fingerprint
scanner, keypad, screen — Hikvision DS-K1T802-series) and a single white
pigtail cable coming out of the back with **two bare, unterminated
wires** at the end. That's it — no power adapter, no networking hardware,
no mounting hardware visible.

**⚠️ Important honesty note:** I can identify the device *model family*
confidently from the photos, but I can't reliably read exact wire colors
or pinouts from a phone photo, and getting DC polarity backwards can
damage the board. So this section tells you *what categories* of
hardware you're missing and how to confirm details safely — not "connect
the blue wire to X," because I'm not certain enough of that from a photo
to say it responsibly.

### What you're missing

| # | What | Why you need it | Notes |
|---|------|------------------|-------|
| 1 | **12V DC power supply** | This model runs on 12V DC — there's no barrel-jack adapter included based on what you've shown. Devices in this series typically draw around 12V/1A. | Buy a regulated 12V DC wall adapter rated **at least 1A** (slightly more headroom is fine, less is not). |
| 2 | **A way to safely join the bare power leads to the adapter** | Your cable ends in bare wire, not a barrel plug. | A small **screw-terminal block** or "Wago"-style lever connector (a few dollars at any hardware store) — much safer and more reversible than twisting bare wires and taping them. |
| 3 | **Network connectivity to your router/switch** | The agent and device both need to be reachable on the same LAN. | See "About the network connection" below — this model family normally has a separate Ethernet port for this, distinct from the pigtail in your photos. |
| 4 | **Mounting hardware** (optional for now) | Only needed for permanent wall installation. | Skip this while you're just testing on a desk with power connected. |
| 5 | **An always-on computer on the same network** | To run the connector (software, not hardware) described in Section 4. | Doesn't have to be dedicated — any always-on PC/mini-PC/Raspberry Pi on the same Wi-Fi/LAN works. |

### What you do **not** need
Skip anything related to physically unlocking a door — an **electric
door lock, lock power supply, or exit button** — unless you *also* want
this terminal to control a physical door. ESA only needs the device's
fingerprint scanner and its network connection; it never uses the
lock-relay side of the terminal.

### About the network connection
Your photos show one cable with 2 bare wires — that's very likely the
**power pair only** (a 2-conductor pigtail can't carry Ethernet, which
needs 4+ wires). Terminals in this family are documented as also having
a **separate physical network port** (RJ45 Ethernet), independent from
the power/lock wiring pigtail:

- **Check the back/underside of the unit and inside the wall-mount
  bracket cavity** for a small RJ45 socket you may not have uncovered
  yet — it's easy to miss if the mounting bracket is still covering it.
- If you genuinely find no RJ45 port anywhere on the unit, it's possible
  your specific variant relies on Wi-Fi instead — check the device's
  on-screen menu (`Menu → Communication`) once it's powered on for a
  Wi-Fi option.
- Either way, once you locate the model number **printed on a sticker on
  the back of the unit**, search `hikvision <that exact model number>
  quick start guide pdf` — Hikvision's own PDF for your exact variant
  will show the definitive wiring diagram and interface list, which is
  more reliable than anything I can read off a photo.

### Before you connect any power
1. Confirm polarity — most Hikvision terminals in this class use
   **black = negative/ground**, but confirm against the guide for your
   exact model before connecting, or check for a printed +/− legend
   molded into the connector housing itself.
2. Use the terminal block/lever connector from item 2 above rather than
   a permanent splice, so you can easily disconnect if something's wired
   wrong.
3. Power on and watch the device's own screen light up before doing
   anything else in ESA — that alone confirms the power side is correct.

---

## 2. Prepare the Hikvision device itself

Your device is a Hikvision **DS-K1T802-series** access terminal
(keypad + fingerprint scanner, the one in your photos, marked "Hikvision"
on the front).

### 2.1 Activate the device (only if you haven't already)
Hikvision devices ship **inactive** and refuse all API calls until
activated with a password. If your device already has a login you use
(e.g. through iVMS-4200 or its own menu), skip to 2.2.

1. Download **SADP Tool** (free, from Hikvision) on a Windows PC on the
   same network, or use the device's own on-screen menu.
2. SADP will list the device and show "Inactive."
3. Click **Activate**, set a strong password (8+ chars, upper/lower/number).
   This becomes your device's `admin` password.

### 2.2 Give the device a fixed IP address
If the device's IP changes (e.g. after a power cut), ESA will lose
connection until you update the config. Avoid this:

- **Best:** In your router's admin page, reserve a fixed LAN IP for the
  device's MAC address ("DHCP reservation" / "static lease").
- **Alternative:** Set a static IP directly on the device via its own
  menu: `Menu → Communication → Network`.

Write this IP down (e.g. `192.168.1.50`) — you'll need it in step 3 below.

### 2.3 Confirm ISAPI is reachable
On a computer on the **same network** as the device, open a browser and
go to:

```
http://<device-ip>/ISAPI/System/deviceInfo?format=json
```

It will prompt for a username/password — use the admin credentials from
step 2.1. If you see JSON with `deviceName`, `model`, `serialNumber`,
you're good — ISAPI is working. If it hangs or refuses, double-check the
IP, that the device is powered on, and that your computer is on the same
network (not a guest Wi-Fi that isolates devices from each other).

---

## 3. Configure the device in the ESA dashboard

1. Log in as a **School Admin**.
2. Go to **Settings → Fingerprint Scanner**.
3. Fill in:
   - **Scanner Address** — the IP from step 2.2 (e.g. `192.168.1.50`)
   - **Port** — `80` unless you changed it on the device
   - **Username** — usually `admin`
   - **Password** — the password from step 2.1
   - **Name** — optional, e.g. "Main Entrance"
4. Click **Save Device**.
5. A **connection key** box will appear — a long random string. **Copy
   it now**; it is only shown once. (If you ever lose it, click "Get New
   Connection Key" — but then you'll need to update the connector's
   config too.)

Leave this tab open — you'll come back to check "Connector: Connected"
in a few minutes.

---

## 4. Install and run the connector

Do this on the always-on computer that's on the **same network as the
scanner** (not on the same machine as ESA's servers). This small program
is called the "connector" — its folder is `hikvision-agent/`.

### 4.1 Install
```bash
cd hikvision-agent
npm install
cp config.example.js config.js
```

### 4.2 Edit `config.js`
Open `hikvision-agent/config.js` and set:

```js
module.exports = {
  backendUrl: 'https://YOUR-BACKEND.onrender.com',   // your real backend URL, no trailing /api
  agentToken: 'PASTE_THE_CONNECTION_KEY_FROM_STEP_3_HERE',
  deviceCommandPollMs: 4000,
  eventPollMs: 4000,
};
```

### 4.3 Run it
```bash
node index.js
```

You should see:
```
🚀 ESA Hikvision Bridge Agent starting…
   Backend: https://YOUR-BACKEND.onrender.com
✅ Connected to device: <device name> (<model>)
✅ Connector running. Leave this window/process open.
```

If instead you see `⚠️ Could not reach device: ...`, see
[Troubleshooting](#troubleshooting) below.

Go back to the ESA Settings tab and refresh — **"Connector: Connected"**
should appear within about a minute.

### 4.4 Keep it running permanently (don't skip this)
`node index.js` stops the moment you close the terminal or the computer
restarts. For real use, run it as a background service:

**Option A — PM2 (works on Windows, macOS, Linux, easiest):**
```bash
npm install -g pm2
cd hikvision-agent
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # then copy/run the command it prints — this makes
                    # PM2 (and your agent) start automatically on reboot
```

**Option B — Linux with systemd:**
Create `/etc/systemd/system/esa-hikvision-agent.service`:
```ini
[Unit]
Description=ESA Hikvision Bridge Agent
After=network.target

[Service]
Type=simple
WorkingDirectory=/full/path/to/hikvision-agent
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Then:
```bash
sudo systemctl enable --now esa-hikvision-agent
```

**Option C — Windows Task Scheduler:** create a task that runs
`node.exe` with argument `index.js` and working directory set to the
`hikvision-agent` folder, triggered "At log on" with "Run whether user
is logged on or not," and set to restart on failure. PM2 (Option A) is
simpler and does this for you automatically.

---

## 5. Turn fingerprint check-in ON for your school

The device and agent being connected isn't enough by itself — check-in
still needs to be told to *require* biometric verification:

1. Still as School Admin, go to **Settings**.
2. Find **Biometric verification required for check-in** and turn it
   **ON**, then save.

> 💡 This one setting controls *both* face verification and fingerprint
> verification — an employee can use either, since both feed the same
> check-in gate. GPS location checks (if enabled) still apply on top of
> biometric verification — they're independent checks.

---

## 6. Enroll each employee's fingerprint

1. Go to **Teachers** (or your school's "employees" list).
2. Find the employee, click their **fingerprint icon**.
3. Click **Start Fingerprint Capture**.
4. **Have the employee stand at the physical device right now** — capture
   arms within a few seconds.
5. The employee places the same finger on the scanner **2–3 times** as
   prompted by the device itself (its screen will guide them).
6. The dashboard will show **"Fingerprint enrolled successfully"** once
   the device confirms the template was saved. If it times out or fails,
   click Start again — the most common cause is the employee not
   scanning the finger within the ~60 second capture window.

Repeat for every employee who'll use fingerprint check-in. (Face
verification, GPS, and fingerprint can all be used side-by-side — you
don't have to pick just one.)

### How to confirm your very first enrollment actually worked end-to-end
Do this once, with one test employee, before rolling it out to everyone:

1. Keep the connector's terminal/console window visible while you
   click **Start Fingerprint Capture**.
2. You should see, in order:
   `→ Starting fingerprint capture for employee …` →
   `Have employee … scan their finger at the device now — waiting up to
   ~60s…` → then, once the employee finishes scanning at the device,
   either `✅ Fingerprint enrolled for employee …` or a `❌ Fingerprint
   capture failed` line with a reason.
3. If it says `✅ Fingerprint enrolled`, the dashboard should flip to
   **"Fingerprint enrolled successfully"** within a couple of seconds.
4. As a final check, have that same employee actually walk over and
   scan at the device once enrollment is done, and confirm the check-in
   banner in Section 7 below fires — that's the true end-to-end proof,
   not just "enrolled" in the database.

If step 2 instead shows a `❌` failure message, the message text tells
you why (device rejected the request, HTTP error code, etc.) — see
[Troubleshooting](#troubleshooting) below for the common causes.

---

## 7. Employee check-in with fingerprint

1. Employee opens ESA and logs in.
2. On their check-in screen, once enrolled, they'll see: **"Or scan your
   fingerprint at the device."**
3. They tap that, then walk over and place their finger on the scanner.
4. Within a few seconds the app detects the match and completes check-in
   automatically — no further taps needed.

---

## Troubleshooting

**"Could not reach device" when starting the agent**
- Confirm the agent's computer and the device are on the *same* network
  (same router/subnet — not one on Wi-Fi guest network, one on main).
- Re-check the IP in ESA Settings matches the device's actual current IP.
- Re-test the ISAPI URL from step 2.3 from the *agent's* machine
  specifically.
- Some routers/switches block device-to-device traffic ("AP/client
  isolation," common on guest Wi-Fi) — turn that off, or move the device
  to the main network.

**Agent shows "Not connected yet" / never goes Online in the dashboard**
- Make sure `agentToken` in `config.js` was copied *exactly* (no extra
  spaces/newlines) and matches what's currently valid — regenerating the
  token in the dashboard invalidates the old one.
- Check `backendUrl` has no typo and no trailing `/api`.
- Check the connector's console output for connection errors (proxy,
  firewall, or DNS issues on that machine).

**Device responds `HTTP 401` repeatedly / digest auth fails**
- Double check the ISAPI username/password saved in ESA Settings matches
  what you set during device activation exactly (case-sensitive).
- Some devices lock out ISAPI login after repeated failed attempts —
  power-cycle the device if you've been testing wrong passwords.

**Capture starts but never finishes ("Capture failed or timed out")**
- The employee has 2–3 scan attempts and roughly 60 seconds on the
  device's own clock — if they weren't at the device when Start was
  clicked, restart the capture.
- Clean the fingerprint sensor glass and make sure the finger isn't wet,
  overly dry, or has fresh cuts/wounds obscuring the ridge pattern.
- Check the connector's console for the actual failure message (see
  "How to confirm your first enrollment worked" above) — it now reports
  the device's real response instead of just "timed out" for everything.

**A capture that clearly succeeded on the device still shows "failed" in
the dashboard**
- This is the exact bug described at the top of this guide (a
  non-existent progress-check endpoint) and is fixed in this version of
  the code. If you're somehow still seeing it, make sure you're running
  the updated `hikvision-agent/deviceClient.js` and `index.js` from this
  package, not an older copy.

**Fingerprint scan doesn't check the employee in on the app**
- Confirm **Settings → Biometric verification required for check-in** is
  turned ON (step 5) — the fingerprint match still won't count if this
  toggle is off.
- Confirm the employee's fingerprint status shows "enrolled" (not
  "pending" or "failed") on the Teachers page.
- Make sure the connector is still running — if it crashed or
  the computer restarted without a persistent service (step 4.4), match
  events stop being relayed to ESA even though the physical scan still
  succeeds on the device itself.

**A specific employee's enrollment keeps failing while others work fine**
- Very rare, but some Hikvision firmware versions cap how long an
  `employeeNo` string can be. ESA uses the employee's internal database ID
  (24 characters) as the `employeeNo`. If you hit this, contact whoever
  set up your ESA instance — a workaround (shorter numeric employee
  codes) is a small change on ESA's side, not something to fix on the
  scanner itself.

---

## Security notes

- The device's ISAPI password is stored in ESA's database so the bridge
  agent can fetch it and authenticate to the device — this is necessary
  for the agent to work, so make sure your database is only accessible
  to people you trust with admin access.
- The connection key is a bearer credential — anyone with it can pull
  your scanner's connection details from ESA's servers. Treat it like a
  password: don't commit `hikvision-agent/config.js` to git (a
  `.gitignore` is already set up to prevent this) and don't share it
  outside your organization. Regenerate it any time you suspect it
  leaked.
- No fingerprint image ever leaves the physical device — only a
  "this employeeNo matched" event crosses the network, exactly like the
  existing face-verification flow.
