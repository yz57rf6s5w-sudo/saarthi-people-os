# Saarthi People OS

A lightweight, plug-and-play People Operations prototype for early-stage teams. Saarthi brings common people workflows into one demo workspace so founders, HR, managers and employees can explore a connected employee lifecycle without needing a full HRMS on day one.

## Try the prototype

- **Live demo:** https://yz57rf6s5w-sudo.github.io/saarthi-people-os/
- **Repository:** https://github.com/yz57rf6s5w-sudo/saarthi-people-os

Use the demo code `demo123` and select a role on the sign-in screen. Enter a display name for the session. The prototype seeds example data to help explore dashboards and workflows.

## Release status

See [current verification results, known limitations and production-readiness gates](docs/RELEASE_STATUS.md) before evaluating Saarthi for a pilot.

## What you can explore

- **Onboarding:** owners, due dates, prerequisite dependencies, blocker chains and root-blocker attribution.
- **Team directory:** search, employee detail editing and CSV export for authorised demo roles.
- **Leave and expenses:** request/review flows and status tracking.
- **Rewards and helpdesk:** culture recognition and employee support requests.
- **Career and goals:** development plans, continuous feedback and project/OKR tracking.
- **Founders' playbook:** practical guidance for common People Operations decisions.
- **Portable demo data:** browser-based state with import/export options in the prototype.

This is an evolving concept demo; workflow depth and role permissions vary by module.

## Run locally

The app is a static HTML prototype. You can open `index.html` in a browser, or serve the repository locally:

```bash
python3 -m http.server 4173
```

Then open http://127.0.0.1:4173.

## Automated browser tests

The project uses Playwright for end-to-end regression checks.

```bash
npm install
npx playwright install chromium
npm run test:e2e
```

GitHub Actions runs the browser suite when repository changes are pushed. Tests cover important workflow behaviour, including onboarding dependencies, mobile navigation and the team-directory empty state.

## Data and security — read before using

**Use synthetic demo data only. Do not enter real employee, candidate, payroll, health, identity or other confidential information.**

The current prototype is a static client-side app. Demo role selection is not real authentication, browser storage is not a secure shared database, and UI visibility is not server-enforced authorisation. Data may remain in the current browser profile until cleared. Anyone with access to that browser profile may be able to inspect or change stored demo data.

Before real organisational use, Saarthi needs a trusted backend with server-enforced authentication and role-based access control, tenant isolation, secure session handling, audit trails, encrypted transport and storage, validated inputs, backups/recovery, and a privacy/retention policy. Sensitive fields and actions must be protected by the backend, not just hidden in the interface.

## Product direction

Keep the early-stage experience simple and affordable while designing toward reliable lifecycle workflows, clear ownership, accessible/mobile-friendly screens and secure integration points. Prefer well-maintained open-source components where they reduce cost without weakening security. Treat AI insights as decision support with human review, transparent evidence and explicit uncertainty—not automated employment decisions.
