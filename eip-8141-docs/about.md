# About This Project

## What is this?

This documentation accompanies the **EIP-8141 "Frame Transaction" reference implementation** in the [EthereumJS](https://github.com/ethereumjs/ethereumjs-monorepo) monorepo, built as a [Feel Your Protocol](https://feelyourprotocol.org) project. The implementation itself lives in an open PR — you can follow along, review the code, and comment:

**[Implementation PR: EIP-8141 Frame Transactions](https://github.com/feelyourprotocol/ethereumjs-monorepo/pull/1)**

EIP-8141 introduces a fundamentally new transaction type for Ethereum — one where validation, execution, and gas payment are no longer hard-wired to a single ECDSA signature but can be defined abstractly through EVM code. This is a big deal: it realizes the original vision of account abstraction and opens a native path toward post-quantum security.

## Why document the implementation process?

The EIP is in an **early draft stage**. The spec is extensive, introduces several new concepts (frames, approval scopes, new opcodes, default code for EOAs), and touches multiple layers of the protocol stack. Building a reference implementation at this stage is not just about writing code — it is about **stress-testing the spec itself**.

This documentation serves multiple audiences:

- **Other client implementers** — a practical guide through the implementation terrain, highlighting pitfalls, ambiguities, and non-obvious implications.
- **Spec authors** — detailed, constructive feedback on where the specification is clear, where it could be improved, and where open questions remain.
- **The broader community** — contract developers, wallet providers, infrastructure builders, and anyone interested in the future of Ethereum transactions — a window into what EIP-8141 means in practice.

## How to read these docs

| Section | What you'll find |
|---|---|
| [**Spec Overview**](/spec-overview/) | A structured walkthrough of EIP-8141, broken into digestible pieces — transaction structure, frame modes, new opcodes, execution flow, gas model. |
| [**Implementation Journal**](/implementation-journal/) | Chronological notes from the implementation effort — what we worked on, what questions came up, what we learned. |
| [**Design Decisions**](/design-decisions/) | The architectural and design choices we made, with rationale and discussion of alternatives. |
| [**Spec Feedback**](/spec-feedback/) | Our assessment of the spec's clarity, completeness, protocol alignment, and strategic fit within the Ethereum roadmap. |

## EIP Version Reference

This documentation and implementation are based on **EIP-8141 as of commit [`ee66073`](https://github.com/ethereum/EIPs/commit/ee66073462f5c0f5db43353b5ce4183a72157327)** (March 13, 2026).

**Snapshot link:** [EIP-8141 at `ee66073`](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md)

The EIP is in **Draft** status and evolving quickly. If you're reading this and the spec has moved on, some of our analysis may be outdated. We will update as we go, but check the commit hash above against the [latest version](https://eips.ethereum.org/EIPS/eip-8141) to gauge how current things are.

## The AI Experiment 🤖

These docs are **fully AI-generated** as part of an experimental human-AI collaboration workflow. Here's what that means concretely:

**The setup:** A human ([@hdrewes](https://github.com/hdrewes)) steers the direction, asks the questions, reviews the output, and makes editorial decisions. An AI assistant (Claude, via [Cursor](https://cursor.sh)) produces the actual prose, analysis, code, and structure.

**What this implies:**

- The documentation may contain **inaccuracies, hallucinated details, or subtly wrong interpretations** of the spec. AI assistants are confident writers even when they're wrong. Always cross-reference with the [actual EIP](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md).
- Content updates on a **quasi-daily basis** without notice as the implementation progresses. What you read today may be gone or rewritten tomorrow. Consider this the Heraclitean river of documentation — you never step into the same docs twice.
- The quality improves as the implementation deepens. Early entries are based on spec-reading; later entries reflect actual hands-on experience with the code.

**Why do it this way?**

- **Speed** — producing comprehensive documentation alongside implementation is normally a luxury. AI makes it feasible.
- **Transparency** — by publishing from day one, we make the entire implementation journey visible, warts and all.
- **Experiment** — we genuinely want to find out how well this workflow works for protocol-level documentation. Your feedback is part of the experiment.

**If something seems off, it probably is.** Please open an [issue](https://github.com/ethereumjs/ethereumjs-monorepo/issues) or reach out!
