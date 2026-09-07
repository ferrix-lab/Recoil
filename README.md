# Recoil

> ***Find what's holding the port. Stop it cleanly.***

Recoil is a modern, tactical-themed system utility built with **Tauri v2** and **React**. It allows you to instantly identify and terminate processes occupying specific network ports on your machine. With a sleek, dark-mode UI, it provides real-time visibility into your system's network activity and resource usage.

## Features

- **Live Port Monitoring**: Scans and lists active TCP listeners (LISTEN state only — no UDP, no established connections).
- **Graceful Termination**: Sends `SIGTERM` and allows three seconds to shut down cleanly, escalating to `SIGKILL` only for processes that ignore it. Force kill is a separate, deliberate action.
- **Protected Processes**: Refuses to signal anything your session depends on — `WindowServer`, `launchd`, `systemd`, PID 1, and Recoil's own process. Those rows are marked and disabled rather than failing after the click.
- **Explicit Multi-Select**: Batch kills act only on rows you tick, and the confirmation names every process rather than counting them.
- **Smart Search**: Filter by Process ID (PID), name (e.g. `node`, `python`), or port number.
- **System Telemetry**: Real-time CPU and memory usage.
- **Platforms**: macOS and Linux. **Windows is not supported** — port scanning and process control are Unix-only today.

## Tech Stack

- **Frontend**:
  - React 19 (Vite)
  - TailwindCSS v4
  - Lucide React (Icons)
  - TanStack Query (Data Fetching)
- **Backend**:
  - Rust (Tauri v2)
  - `sysinfo` (System telemetry)
  - `lsof` (Port scanning)
  - `libc` (Signal delivery — no `kill` binary is forked per target)

## Verifying a download

Every release ships a `SHA256SUMS.txt` alongside the binaries. Download it into the same directory as
the file you fetched, then:

```bash
# macOS
shasum -a 256 -c SHA256SUMS.txt --ignore-missing

# Linux
sha256sum -c SHA256SUMS.txt --ignore-missing
```

`--ignore-missing` checks only the files you actually downloaded instead of failing on the rest.

This matters more for Recoil than for most projects: macOS builds are unsigned (see below), so there
is no Apple signature to fall back on. The checksum confirms the file matches what CI built — it is
not a signature, so it proves integrity rather than authorship.

## Installing on macOS

Recoil is **not signed with an Apple Developer certificate**, and there are no plans to change that.
macOS therefore quarantines it on first launch and will usually say the app is *"damaged and can't be
opened"*. It is not damaged — that is the message macOS shows for an app it cannot verify.

Two ways past it, after moving `Recoil.app` to `/Applications`:

- **System Settings → Privacy & Security → Open Anyway.** The Control-click → Open shortcut was
  removed in macOS 15, so this is the route on current systems.
- **Terminal:**
  ```bash
  xattr -dr com.apple.quarantine /Applications/Recoil.app
  ```
  This removes only the quarantine flag. Prefer it over `xattr -cr`, which strips every extended
  attribute on the bundle.

You should understand what you are doing here rather than pasting it on trust: you are telling macOS
to run software whose author it cannot verify. That is a reasonable choice for a tool whose source
you can read in this repository, and an unreasonable habit to apply to arbitrary downloads. Updates
after the first launch are verified against Recoil's own signing key and do not require this again.

## Prerequisites

Before running Recoil, ensure you have the following installed:

- **Node.js**: (v18 or newer recommended)
- **Rust**: (Latest stable)
- **Wait**... that's it! Tauri handles the rest.

## Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/recoil.git
    cd recoil
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    ```

3.  **Run the application in development mode:**
    ```bash
    npm run tauri dev
    ```
    This command will start the Vite dev server and launch the Tauri application window.

## Building for Production

To create an optimized application bundle:

```bash
npm run tauri build
```

The output binary/DMG will be available in `src-tauri/target/release/bundle/`.

## Troubleshooting

- **Permissions**: Recoil uses `lsof` to find open ports and sends signals directly via `libc::kill`. This works for processes you own. Processes owned by another user report a `permission_denied` failure with an explanation — stop those from a terminal with `sudo` rather than running the GUI as root. Critical system processes are protected and cannot be signalled at all.
- **"Trait Bound" Errors**: If you encounter compilation errors related to `Serialize`, ensure your `src-tauri/src/main.rs` includes `use serde::Serialize;`.

## Privacy & Telemetry

Recoil sends **anonymous usage counts** (which features get used, plus platform and app version) to
Aptabase's EU instance, and nothing else. It never sends process names, command lines, file paths,
ports, or hostnames — your process list is a map of what you are building, and command lines
routinely contain secrets.

Switch it off in **Settings** (the gear in the app footer); the choice persists across launches and
also suppresses the event sent when the backend starts. The full event list and everything Recoil
does *not* collect are in [PRIVACY.md](PRIVACY.md).

## Security

Report vulnerabilities through
[private vulnerability reporting](https://github.com/CodeMaverick-143/Recoil/security/advisories/new).
[SECURITY.md](SECURITY.md) covers the disclosure process, signing-key custody, and — stated plainly —
the security gaps this project still has, including that macOS builds are not yet signed or
notarized.

## License

[MIT License](LICENSE)
