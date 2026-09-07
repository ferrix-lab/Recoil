# Recoil — Roadmap & Engineering Notes

Living document. Covers planned work, known and suspected bugs, security exposure, UI/UX
recommendations, and the non-technical work (legal, distribution, community) that the project
needs before it can grow.

**Current version:** 1.4.3 · **Platforms shipped:** macOS (universal), Linux (deb / rpm / AppImage)

**Unreleased on `main`:** every `P0`, `P1` and `P2` in this document that could be fixed in the
repository. Safety (multi-select batch kills, protected processes, `SIGTERM` escalation), the
telemetry stack (Aptabase permission, Settings panel, consent gate, `install_id`), error visibility
(panic hook, error boundary, surfaced update failures, `lsof` install hint), performance (cached
process table, polling paused when unfocused), CI (pinned SHAs, `npm ci`, clippy/fmt/tests on PRs,
audits, Dependabot, checksums, generated release notes), and the documentation set. Every shipped
build, 1.4.3 included, still has all of the problems these fix — **cutting a release is now by far
the highest-value action available.**

Severity labels used below:

| Label | Meaning |
| --- | --- |
| `P0` | Can damage a user's machine, lose their data, or expose them. Fix before any promotion. |
| `P1` | Broken or misleading behaviour that users will hit in normal use. |
| `P2` | Real problem, low blast radius, or affects a minority of users. |
| `P3` | Polish, nice-to-have, or long-horizon. |
| `RESOLVED` | Fixed on `main`. Kept in place, with what shipped, so the history stays readable. |

---

## 1. Critical safety issues

These are the ones that can actually hurt someone. Everything else in this document can wait
behind them.

- **`RESOLVED` — "ELIMINATE ALL" could force-kill critical system processes**
  The button that killed everything matching the current search is gone. Batch actions now act
  only on an explicit tick-box selection, and the confirmation dialog
  ([`ConfirmKillDialog.tsx`](src/components/ConfirmKillDialog.tsx)) names the processes rather than
  counting them. "Select all" is offered in **Ports** view only, where the list is short and every
  row is a listener the user started; System view has no bulk-select at all. Protected rows cannot
  be ticked.

- **`RESOLVED` — No protection for critical or non-killable processes**
  [`safety.rs`](src-tauri/src/safety.rs) holds a per-platform denylist (macOS / Linux / Windows) and
  refuses PID 0, PID 1, and Recoil's own PID outright. Every kill path runs through
  `protection_reason()`, and the check uses the name the OS reports *at kill time* — never one sent
  from the frontend, whose list is up to two seconds stale and may describe a recycled PID.
  `get_active_ports` and `get_all_processes` both return a `protected` flag, so protected rows render
  with a lock badge, no checkbox, and no kill button instead of failing after the click.
  Judgment call worth revisiting: `Finder`, `Dock` and `SystemUIServer` are deliberately **not** on
  the macOS list. They relaunch automatically and killing them is a legitimate, common fix, so
  protecting them would cost more in annoyance than it buys in safety.

- **`RESOLVED` — Always `SIGKILL`, never a graceful shutdown**
  Kills now send `SIGTERM`, allow a three-second grace period, and escalate to `SIGKILL` only for
  processes that ignore it. Batch kills share one grace period rather than paying it per target.
  Force kill (immediate `SIGKILL`) is a separate, separately confirmed action: a per-row button and
  a distinct control in the confirmation dialog. Signals go through `libc::kill` directly, so no
  `kill` binary is forked per target. Failures carry a real errno-derived kind — `permission_denied`,
  `not_found`, `protected` — which the UI turns into a specific message and next step instead of
  `alert("Mission Failed")`.

- **`RESOLVED` — Kill targets move under the cursor**
  System view now sorts by name (ties broken by PID) and CPU sort is opt-in behind a toggle. On top
  of that, list order freezes while the pointer is anywhere over the list, so rows cannot rearrange
  between the decision to click and the click itself. Confirmation dialogs name the target, so a
  misfire is visible before it happens.

---

## 2. Known bugs & correctness issues

- **`RESOLVED` — Frontend telemetry has never worked.** `capabilities/default.json` now requests
  `aptabase:allow-track-event`, which is one of the two permissions the plugin's ACL manifest
  actually defines (verified against `gen/schemas/acl-manifests.json`; `default_permission` is
  `null`, so the old `aptabase:default` resolved to nothing). Every call also goes through
  [`lib/telemetry.ts`](src/lib/telemetry.ts) now, which catches rejections rather than leaving them
  unhandled. Present and broken in every shipped build including v1.4.3, so this only reaches users
  when a release is cut.

- **`RESOLVED` — `lsof` failure crashes the backend.** `get_active_ports` returns
  `Result<Vec<PortInfo>, ScanError>`; a missing binary is `lsof_missing` and renders an in-app
  install hint naming the package manager command, with a retry button. A non-zero exit with no rows
  and a real stderr is `lsof_failed`. `lsof` exiting 1 because it found nothing is correctly treated
  as an empty result, not an error. The deb/rpm dependency is declared in `packaging/PKGBUILD`.

- **`RESOLVED` — Kill failures lose their reason.** `kill_process` returns a structured
  `KillFailure { pid, name, kind, message }`; `EPERM` maps to `permission_denied` and `ESRCH` to
  `not_found`, and the UI branches on `kind` to suggest what to do next.

- **`RESOLVED` — Errors dead-end in `alert()`.** Kill failures now surface as dismissible toasts
  ([`Toasts.tsx`](src/components/Toasts.tsx)) carrying the backend's reason plus a next step.
  Update and scan failures still only reach `console.error`.

- **`RESOLVED` — Update failures are invisible.** The root cause was worse than a swallowed error:
  the panel returned `null` unless an update object existed, so a failed *check* rendered nothing at
  all and the error branch was unreachable. It now renders on error too, explains whether the check
  or the install failed and what to do, and emits `update_available` / `update_started` /
  `update_installed` / `update_failed` so a platform-wide breakage is visible in analytics.

- **`DECIDED — Windows is unsupported.** Stated plainly rather than implied: the README, the site's
  download section and the platform-detection button all say so now. Port scanning would need
  `GetExtendedTcpTable` and termination `TerminateProcess`; `safety.rs` already compiles the Unix
  kill out and returns an `unsupported` failure rather than panicking, and the denylist already
  carries Windows process names, so the groundwork is there if the decision changes.
  **Still to do by hand:** delete the stale `.exe` / `.msi` artifacts from the v0.2.5 release, which
  remain downloadable and will panic on launch.

- **`RESOLVED` — The site advertised Windows downloads that 404.** Three separate places pointed at
  a `.exe` that CI never built: the download card, the hero's platform-detection button, and a
  "native support for macOS, Windows, and Linux" claim in the features section. All three are fixed.

- **`RESOLVED` — README promised a system tray that does not exist.** The tagline is now
  *"Find what's holding the port. Stop it cleanly."* — which describes what the app does today. Tray
  mode stays in §9 as a feature to build deliberately, not a claim to live up to retroactively.

- **`RESOLVED` — No `LICENSE` file.** MIT, `Copyright (c) 2026 Arpit Sarang`, matching the README.

- **`RESOLVED` — One in-flight kill disables every kill button.** `SniperButton` is now disabled
  only for the row whose PID is actually in flight.

- **`RESOLVED` — `backend_boot_success` discards its `Result`.** The error is now logged, and the
  event is skipped entirely when the user has opted out.

- **`RESOLVED` — Dead responsive CSS.** The default window is now 820×700 with a 380×480 minimum, so
  the `md:` breakpoints the layout was written against actually apply, and the narrow layout still
  works when the window is resized down.

- **`RESOLVED` — Hardcoded traffic-light padding.** `pl-[76px]` is applied only on macOS.

- **`RESOLVED` — Ambiguous empty state.** Three distinct states now: no search matches (with a clear
  button), nothing listening (framed as the good news it is, with a green check), and no processes.

- **`RESOLVED` — `clean_process_name` strips all backslashes.** It now only undoes `lsof`'s escaped
  space (`\\x20`) and leaves legitimate backslashes intact.

- **`P3` — Fragile app-name extraction.** Splitting executable paths on `".app/"` and
  `"/Applications/"` breaks for apps in `~/Applications`, nested bundles, and helper executables.

- **`P3` — Protected badge can be missed in Ports view.** When `sysinfo` cannot resolve a PID,
  `get_active_ports` falls back to the `lsof` COMMAND column, which truncates long names — so a
  protected process could render without its badge. Only cosmetic: the authoritative check runs at
  kill time against the name the OS reports, and still refuses.

- **`P3` — Port scanning is TCP-LISTEN only.** No UDP, no established connections. Reasonable scope,
  but the README's "Live Port Monitoring" oversells it.

- **`P3` — `lsof` parsing depends on column positions.** Output format drifts across distros and
  macOS releases; a change silently yields an empty or wrong list rather than an error.

---

## 3. Security

### Threats

- **`DECIDED — WON'T FIX` — macOS builds are unsigned and un-notarized.** The maintainer has decided
  against the Apple Developer Program ($99/year), so this is a permanent property of the project
  rather than a backlog item. The CI plumbing stays in place — [`release.yml`](.github/workflows/release.yml)
  passes six Apple credentials that are all empty, and `tauri-action` skips signing when they are —
  so nothing has to change if the decision is ever revisited. What matters now is being honest about
  the consequences rather than treating them as temporary:

  - **Users must bypass Gatekeeper on first launch.** macOS shows *"Recoil is damaged and can't be
    opened"*. On macOS 15 and later the old Control-click → Open shortcut is gone; the routes are
    System Settings → Privacy & Security → **Open Anyway**, or
    `xattr -dr com.apple.quarantine /Applications/Recoil.app`. This is documented for users in the
    README and on the site, with an explanation of *why* — teaching the gesture without the reason
    is what trains people into the habit that gets them compromised.
  - **This costs installs, and that cost is the price of the decision.** Some share of people who
    hit that dialog will delete the app instead of working around it. There is no mitigation for
    this other than signing.
  - **macOS permission grants break on every auto-update.** TCC bindings follow the code signature,
    so anything requiring Full Disk Access cannot be granted durably. See the Disk Recon note in §9 —
    this rules out the `~/Library` half of that feature, not just delays it.
  - **Checksums are the only integrity signal Recoil offers, and they now exist.** A `checksums`
    job in [`release.yml`](.github/workflows/release.yml) attaches a `SHA256SUMS.txt` covering every
    asset to each release. The site previously claimed *"SHA256 Verification Available on GitHub"*
    while the workflow generated none — that claim is now true, and the download page and README
    carry the verification command rather than just asserting the capability. Note what it does and
    does not do: it proves a download matches what CI built, not who built it. It is not a
    substitute for a signature.
  - **The updater is unaffected.** Update payloads are verified against the embedded Tauri signing
    key, which is independent of Apple signing, and the updater does not re-apply the quarantine
    flag — so the bypass is a one-time cost at first install, not per update.

- **`P0` (documented; one repo setting outstanding) — Updater signing key compromise is
  catastrophic.** Recoil kills arbitrary processes and auto-updates itself, so anyone holding
  `TAURI_SIGNING_PRIVATE_KEY` can ship code that runs on every installation. [`SECURITY.md`](SECURITY.md)
  now sets out custody rules, a five-step leak response, and — importantly — what rotation costs:
  existing installs trust only the public key embedded in the binary they already run, so a build
  signed with a new key is *rejected* by all of them and those users are stranded until they
  reinstall by hand. The migration has to be planned before it is needed, not during an incident.
  **Still to do, and it is a repository setting rather than a code change:** restrict who can push
  `v*` tags, since that is what triggers a signed release.

- **`RESOLVED` — Content Security Policy is disabled.** A real policy is set: `default-src 'self'`,
  `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'none'`, and `connect-src` limited to
  `'self'` plus Tauri's IPC origins. Setting it surfaced a genuine problem — `index.html` was pulling
  fonts from Google on every launch, which leaked the user's IP to a third party and broke typography
  offline. Fonts are bundled via `@fontsource` now, so the app makes **no** outbound connection
  except the update check, and `PRIVACY.md` says so accurately.

- **`RESOLVED` — Supply chain: unpinned CI.** Every action across all four workflows is pinned to a
  commit SHA with the tag in a trailing comment, and `npm install` is now `npm ci`. Dependabot keeps
  the pins current so they do not silently rot — pinning without that just trades one risk for
  another.

- **`RESOLVED` — No dependency auditing.** `.github/workflows/audit.yml` runs `npm audit
  --audit-level=high` and `cargo audit` weekly, on lockfile changes, and on demand.
  `.github/dependabot.yml` covers npm, cargo, the site, and GitHub Actions.

- **`P2` — `macOSPrivateApi: true`.** Left **as-is deliberately** — this is an aesthetic decision,
  not a defect, and it is not mine to make. Worth knowing what it costs: the app is permanently
  ineligible for the Mac App Store (already moot, since unsigned builds cannot ship there anyway) and
  the transparency may break on a future macOS release. If the window transparency ever stops
  mattering, turning this off removes a dependency on private API behaviour.

- **`RESOLVED` (standing rule, now enforced) — Process data is sensitive.** Every event reports the
  *shape* of a thing and never its contents: `kill_failed` sends a `kind` from a fixed set, the panic
  hook sends a file and line from Recoil's own source rather than the panic message, and the error
  boundary sends an error class name rather than its message. The rule is written into
  [`TELEMETRY.md`](TELEMETRY.md), [`CONTRIBUTING.md`](CONTRIBUTING.md) and the PR checklist so it
  survives contact with future contributors.

- **`RESOLVED` — Spawning a shell process per kill.** All kill paths call `libc::kill` directly;
  no `kill` binary is forked.

- **`RESOLVED` — No vulnerability disclosure path.** [`SECURITY.md`](SECURITY.md) documents private
  vulnerability reporting, response windows, and what to do if they are missed.

### Hardening checklist

- [~] ~~Obtain an Apple Developer ID; sign and notarize macOS builds~~ — **decided against.** See the
      entry above for the consequences this locks in.
- [x] Publish SHA256 checksums with each release — the only integrity signal an unsigned build has
- [x] Set a real CSP
- [x] Pin all GitHub Actions to commit SHAs
- [x] Switch `npm install` → `npm ci`
- [x] Add `cargo audit` + `npm audit` to CI
- [x] Enable Dependabot — config committed; it activates once the repo has it on the default branch
- [x] Add `SECURITY.md`
- [x] Document signing-key custody and a rotation plan
- [ ] Restrict who can push release tags — repository setting, not a code change

---

## 4. Telemetry, analytics & user contact

The goal: know how many people actually use Recoil, reach the ones who opt in, and detect errors
before users give up.

### Architecture

Keep two channels strictly separate, joined by one opaque key.

- **Channel A — anonymous, on by default.** Aptabase for usage, an error tracker for crashes.
  Answers *how many*, *on what*, *what's breaking*. Aptabase is anonymous by design and can never
  answer "who".
- **Channel B — identified, off by default.** A small backend of your own holding name, email and
  consent, captured only by explicit opt-in.
- **Join key — `install_id`.** A random UUIDv4 generated on first run and stored locally. Not derived
  from hardware, not a fingerprint. Attached to every error report.
- **Payoff.** An error arrives tagged with an `install_id`; if that install opted in, you can email
  the specific person who hit the bug once it's fixed.

### Work items

- [x] **`P0`** Fix the `aptabase:default` permission (see §2)
- [x] **`P0`** Ship a Settings panel — [`SettingsPanel.tsx`](src/components/SettingsPanel.tsx), opened
      from the footer gear. It ships **one** switch, for anonymous usage, because that is the only
      thing this build sends; a switch for crash reports or contact data that controls nothing would
      be theatre. The panel lists every event by name and says plainly that neither of the other two
      exists yet. Consent is stored by the Rust side in `settings.json`
      ([`settings.rs`](src-tauri/src/settings.rs)), not in `localStorage`, so `backend_boot_success`
      — which fires from `setup()` before the webview exists — can honour it too. Frontend events
      raised before the setting is read are queued, not sent optimistically.
- [x] **`P0`** Publish a privacy policy — [`PRIVACY.md`](PRIVACY.md), plus a live page at `/privacy`
      on the site, linked from the app's Settings panel, the site footer, and the README. No email
      address is collected by this build at all.
- [x] **`P1`** Generate and persist `install_id` — UUIDv4, minted on first launch in
      [`settings.rs`](src-tauri/src/settings.rs), stored beside the consent flag, owned by the
      backend so a frontend round-trip cannot alter it, and visible to the user in Settings.
      **Nothing sends it anywhere yet**, which is the correct state until error reporting exists.
- [x] **`P1`** Add error monitoring — a Rust panic hook reporting `file.rs:line` from Recoil's own
      source (never the panic message), a React error boundary that shows a recoverable screen
      instead of a blank window and reports only the error's class name, and command-failure
      reporting via `kill_failed` and `scan_failed`. All of it is consent-gated.
- [x] **`P1`** Add events for the whole update flow — `update_available`, `update_started`,
      `update_installed`, `update_failed` (with a `stage` of `check` or `install`).
- [x] **`P1`** Daily snapshot of GitHub download counts and repo traffic —
      `.github/workflows/download-stats.yml` appends a dated JSON line to `metrics/downloads.jsonl`
      every night and commits it. Traffic endpoints need push access and fail closed rather than
      failing the run. **It only starts collecting once merged to the default branch** — the 14-day
      traffic window means every day before that is still lost.
- [x] **`P2`** Add a `first_run` flag — persisted in `settings.json` and used to drive the first-run
      disclosure card.
- [x] **`P2`** Merge the redundant `app_started` / `backend_boot_success` pair — one `app_started`
      event, sent from Rust with a `platform` property. Sending it from the backend is what lets the
      stored opt-out be honoured before any window exists.
- [~] **`P2`** Add web analytics to the Astro site — `recoil-web/src/components/Analytics.astro` is
      wired into the layout and stays inert until `PUBLIC_APTABASE_KEY` is set in the deployment
      environment. It reuses Aptabase rather than adding a second vendor, which would mean another
      sub-processor in the privacy policy. **You need to create a web app in Aptabase and set the
      env var**; until then the funnel stays invisible.
- [~] **`P2`** Build the opt-in identity backend — [`docs/IDENTITY-BACKEND.md`](docs/IDENTITY-BACKEND.md)
      specifies the endpoints, schema, consent evidence, and the `/forget` and `/me` paths that must
      exist in the first commit rather than be retrofitted. **Not built**: it is a hosted service,
      and there is no reason to stand one up before you actually intend to email anyone.
- [ ] **`P3`** Updater-endpoint census: proxy the update check through your own worker to get a true
      active-install timeline. Note this makes that endpoint load-bearing — if it goes down, updates
      break for everyone — so it needs a pass-through fallback and uptime monitoring.

### Consent model

Three independent toggles, never bundled into one switch:

| Control | Default | Sends |
| --- | --- | --- |
| Anonymous usage | On | Feature counts, platform. No identifiers, no process data. |
| Crash reports | On | Error kind, stack trace, app version, `install_id`. No paths or arguments. |
| Contact me | **Off** | Email and name. Explicit opt-in, never pre-checked, one-click withdrawal. |

### What to monitor

**Hard failures** — Rust panics · missing `lsof` · unparseable `lsof` output · frontend render
crashes · update download failures · update signature failures (page yourself immediately; every
user on that platform is frozen).

**Expected failures worth acting on** — kill returned `EPERM` (the predictable top support case) ·
kill returned `ESRCH` (harmless once; frequent means the 2-second poll is showing stale rows) ·
scan returned zero ports (idle machine or broken scan — distinguish them) · repeated kills of the
same PID (a kill that silently isn't working).

**App health** — scan duration p50/p95 against the 2-second poll interval · Recoil's own CPU and
memory (a system monitor that is a resource hog is a bad joke — measure it and publish it if it's
good) · launch-to-first-render · session length (short is healthy for a glance-and-go tool; don't
optimise it upward).

**Growth** — daily downloads · version adoption curve · update success rate · activation rate
(share of installs completing a first successful kill) · D1/D7/D30 retention · platform mix from
active installs, never from download counts.

### Interpreting download numbers

GitHub's `download_count` records completed asset **requests**, not people. No deduplication, bots
included, retries counted. The current spread — rpm 22, deb 26, AppImage 28, dmg 28 — is suspiciously
uniform; real users don't distribute that evenly across formats, so no platform mix should be
inferred from it. The figures that resist that noise are `app.tar.gz` fetches (only pulled when the
macOS updater actually applies an update, so a real install must exist) and `latest.json` fetches
(update polls, implying total runtime). Both are floors with soft edges, since caching may hide some.

---

## 5. UI / UX recommendations

### Safety & clarity

- ~~Replace `confirm()` / `alert()` with in-app modals; list what will be killed, not just a count.~~
  Done — `ConfirmKillDialog` names every target.
- ~~Show *why* a kill failed, with an actionable next step (needs elevation / already exited).~~
  Done — failures carry an errno-derived `kind` that maps to a specific next step.
- ~~Add a toast after a kill: what was killed, and its PID.~~ Done. Note there is no undo for a
  kill — the toast is the record, not a way back.
- ~~Badge protected system processes and disable their kill control.~~ Done — lock badge, no
  checkbox, no kill button.
- ~~Distinguish "no matches for your search" from "no listening ports" — the second is good news.~~
  Done — three distinct states, with the empty-port-list one framed as success.

### Core interaction

- Reconsider the 500 ms artificial delay in `SniperButton`. It reinforces the theme but adds latency
  to the app's single most important action, on a tool whose pitch is being faster than typing a
  command.
- Add keyboard support: `⌘F` / `Ctrl+F` to focus search, arrow keys to move between rows, `Enter`
  to kill the selected row, `Esc` to clear. Still the largest interaction gap. (`Esc` does close
  every dialog already.)
- ~~Add a stable default sort.~~ Done — name order by default, CPU behind a toggle, order frozen
  while the pointer is over the list. Sortable *column headers* are still worth doing.
- Let users type a bare port number to jump straight to it.
- Add copy-to-clipboard for PID and port, and "reveal executable in Finder / file manager".
- Pin frequently killed ports (3000, 5173, 8080) to the top.

### Accessibility

- ~~Type sizes below the legibility floor.~~ The `text-[8px]` view-mode toggle labels are now
  `text-[11px]`. Some `text-[9px]`/`text-[10px]` stat labels remain and should be raised next.
- ~~Add visible focus states.~~ Every interactive control now carries a `focus-visible` ring,
  including the view toggle and footer buttons that previously had none.
- ~~Give icon-only controls accessible labels.~~ Done for the kill, force-kill, settings, source and
  dialog controls.
- ~~Respect `prefers-reduced-motion`.~~ The pulsing batch button, the spinning crosshair, the ping
  reticle and the loading pulse all carry `motion-reduce:animate-none`.
- `text-slate-600` on near-black still fails WCAG AA contrast in several places. Open.

### Chrome & layout

- Persist window size and position between launches.
- ~~Fix the `pl-[76px]` header padding per platform.~~ Done — macOS only.
- Consider a light theme, or at least verify the dark palette against `prefers-contrast`.
- Add a genuine system tray / menu bar mode — it is already promised in the README tagline and is
  the natural form factor for this tool.
- ~~Add a first-run screen: what Recoil does, what it sends, where the settings are.~~ Done —
  [`FirstRunNotice.tsx`](src/components/FirstRunNotice.tsx), shown once, covering graceful kills,
  protected processes and telemetry, with a direct route into Settings.

---

## 6. Performance

- **`RESOLVED` — `get_active_ports` rebuilds the entire process table on every call.** It now uses
  the shared `System` from app state and refreshes **only** the PIDs `lsof` actually returned,
  parsing the output first to know which those are. The rambling commented-out block that debated
  this is gone, replaced by a comment stating the conclusion.
- **`RESOLVED` — Polling continues while the window is hidden or unfocused.** Polling stops when the
  window is hidden **or** unfocused, and React Query refetches on focus, so returning to the window
  shows fresh data rather than a stale list.
- **`RESOLVED` — Batch kill spawns processes serially.** `terminate_all` signals every target up
  front and waits out a single shared grace period.
- **`P2` — Measure and publish Recoil's own footprint.** Still open, and it needs a real measurement
  on real hardware rather than a number written into a document. The polling and process-table fixes
  above should have improved it materially; worth measuring before and after on a release build.
  Recoil can measure itself — its own PID is in the System view.

---

## 7. Platform & distribution

- **`P1` (prepared, not submitted) — Package manager distribution.** `packaging/recoil.rb` is a
  ready-to-submit Homebrew cask and `packaging/PKGBUILD` an AUR `recoil-bin` package, both with the
  real dependency list (`lsof` included) and both carrying the `--no-quarantine` caveat rather than
  hiding it. Each needs a real checksum from a release and a submission from your account;
  homebrew-cask also has notability criteria. A cask does **not** require a signed app.
- **`DECIDED — Windows is unsupported for now.** The site's Windows card, the hero's Windows
  download button and the "native support for macOS, Windows, and Linux" claim are all gone, so
  nothing advertises a build that does not exist. See §2 for what implementing it would take.
  **One manual step remains:** delete the stale `.exe` / `.msi` from the v0.2.5 release.
- **`RESOLVED` — Version numbering is inconsistent.** The release workflow now fails fast if the
  pushed tag, `package.json`, `Cargo.toml` and `tauri.conf.json` disagree, so a `v0.2.5` tag can
  never ship 0.1.0 binaries again. Existing tags are history and are left alone.
- **`RESOLVED` — Release notes are boilerplate.** Notes are generated from the commit range since
  the previous tag, and every release now also carries checksum verification instructions and the
  unsigned-macOS note.
- **`P3`** Linux packaging polish: desktop entry and icon theming still open. The `lsof` dependency
  is declared in `packaging/PKGBUILD`; it still needs adding to the deb/rpm metadata in
  `tauri.conf.json`.

---

## 8. Legal, docs & community

- [x] **`P0`** Privacy policy — [`PRIVACY.md`](PRIVACY.md) and `recoil-web/src/pages/privacy.astro`,
      linked from the app, the site footer, and the README. Names both current sub-processors
      (Aptabase EU, GitHub); an error tracker and an email provider will be added to that table
      before either receives anything.
- [x] **`P0`** `LICENSE` file — MIT, `Copyright (c) 2026 Arpit Sarang`, matching the README.
      Check the name is how you want to be identified in a legal notice.
- [x] **`P1`** `TELEMETRY.md` — every event, every property, where each originates, what is never
      sent and why, plus a grep command so a reader can verify the list against the source rather
      than trusting it.
- [x] **`P1`** First-run disclosure card — shown once, covering graceful kills, protected processes
      and exactly what telemetry sends, with a button straight into Settings.
- [~] **`P1`** A support channel — issue templates route bugs and features properly, and the issue
      chooser links Discussions and private security reporting. **You must enable Discussions in
      repository settings** (one click) or that link 404s. A `support@` alias is still yours to set
      up; I deliberately did not publish a personal email address in any of these files.
- [x] **`P2`** GDPR basics — specified in [`docs/IDENTITY-BACKEND.md`](docs/IDENTITY-BACKEND.md):
      consent as the lawful basis, consent evidence recorded at confirmation, `/me` for access and
      `/forget` for erasure as hard deletes in the first commit, and a 30-day purge of unconfirmed
      records. Nothing to comply with yet — no personal data is collected — which is exactly when
      this is cheap to get right.
- [x] **`P2`** Email compliance — documented in the same file, including `List-Unsubscribe` headers
      (now required by Gmail and Yahoo for bulk senders) and keeping transactional mail separable
      from marketing.
- [x] **`P2`** `CONTRIBUTING.md` and issue/PR templates — including hard rules for anyone touching
      the kill path and the telemetry rules, so the constraints survive contact with contributors.
      The bug template asks people *not* to paste command lines, which routinely contain tokens.
- [x] **`P2`** `SECURITY.md` — disclosure path via GitHub private vulnerability reporting, key
      custody, and an honest table of the project's current security gaps
- [ ] **`P3`** Screenshots and a demo GIF in the README — still none. Needs a real capture of the
      running app, which has to come from you.

### Review requests

Never ask a user whose last session errored. Gate the prompt on all of: installed ≥ 7 days, ≥ 5
sessions with a successful kill, zero error reports in 14 days, never asked before. One ask per
person, ever — a dismissal is permanent, not a snooze. Send them to a GitHub star, Product Hunt on
launch day, or AlternativeTo listed against Activity Monitor.

---

## 9. Feature roadmap

### Near term

- Settings panel — shipped, with the telemetry switch. Polling interval and launch-at-login are
  still unbuilt.
- System tray / menu bar mode — the natural form factor for this tool, and no longer claimed in the
  README until it exists.
- Keyboard navigation — now the largest remaining interaction gap.

### Mid term

- **Disk Recon** — the natural second axis after ports, CPU and memory. Scope it as a curated
  *developer junk* catalog rather than a general disk visualizer: duplicate IDE extension versions
  (VS Code / Cursor / Antigravity / Windsurf all share the layout), `node_modules` by age, Rust
  `target/`, Xcode `DerivedData` and stale simulator runtimes, `Docker.raw`, and package caches
  (npm, pnpm, pip, Homebrew, Gradle, Maven). Generic treemaps are a solved, crowded space —
  DaisyDisk, GrandPerspective, `ncdu` — and competing there is a losing move. The differentiator is
  dev-specific heuristics plus something no disk cleaner can do: Recoil already knows what is
  *running*, so it can say *"Antigravity is open — quit it before cleaning its extensions."*
  Constraints: move to Trash rather than unlinking (a killed process restarts; a deleted folder does
  not); use `st_blocks` with inode deduplication, since naive recursive sums wildly overcount on
  APFS with clones and hardlinks; walk natively in Rust with progress events rather than blocking on
  a `du` shell-out. **Scope consequence of shipping unsigned:** scanning `~/Library` needs Full Disk
  Access, and TCC grants are bound to the code signature, so an unsigned build loses the grant on
  every auto-update. That makes the `~/Library` half of this feature impractical rather than merely
  deferred. Build the extension and cache scanning that needs no special permission, and treat
  anything behind Full Disk Access as out of scope while the project stays unsigned.
- Docker container port mapping
- Port history — what was killed, and when
- Process detail view: full command line, open files, parent process, uptime
- Elevation flow for root-owned processes

### Long term

- Watch rules ("always warn me when something takes port 5432")
- Remote host monitoring over SSH
- A CLI companion sharing the Rust core
- Public `/stats` page — open metrics are a strong trust signal for an open-source tool, and good
  marketing

---

## 10. Engineering hygiene

- **Tests cover the kill path and settings only.** [`safety.rs`](src-tauri/src/safety.rs) has nine
  tests over the protection guards and the real SIGTERM/SIGKILL escalation;
  [`settings.rs`](src-tauri/src/settings.rs) has three over consent defaults and persistence.
  Still untested and next in line: `lsof` output parsing (fixture-driven, covering multiple distros
  and macOS versions), `clean_process_name`, and app-name extraction. The parsing is now a separate
  loop from the name resolution, which makes it far easier to test than it was.
- ~~**No CI beyond release.**~~ `.github/workflows/ci.yml` runs `cargo fmt --check`, `cargo clippy
  -D warnings`, `cargo test`, a TypeScript check and the frontend build on every PR and push to
  `main`. Clippy found two real issues on the first run (`Iterator::last` on a `DoubleEndedIterator`)
  which are fixed.
- ~~**Dead code.**~~ `src-tauri/src/lib.rs` is deleted, along with the `[lib]` target in `Cargo.toml`
  that existed only for the Tauri mobile template. Recoil is desktop-only and the library carried
  nothing but the template's `greet` command.
- ~~**Compiler warnings.**~~ The build is warning-clean, and CI now fails on any new clippy warning,
  so it stays that way.
- ~~**Committed artifacts.**~~ Checked: `build_error.log` and `dist/` are present locally but are
  untracked and already covered by `.gitignore` (`*.log`, `dist`). Nothing to fix — they are just
  stale local files, safe to delete.
- ~~**Large commented-out reasoning block** inside `get_active_ports`.~~ Gone, replaced by the
  implementation it was arguing about and a comment stating the conclusion.

---

## 11. Suggested order of work

The sequencing matters: things that protect users ship before things that collect from them, and
visibility into breakage comes before inviting people to report it.

**Milestone 1 — Stop the bleeding** — ✅ **complete**
Batch-kill safety · protected-process guards · `SIGTERM` escalation · errno on kill failures ·
`lsof` panic fix · `LICENSE`.

**Milestone 2 — Cover yourself** — ✅ **complete**
Privacy policy · Settings panel with a working opt-out · `TELEMETRY.md` · first-run disclosure ·
Aptabase permission fix.

**Milestone 3 — See what's happening** — **complete in code**
Error monitoring (panic hook, error boundary, command failures) · update-flow events · daily
download snapshot. Web analytics is wired but needs `PUBLIC_APTABASE_KEY` set on the host.

**⚠️ The gate in front of all of it: cut a release.** Every fix above lives only on `main`. Users
are still running 1.4.3, which has the batch-kill hazard, unprotected `kill -9`, broken telemetry,
no opt-out and no licence. Nothing in Milestones 1–3 has reached a single user yet.

**Milestone 4 — Be trustworthy to install**
Signing is off the table by decision, so this milestone is now:
~~publish SHA256 checksums~~ *(done)* · ~~honest Gatekeeper guidance on the download page and in the
README~~ *(done)* · CI hardening (pinned actions, `npm ci`, audits) · Homebrew cask, which needs
`--no-quarantine` for an unsigned app.

**Milestone 5 — Know and reach your users**
`install_id` is done. The identity backend, in-app feedback, crash-report contact capture and email
infrastructure are specified in [`docs/IDENTITY-BACKEND.md`](docs/IDENTITY-BACKEND.md) but
deliberately unbuilt — there is no reason to hold personal data before you intend to use it.

**Milestone 6 — Grow the product**
Tray mode · keyboard navigation · Disk Recon (extension and cache scanning only — see §9 for why
`~/Library` is out while unsigned) · the public stats page.

---

## 12. What still needs you

Everything left is blocked on an account, a device, or a decision that is not mine:

| Item | Why it needs you |
| --- | --- |
| **Cut a release** | Every fix in this document is unreleased. This is the highest-value action available. |
| Restrict who can push `v*` tags | Repository setting. A tag push ships signed code to every install. |
| Enable GitHub Discussions | One click; the issue chooser links it and will 404 until then. |
| Delete v0.2.5 `.exe` / `.msi` | Still downloadable, still panics on launch. |
| Set `PUBLIC_APTABASE_KEY` | Site analytics stay inert without it. |
| Submit the Homebrew cask / AUR package | Needs your accounts and a real release checksum. |
| Measure Recoil's own footprint | Needs a release build on real hardware. |
| Screenshots and a demo GIF | Needs a capture of the running app. |
| A `support@` alias | I deliberately published no personal email address anywhere. |
