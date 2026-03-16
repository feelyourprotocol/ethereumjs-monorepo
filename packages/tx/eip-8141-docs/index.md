---
layout: home

hero:
  name: EIP-8141
  text: Frame Transaction
  tagline: Reference implementation documentation — from the EthereumJS team, powered by Feel Your Protocol.
  actions:
    - theme: brand
      text: Spec Overview
      link: /spec-overview/
    - theme: alt
      text: Implementation Journal
      link: /implementation-journal/
    - theme: alt
      text: Spec Feedback
      link: /spec-feedback/

features:
  - title: Reference Implementation
    details: A living record of building EIP-8141 "Frame Transaction" support into the EthereumJS tx library — from first read of the spec to working code.
  - title: Implementation Journal
    details: Every question asked, every decision made, every surprise encountered along the way. Designed to help other implementers navigate the same terrain.
  - title: Design Decisions & Trade-offs
    details: Architectural choices, trade-offs, and the reasoning behind them — what we chose, what we didn't, and why.
  - title: Spec Feedback Loop
    details: Honest feedback from the implementer's perspective. Where is the spec clear? Where could it improve? How does it align with Ethereum's broader goals?
---

## What is this?

This documentation accompanies the **EIP-8141 "Frame Transaction" reference implementation** in the [EthereumJS](https://github.com/ethereumjs/ethereumjs-monorepo) monorepo, built as a [Feel Your Protocol](https://feelyourprotocol.org) project.

EIP-8141 introduces a fundamentally new transaction type for Ethereum — one where validation, execution, and gas payment are no longer hard-wired to a single ECDSA signature but can be defined abstractly through EVM code. This is a big deal: it realizes the original vision of account abstraction and opens a native path toward post-quantum security.

### Why document the implementation process?

The EIP is in an **early draft stage**. The spec is extensive, introduces several new concepts (frames, approval scopes, new opcodes, default code for EOAs), and touches multiple layers of the protocol stack. Building a reference implementation at this stage is not just about writing code — it is about **stress-testing the spec itself**.

This documentation serves multiple audiences:

- **Other client implementers** — a practical guide through the implementation terrain, highlighting pitfalls, ambiguities, and non-obvious implications.
- **Spec authors** — detailed, constructive feedback on where the specification is clear, where it could be improved, and where open questions remain.
- **The broader community** — contract developers, wallet providers, infrastructure builders, and anyone interested in the future of Ethereum transactions — a window into what EIP-8141 means in practice.

### How to read these docs

| Section | What you'll find |
|---|---|
| [**Spec Overview**](/spec-overview/) | A structured walkthrough of EIP-8141, broken into digestible pieces — transaction structure, frame modes, new opcodes, execution flow, gas model. |
| [**Implementation Journal**](/implementation-journal/) | Chronological notes from the implementation effort — what we worked on, what questions came up, what we learned. |
| [**Design Decisions**](/design-decisions/) | The architectural and design choices we made, with rationale and discussion of alternatives. |
| [**Spec Feedback**](/spec-feedback/) | Our assessment of the spec's clarity, completeness, protocol alignment, and strategic fit within the Ethereum roadmap. |

::: tip Living Document
These docs are updated continuously as the implementation progresses. Check back for new journal entries, updated feedback, and refined analysis.
:::
