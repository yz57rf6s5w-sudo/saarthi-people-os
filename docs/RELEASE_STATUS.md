# Saarthi release status

**Last verified:** 29 October 2026  
**Current channel:** public prototype / synthetic demo data only

## Live links

- [Open the live prototype](https://yz57rf6s5w-sudo.github.io/saarthi-people-os/)
- [Source repository](https://github.com/yz57rf6s5w-sudo/saarthi-people-os)
- [Browser regression workflow](https://github.com/yz57rf6s5w-sudo/saarthi-people-os/actions/workflows/browser-tests.yml)

## Latest verification

- Browser regression workflow run [#315](https://github.com/yz57rf6s5w-sudo/saarthi-people-os/actions/runs/40886151351): **passed** after fixes for manager leave-impact date persistence and the founder people-budget decision owner test.
- GitHub Pages deployment workflow for the same commit: **passed**.
- The previous failed run remains in history for traceability: [run #313](https://github.com/yz57rf6s5w-sudo/saarthi-people-os/actions/runs/40872020995).

A green browser suite is evidence for the journeys covered by tests; it is not a security certification or proof that every workflow is production-ready.

## What this prototype is for

Explore the Saarthi concept across Founder, People Ops, Manager, Employee and Candidate roles, using seeded synthetic data. The experience is intended to test the product narrative and workflow usability with early-stage startup teams.

## Important limitations

- Demo role selection and the shared demo code are **not real authentication**.
- Browser storage is not a secure, server-backed source of truth and does not provide tenant isolation.
- UI-level visibility is not server-enforced authorisation.
- Do not enter real employee, candidate, payroll, identity, health or other confidential information.
- AI concepts in the prototype must be treated as decision support, not autonomous employment decisions.

## Release gates before real customer data

- [ ] Server-enforced authentication, session handling and role/permission checks.
- [ ] Tenant-scoped database access with automated cross-tenant isolation tests.
- [ ] Server-side validation for every consequential write and approval.
- [ ] Audit events, backups and a tested recovery process.
- [ ] Privacy notice, retention/deletion rules and incident response ownership.
- [ ] Country-specific legal and payroll review for each launch market.
- [ ] Security review and end-to-end tests for the exact production deployment.

## Near-term product focus

1. Keep the existing prototype stable and make role-specific journeys dependable.
2. Validate the highest-value initial workflows with design partners before expanding breadth.
3. Demonstrate the AI Workforce proposition with clear permissions, evidence, human approval and measurable outcomes.
4. Keep production-impacting authentication, data and AI actions behind reviewable changes and explicit human approval.
