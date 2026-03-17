# Doc Updates

This page tracks what changed in the documentation with each update. Newest entries first. Check back regularly — the docs evolve alongside the implementation, often on a daily basis.

---

## March 17, 2026

**Initial public release** — the documentation goes live at [eip-8141-docs.feelyourprotocol.org](https://eip-8141-docs.feelyourprotocol.org).

### What's in this first release:

- **[Spec Overview](/spec-overview/)** — full structured walkthrough of EIP-8141 covering transaction structure, frame modes, all four new opcodes, execution behavior, gas accounting, and EOA default code
- **[Spec Chronology](/spec-overview/chronology)** — detailed history of how the spec evolved from initial publication (Jan 29) through the APPROVE relaxation, EOA support addition, approval bits, and community debates — with commit links and forum references
- **[Implementation Journal](/implementation-journal/)** — first entries covering initial impressions, scoping, and planned approach for transaction parsing and EVM integration
- **[Design Decisions](/design-decisions/)** — framework for documenting architecture choices and trade-offs as the implementation progresses
- **[Spec Feedback](/spec-feedback/)** — initial assessment covering clarity/completeness issues, protocol alignment analysis (EIP-2718, 1559, 4844, 7702, 2929, 1153), and strategic fit evaluation (PQ security, AA, UX, decentralization)
- **[About](/about)** — project context, audience guide, EIP version reference, and the AI experiment disclaimer

### Coming next:

- First actual implementation code in `@ethereumjs/tx` — new transaction type class
- Updated journal entries with real implementation experiences
- Refinements to spec feedback based on hands-on findings
