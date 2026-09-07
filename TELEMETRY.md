# Telemetry

Every event Recoil can send, verbatim, with every property. If you find something in the code
that is not in this file, that is a bug — please report it.

**Switch it off:** Settings (the gear in the app footer) → *Anonymous usage analytics*. The choice
persists across launches and is honoured by the Rust side before any window opens, so it also
suppresses the session event. See [`PRIVACY.md`](PRIVACY.md) for the policy this sits under.

## Where events come from

Two origins, because consent has to be enforceable before the webview exists:

- **Rust** (`src-tauri/src/main.rs`) — sent from `setup()`, before any window is created. These read
  the persisted setting directly.
- **Webview** (`src/lib/telemetry.ts`) — every call goes through `track()`, which holds events in a
  queue until the persisted setting has been read, then either sends or discards them. Nothing is
  sent optimistically.

## Events

| Event | Origin | When | Properties |
| --- | --- | --- | --- |
| `app_started` | Rust | The backend finished starting | `platform` — `macos`, `linux`, or `windows` |
| `app_panicked` | Rust | A Rust panic reached the panic hook | `location` — `file.rs:line` **in Recoil's own source**. Never the panic message. |
| `view_changed` | Webview | Switched between Ports and System | `mode` — `ports` or `all` |
| `single_kill_executed` | Webview | A one-click row kill succeeded | `mode`; `signal` — `SIGTERM` or `SIGKILL`; `escalated` — `1` if SIGTERM was ignored, else `0` |
| `batch_kill_executed` | Webview | A confirmed multi-target kill finished | `count` targets attempted; `killed`; `failed`; `forced` — `1` if force-killed; `mode` |
| `kill_failed` | Webview | A kill was refused or failed | `mode`; `kind` — `permission_denied`, `not_found`, `protected`, `unsupported`, or `unknown` |
| `scan_failed` | Webview | A port scan could not complete | `kind` — `lsof_missing` or `lsof_failed` |
| `update_available` | Webview | The updater found a newer version | `version` — the *new* version string |
| `update_started` | Webview | The user began a download | none |
| `update_installed` | Webview | Download and install completed | none |
| `update_failed` | Webview | Update check or install failed | `stage` — `check` or `install` |
| `ui_crashed` | Webview | A React render crash hit the error boundary | `error_name` — the error's class name only, never its message |

Aptabase additionally attaches app version, OS version, device model and locale to every event.
That is the SDK's standard payload and is documented on their side.

## What is never sent

No process names. No PIDs. No ports. No application names. No command lines. No file paths. No
hostnames. No usernames. No panic or error messages.

This is not incidental. A developer's process list is a map of what they are building, and command
lines routinely contain tokens and credentials. Failures therefore report their *kind* — a stable
tag from a fixed set — and never their contents. `kill_failed` says `permission_denied`; it does not
say what you tried to kill.

## Install ID

A random UUIDv4 is generated on first launch and stored in `settings.json` next to the consent
setting. It is **not** derived from hardware and is not a fingerprint: it identifies an
installation, not a person, and a fresh install produces a new one.

**Nothing currently sends it anywhere.** It exists so that if error reporting is added later, a
report can be tied to a fix. You can see yours in Settings. Adding a sender for it would be a
material change and would appear in the release notes and in `PRIVACY.md` first.

## Verifying this document

```bash
# Every event name in the codebase
grep -rn 'track(\|track_event(' src src-tauri/src
```

The webview's list is also enumerated in `TRACKED_EVENTS` in `src/lib/telemetry.ts`, which is what
the Settings panel renders — so the app itself shows the same list this file does.
