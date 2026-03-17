# Implementation Journal

::: danger 🤖 AI-Generated Content
This documentation is AI-generated and updated frequently. See the [home page](/) for the full disclaimer.
:::

This is the chronological record of our EIP-8141 reference implementation in EthereumJS. Each entry documents what we worked on, what questions came up, what surprised us, and what we learned.

::: tip Follow the Code
The implementation lives in an open PR: **[EIP-8141 Frame Transactions (PR #1)](https://github.com/feelyourprotocol/ethereumjs-monorepo/pull/1)**. You can follow along with the code changes, review commits, and leave comments.
:::

## Purpose

Building a reference implementation of a draft EIP is a different exercise from implementing a finalized spec. The spec is a moving target, ambiguities are expected, and the implementation itself becomes a tool for testing and refining the specification.

This journal captures that process honestly — not just the "what" but the "why" and the "huh?". It is written for:

- **Other implementers** who will face the same questions and can benefit from our answers (or our unanswered questions).
- **Spec authors** who can see exactly where an implementer gets stuck, confused, or has to make assumptions.
- **Ourselves** as a reference when the spec evolves and we need to revisit decisions.

## How to Read This

Entries are organized by topic rather than strictly by date, though each entry notes when it was written. The topics roughly follow the implementation order:

1. **[Getting Started](./getting-started)** — Initial setup, first impressions of the spec, scoping the work.
2. **[Transaction Parsing](./transaction-parsing)** — RLP decoding, type registration, field validation, and the major `TransactionInterface` friction story.
3. **[EVM Integration](./evm-integration)** — Opcode implementation, frame execution loop, approval state management.

New entries will be added as the implementation progresses. Topics may include:

- Gas accounting implementation
- Default code (EOA support)
- Receipt generation
- Cross-frame state handling
- Testing strategies and test vector generation
- Integration with the broader EthereumJS client

::: tip
Each journal entry aims to be self-contained — you can read them in order for the full narrative, or jump to a specific topic if you're looking for guidance on a particular aspect.
:::
