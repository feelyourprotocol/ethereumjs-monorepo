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
    details: A living record of building EIP-8141 "Frame Transaction" support into EthereumJS — from first read of the spec to working code.
  - title: Implementation Journal
    details: Every question asked, every decision made, every surprise encountered along the way. Designed to help other implementers navigate the same terrain.
  - title: Design Decisions & Trade-offs
    details: Architectural choices, trade-offs, and the reasoning behind them — what we chose, what we didn't, and why.
  - title: Spec Feedback Loop
    details: Honest feedback from the implementer's perspective. Where is the spec clear? Where could it improve? How does it align with Ethereum's broader goals?
---

::: danger 🤖 Beep Boop — You Are Reading AI-Generated Documentation
These docs are **fully AI-generated** as part of an experimental human-AI collaboration workflow. A human ([@hdrewes](https://github.com/hdrewes)) steers the ship and reviews the output, but the actual prose, analysis, and structure you see here were produced by an AI assistant.

**This means:**
- These docs may contain inaccuracies, hallucinated details, or subtly wrong interpretations of the spec. Always cross-reference with the [actual EIP](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md).
- Content updates on a **quasi-daily basis** without notice as the implementation progresses. What you read today may be gone or rewritten tomorrow. Consider this the Heraclitean river of documentation — you never step into the same docs twice.
- If something seems off, it probably is. Please open an issue or reach out!

Think of this as a **live lab notebook**, not a polished reference manual. You have been warned. 🧪
:::

::: info 📌 EIP Version Reference
This documentation and implementation are based on **EIP-8141 as of commit [`ee66073`](https://github.com/ethereum/EIPs/commit/ee66073462f5c0f5db43353b5ce4183a72157327)** (March 13, 2026).

**Snapshot link:** [EIP-8141 at `ee66073`](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md)

The EIP is in **Draft** status and evolving quickly. If you're reading this and the spec has moved on, some of our analysis may be outdated. We will update as we go, but check the commit hash above against the [latest version](https://eips.ethereum.org/EIPS/eip-8141) to gauge how current things are.
:::

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
