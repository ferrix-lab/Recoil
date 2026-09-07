# Contributing to Recoil

Recoil terminates processes on other people's machines. That single fact sets the bar for changes
here: a bug in most apps is an annoyance, and a bug in this one can cost someone unsaved work or log
them out of their session.

## Before you start

Open an issue first for anything beyond a small fix. It is better to disagree about an approach in a
paragraph than after you have written it.

## Development

```bash
npm install
npm run tauri dev
```

Requires Node 18+ and a stable Rust toolchain. Tauri handles the rest.

## What CI enforces

Every pull request runs:

```bash
cargo fmt --check                     # in src-tauri/
cargo clippy --bin recoil -- -D warnings
cargo test --bin recoil
npm run build
```

Plus a TypeScript check. The project has no `tsconfig.json` — Vite strips types without checking
them — so the compiler flags live in `.github/workflows/ci.yml`. Run that same command locally
before pushing if you are touching types.

Clippy is `-D warnings` on purpose: a warning nobody has to fix is a warning nobody reads.

## Rules for anything on the kill path

`src-tauri/src/safety.rs` is the code that decides whether a signal gets sent. If you touch it:

1. **Every kill path goes through `protection_reason()`.** Do not add a route that skips it.
2. **Never trust a process name from the frontend.** Its list is up to two seconds stale, and a PID
   can be recycled in that window. Resolve the name from the OS at kill time.
3. **`SIGTERM` first.** Force kill exists, but it is a separate action the user chooses deliberately,
   never a default and never a fallback for convenience.
4. **Add a test.** `safety.rs` has tests that spawn real processes and signal them. New behaviour on
   this path needs the same.

## Telemetry rules

Recoil sends anonymous usage counts. It must never send process names, command lines, file paths,
ports, hostnames, or error messages — a developer's process list is a map of what they are building,
and command lines routinely contain credentials.

If you add an event:

- Report the *kind* of a thing, never its contents. `permission_denied`, not what failed.
- Add it to `TRACKED_EVENTS` in `src/lib/telemetry.ts`, to [`TELEMETRY.md`](TELEMETRY.md), and to
  [`PRIVACY.md`](PRIVACY.md). The Settings panel renders that list, so an undocumented event is a
  visible inconsistency to users.
- Send it through `track()`, never `trackEvent()` directly — `track()` is what honours consent.

## Commit messages

Release notes are generated from commit subjects, so write them for the person reading the release,
not for yourself at 2am. `fix: kill button stayed disabled after a failed kill` beats `fix stuff`.

## Reporting security issues

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).
