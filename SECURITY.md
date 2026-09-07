# Security Policy

Recoil terminates processes on the user's machine and updates itself automatically. Both make it a
higher-value target than its size suggests, and this document is written accordingly.

## Reporting a vulnerability

Use **[private vulnerability reporting](https://github.com/CodeMaverick-143/Recoil/security/advisories/new)**
on this repository. It is private until an advisory is published, so a report cannot leak the issue.

Please do not open a public issue for a security problem.

**What to expect:** acknowledgement within 5 working days, an assessment within 10, and a fix
released before public disclosure wherever practical. Recoil is maintained by one person — if a
report goes unanswered past those windows, escalate by opening a public issue that says only that
you sent a private report and had no reply, with no detail about the vulnerability itself.

## Supported versions

Only the latest release receives fixes. There are no long-term support branches. Users on older
versions should update through the in-app updater.

## Signing key custody

Two independent sets of secrets matter, and losing either has a different consequence.

### Updater signing key (`TAURI_SIGNING_PRIVATE_KEY`)

This is the critical one. Every installation trusts the matching public key, which is **compiled
into the binary**. Anyone holding the private key can publish an update that runs arbitrary code on
every machine running Recoil.

**Custody rules**

- The private key and its password live in GitHub Actions repository secrets and in the maintainer's
  password manager. Nowhere else — not in the repo, not in a shell history, not in a note.
- Never echoed in CI logs, and never passed to a workflow triggered by a fork or a pull request.
- Only tag pushes matching `v*` trigger a release, and only maintainers may push tags. Keep the
  branch protection and tag rules that enforce this in place.
- Rotate on any suspicion of exposure, and on maintainer turnover.

**If the key leaks**

1. Treat every subsequent release as untrusted until proven otherwise. Check the release history for
   assets nobody intentionally published.
2. Revoke the CI secret immediately so no further signed builds can be produced.
3. Generate a new keypair (`npm run tauri signer generate`) and ship a release signed with it.
4. **Understand what rotation costs before you need it:** existing installations only trust the
   public key embedded in the binary they already run. A build signed with a new key will be
   *rejected* by every one of them, and those users are stranded on the old version until they
   download and install a fresh copy by hand. Plan the migration — a release signed with the old key
   that carries the new public key, followed by the switch — rather than rotating cold.
5. Publish an advisory saying which versions are affected and how to verify what is installed.

### Apple signing credentials — none exist

Recoil is not enrolled in the Apple Developer Program and macOS builds are unsigned by decision. The
workflow references six `APPLE_*` secrets, but all are empty and signing is skipped. There is
consequently no Developer ID certificate to leak or revoke.

The trade-off this locks in is described in [`docs/RELEASING.md`](docs/RELEASING.md): users must
bypass Gatekeeper on first launch, and macOS permission grants do not survive auto-updates. If the
decision is ever revisited, a leaked Developer ID certificate would let an attacker sign malware
that macOS attributes to this project — revoke it in the Apple Developer portal immediately, then
re-issue and re-sign.

## Known security posture

Stated plainly, because users deserve to know what they are installing.

| Area | Status |
| --- | --- |
| macOS code signing and notarization | **Not planned.** Builds are unsigned by decision; Gatekeeper will warn on first launch and users must bypass it deliberately. See [`docs/RELEASING.md`](docs/RELEASING.md). |
| Release integrity | Every release carries a `SHA256SUMS.txt` generated in CI. Because macOS builds are unsigned, this is the strongest integrity check offered — it proves a download matches what CI built, not who built it. |
| Updater signature verification | In place. Updates are rejected unless signed by the embedded key. |
| Protected-process guards | In place. Critical system processes and Recoil's own PID cannot be signalled. |
| Content Security Policy | Not yet set (`"csp": null`). React escapes rendered system strings, so this is defence-in-depth. |
| Dependency auditing | Not yet automated. `cargo audit` and `npm audit` are not in CI. |
| CI supply chain | Actions are pinned to floating tags rather than commit SHAs. |

The gaps above are tracked in [`ROADMAP.md`](ROADMAP.md) §3 and are not hidden.

## Scope

In scope: privilege escalation, arbitrary code execution, update-channel attacks, bypassing the
protected-process guards, and anything that causes Recoil to send process data off the machine
(see [`PRIVACY.md`](PRIVACY.md)).

Out of scope: the fact that Recoil terminates processes when asked — that is the product.
