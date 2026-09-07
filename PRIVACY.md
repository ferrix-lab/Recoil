# Privacy Policy

**Last updated:** 30 August 2026 · **Applies to:** the Recoil desktop application

Recoil is a system utility that lists the processes on your machine and lets you stop them. It
therefore sees some of the most sensitive material on a developer's computer: the names of what you
are running, the command lines you ran them with, and the ports they listen on. **None of that ever
leaves your machine.**

This policy describes everything Recoil sends over the network. If you find a discrepancy between
this document and the code, the discrepancy is a bug — please report it.

## What Recoil collects

One category, and you can switch it off.

### Anonymous usage analytics — on by default, switchable in Settings

| Sent | Example |
| --- | --- |
| Event name | `single_kill_executed` |
| Event properties | `mode: "ports"`, `signal: "SIGTERM"`, `escalated: 0`, `kind: "permission_denied"` |
| Platform | `MacIntel` |
| App version, OS version, locale, device model | collected automatically by Aptabase |

The complete list of events this build can send:

| Event | When | Properties |
| --- | --- | --- |
| `app_started` | The backend finished starting | `platform` |
| `app_panicked` | A Rust panic occurred | `location` — a file and line in Recoil's own source, never the panic message |
| `view_changed` | You switched between Ports and System | `mode` |
| `single_kill_executed` | A one-click kill succeeded | `mode`, `signal`, `escalated` |
| `batch_kill_executed` | A confirmed multi-target kill finished | `count`, `killed`, `failed`, `forced`, `mode` |
| `kill_failed` | A kill was refused or failed | `mode`, `kind` |
| `scan_failed` | A port scan could not complete | `kind` |
| `update_available` / `update_started` / `update_installed` / `update_failed` | The update flow | `version` or `stage` |
| `ui_crashed` | The interface hit a render error | `error_name` |

[`TELEMETRY.md`](TELEMETRY.md) documents each of these in full, including how to verify the list
against the source.

Note what is *not* in that table: no process names, no PIDs, no ports, no application names, no
command lines, no file paths, no hostnames, no usernames. `kill_failed` reports the *kind* of
failure (`permission_denied`, `not_found`, `protected`) and never what was being killed.

Analytics are handled by **Aptabase**, which is anonymous by design: there is no account, no user
identifier, no cookie, and no device fingerprint, so events cannot be linked to you or to each
other across sessions. Recoil uses Aptabase's **EU** instance.

### Install ID

A random UUIDv4 is generated on first launch and stored locally alongside your consent setting. It
is not derived from hardware and is not a fingerprint — it identifies an installation, not a person.
**Nothing currently sends it anywhere**; it exists so that future error reports could be tied to a
fix. You can view it in Settings.

### What Recoil does not collect

- **No personal data.** Recoil has no accounts, no sign-in, no email collection, and no contact
  form. It does not know who you are.
- **No crash reports.** This build has no crash or error reporting of any kind.
- **No process data.** Ever. See the table above.
- **No advertising, no profiling, no data sales.** There is nothing to sell and no one to sell it to.

## Network connections Recoil makes

| Destination | Purpose | Sends |
| --- | --- | --- |
| Aptabase (EU) | Anonymous usage analytics | The events above. Skipped entirely when analytics are off. |
| `github.com` | Update checks and downloads | A standard HTTPS request. GitHub receives your IP address and user agent, as with any web request. |

Recoil makes no other outbound connections. Fonts are bundled into the application rather than
fetched from a CDN, so no third party sees a request simply because you opened the app, and the
interface renders correctly offline.

## Turning analytics off

Open **Settings** (the gear in the footer) and switch off *Anonymous usage analytics*. It takes
effect immediately and persists across launches, including for the event sent when the backend
starts. The choice is stored locally in `settings.json` in Recoil's config directory:

- macOS — `~/Library/Application Support/com.arpitsarang.recoil/settings.json`
- Linux — `~/.config/com.arpitsarang.recoil/settings.json`

Deleting that file restores the default (analytics on).

## Sub-processors

| Provider | Role | Location |
| --- | --- | --- |
| [Aptabase](https://aptabase.com) | Anonymous product analytics | EU |
| [GitHub](https://github.com) | Release hosting, update distribution, source hosting | US |

If a sub-processor is ever added — a crash reporter or an email provider, for instance — it will
appear in this table before it starts receiving anything, and anything identifying will be opt-in
and off by default.

## Your rights

Because analytics are anonymous, there is no record tied to you: no account to access, no profile to
export, and nothing to delete on request — the data simply cannot be traced back to an individual.
If that ever changes, this policy will describe the access and erasure paths before the collection
starts.

## Children

Recoil is a developer tool and is not directed at children under 13.

## Changes

Material changes will be noted in the release notes for the version that introduces them, and the
date at the top of this document will change. Analytics defaults will not be widened silently.

## Contact

Please open an issue at [github.com/CodeMaverick-143/Recoil/issues](https://github.com/CodeMaverick-143/Recoil/issues),
or use [private vulnerability reporting](https://github.com/CodeMaverick-143/Recoil/security/advisories/new)
for anything sensitive.
