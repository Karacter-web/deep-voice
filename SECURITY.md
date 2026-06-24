# Security Policy

## Supported Versions

Deep Call Prank is pre-1.0 software. Only the `main` branch receives security
fixes. Forks and pinned versions are the maintainer's responsibility.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security problems.**

Email the maintainers at `security@deepcallprank.invalid` (or open a private
GitHub Security Advisory on the repository). Include:

- A description of the issue and the impact you believe it has.
- Steps to reproduce — ideally a minimal proof-of-concept.
- Affected commit / deployment URL.
- Whether the issue is already public anywhere.

You should get an acknowledgement within **72 hours**. We aim to ship a fix or
a documented mitigation within **14 days** for high-severity issues. We will
credit reporters in the release notes unless asked otherwise.

## Scope

In scope:

- Authentication & session handling (`/auth`, OAuth callbacks, `onAuthStateChange`).
- Row Level Security policies on every public table.
- Storage bucket access (`voice-samples`, `avatars`) and signed-URL handling.
- Server functions (`createServerFn`) and public API routes
  (`src/routes/api/public/*`), especially webhook signature checks.
- Service-role key handling (`SUPABASE_SERVICE_ROLE_KEY` must never reach
  the client bundle).
- Exposure of self-hosted backends (`WHISPER_ENDPOINT`, `RVC_ENDPOINT`).

Out of scope:

- Findings that require physical access, a rooted device, or social engineering.
- Rate-limit gaps on unauthenticated public marketing routes.
- Issues in third-party services (Supabase, Cloudflare, your own
  whisper/RVC deployment) — report those upstream.
- Anything that depends on the user pasting their own credentials into a
  malicious page.

## Hardening Expectations for Self-Hosters

If you self-host this app you are responsible for:

- Setting strong, unique values for every secret in your `.env` / Lovable
  secret manager (`SUPABASE_SERVICE_ROLE_KEY`, `WHISPER_ENDPOINT`,
  `RVC_ENDPOINT`, any HMAC bridge secret).
- Enabling Supabase **Leaked Password Protection** and keeping Postgres on
  the latest patch (see `TODO.md` Phase 10).
- Enabling MFA for every Supabase project admin.
- Putting self-hosted Whisper/RVC behind authentication — never expose the
  raw inference port to the public internet.
- Reviewing the ethics / consent guidance in `README.md` before enabling
  the call bridge for end users.

## Disclosure Policy

We follow coordinated disclosure. We will:

1. Confirm the report and assign a severity.
2. Develop and test a fix in a private branch.
3. Notify known deployments where feasible.
4. Publish a GitHub Security Advisory with the fix and credit.

Please give us a reasonable window (typically 90 days, shorter for
actively-exploited issues) before public disclosure.
