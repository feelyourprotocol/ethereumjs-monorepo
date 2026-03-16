# Spec Chronology

::: danger 🤖 AI-Generated Content
This chronology is AI-generated from public sources (EIPs repo commit history, Ethereum Magicians forum). See the [home page](/) for the full disclaimer.
:::

This page traces the evolution of EIP-8141 from its initial publication through the various revisions, community debates, and design shifts that shaped the spec we are implementing against. Understanding this history is essential context — it shows which design decisions were contested, what alternatives were considered, and where the spec might still be in flux.

## Prehistory: The Road to EIP-8141

EIP-8141 did not emerge from a vacuum. It is the latest in a long line of account abstraction proposals, each of which informed its design:

| Year | Proposal | What it did | Why it wasn't enough |
|---|---|---|---|
| 2020 | **[EIP-2938](https://eips.ethereum.org/EIPS/eip-2938)** | First native AA proposal — allowed smart contracts to originate transactions with a `PAYGAS` opcode | Failed due to lack of protocol-level introspection. Hard to build safe mempool rules around fully arbitrary validation. |
| 2021 | **[ERC-4337](https://eips.ethereum.org/EIPS/eip-4337)** | User-level AA via a singleton `EntryPoint` contract, separate bundler network | Works but adds infrastructure overhead (bundlers), gas inefficiency, and an extra trust layer. Not truly native. |
| 2023 | **[EIP-3074](https://eips.ethereum.org/EIPS/eip-3074)** | `AUTH` / `AUTHCALL` opcodes for EOA delegation | Only handled authorization, not validation or payment. Superseded by EIP-7702. |
| 2024 | **[EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)** | Set code for EOAs via authorization tuples | Tied to ECDSA for the authorization list. Low/slow adoption in practice due to wallet inertia, smart account complexity, and cross-chain deployment friction. |
| 2025 | **[EIP-7701](https://eips.ethereum.org/EIPS/eip-7701)** | Native AA with validation/execution phases | Informed EIP-8141's APPROVE design. Had awkward auto-propagation rules through `DELEGATECALL`. |
| 2026 | **EIP-8141** | Frame Transaction — multi-frame execution with typed modes, native PQ path | Where we are now. |

As [matt (lightclient)](https://ethereum-magicians.org/t/eip-8141-frame-transaction/27617) put it on the Magicians forum: *"We have already attempted a simpler proposal than EIP-8141 when we proposed EIP-2938. It was simpler and allowed you very arbitrarily define the smart contract system to determine the validity, PAYGAS, and execute calls. But it failed due to the lack of protocol-level introspection. [...] The frame transaction is a direct response to this."*

## Timeline: EIP-8141 Spec Evolution

### January 29, 2026 — Initial Publication

**Commit:** [`6f46a8c`](https://github.com/ethereum/EIPs/commit/6f46a8ce2d3f811f772aa4a3bc6e978e8d531e68) by Felix Lange (fjl)

The EIP is published as a Draft. The initial version establishes the core concepts:
- Transaction type `0x06` with the frames-based architecture
- Three modes: `DEFAULT`, `VERIFY`, `SENDER`
- `APPROVE` opcode (originally restricted to top-level call frame)
- `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY` opcodes
- No EOA default code — only smart accounts

The [Magicians discussion thread](https://ethereum-magicians.org/t/eip-8141-frame-transaction/27617) opens immediately and becomes very active (~100+ comments over the following weeks).

**Same-day fixes:** Typos ([`723c9ca`](https://github.com/ethereum/EIPs/commit/723c9ca2d4604d70390e8312ee899b48cb0411b5)), status field number fix ([`187d1ce`](https://github.com/ethereum/EIPs/commit/187d1ceb7b5ba639a95e3e9d254a1c07c43707cd)).

### Early Community Debates (late January — early February)

Several key discussion threads emerge on Ethereum Magicians:

**Multiple APPROVE calls:** [@thegaram33](https://ethereum-magicians.org/u/thegaram33) asks what happens with multiple `VERIFY` frames calling `APPROVE`. Answer: redundant approvals revert the frame but don't invalidate the transaction. Only the first approval counts.

**Frames vs. simpler designs:** [@Helkomine](https://ethereum-magicians.org/u/Helkomine) argues that the same functionality is achievable with command-oriented architectures (like Uniswap's UniversalRouter) and that the protocol doesn't need multiple frames. lightclient responds that frames exist for *protocol-level introspection* — enabling the mempool to reason about transaction validity, something purely user-level constructs cannot do.

**APPROVE propagation:** [@nlordell](https://ethereum-magicians.org/u/nlordell) and [@frangio](https://ethereum-magicians.org/u/frangio) raise questions about how `APPROVE` propagates through nested calls. This becomes a significant design discussion.

**Terminology clash:** [@frangio](https://ethereum-magicians.org/u/frangio) notes that "frame" already means "call frame" in EVM terminology — the EIP is overloading the term. fjl responds that frame transactions create an opportunity for multiple *top-level* call frames, so it is the same concept.

### February 10, 2026 — APPROVE Relaxation

**Commit:** [`c30b9c6`](https://github.com/ethereum/EIPs/commit/c30b9c6ee5fa3832d8d66521cb774d394ecf63a1) by lightclient

A significant design change: the requirement that `APPROVE` must be called in the top-level call frame is relaxed. Now `APPROVE` can be called from any call depth, but only when `ADDRESS == frame.target`. This change was driven by forum feedback about how proxy-based smart accounts (common in the ERC-4337 ecosystem) need to delegate validation logic.

fjl [explains the rationale](https://ethereum-magicians.org/t/eip-8141-frame-transaction/27617): *"We decided explicitly against making it propagate automatically, because it'd be a weird and unprecedented non-local exit from an inner call frame."*

### March 2, 2026 — Bug Fixes and Clarifications

**Commit:** [`52933c2`](https://github.com/ethereum/EIPs/commit/52933c256c22419a0ee711bf4397462c5e25c0d1) by Derek Chiang

Fixes several issues raised on the forum, including the `CALLER` vs `ADDRESS` check for `APPROVE` that [@nlordell](https://ethereum-magicians.org/u/nlordell) had identified — the original spec incorrectly used `CALLER == frame.target` when it should be `ADDRESS == frame.target`.

### March 5, 2026 — Breakout Call

A [dedicated breakout call](https://ethereum-magicians.org/t/headliner-breakout-eip-8141-frame-transaction-march-5-2026/27879) is held to discuss EIP-8141, described as a "headliner" for the upcoming **Hegota** hard fork. This signals that EIP-8141 is being seriously considered for inclusion in a near-term upgrade, alongside FOCIL for censorship resistance.

Meanwhile, [sm-stack publishes a proof-of-concept implementation](https://hackmd.io/@TB5b8ghoQyChOtUKB0RsOg/B1PhyMK_be) using a custom geth fork + Solidity contracts, raising the issue of ERC-20 paymaster overcharging due to gas refund mechanics.

### March 10, 2026 — EOA Support Added

**Commit:** [`fe43214`](https://github.com/ethereum/EIPs/commit/fe432142194f3f93573a563cb34c7ae57338d9c9) by Derek Chiang

A major addition: the "default code" mechanism for EOAs. This allows existing EOAs to participate in frame transactions without deploying smart account code. The default code supports:
- ECDSA (secp256k1) signature verification
- P256 signature verification (for passkeys)
- Batch calls in `SENDER` mode via RLP-encoded call lists

Derek Chiang [explains the motivation](https://ethereum-magicians.org/t/eip-8141-frame-transaction/27617): *"We've seen in practice that adoption for EIP-7702 has been low/slow due to the huge inertia of existing players. [...] EOAs can enjoy AA benefits consistently across all chains who are EVM-compatible, without depending on any contract deployments."*

**P256 debate:** [@shemnon](https://ethereum-magicians.org/u/shemnon) pushes back on P256 as "scope creep." Derek acknowledges the concern and notes that P256 may be extracted from the default code into a separate contract spec, since some co-authors worry that *"enabling native P256 EOAs with no clear path to migrate them to quantum-resistant accounts is a form of protocol tech debt."*

### March 12, 2026 — Frame Access Opcode Cleanup & Approval Bits

**Commits:** [`a0c3bbd`](https://github.com/ethereum/EIPs/commit/a0c3bbd8bf01aa1a79375be4fdb34b97e2a443c7), [`df2a272`](https://github.com/ethereum/EIPs/commit/df2a272178b5fde1df63c60f71c9c86dcd6e6b7b), [`6b9954e`](https://github.com/ethereum/EIPs/commit/6b9954ee712ef3c973fe1c31b16e16a212280930) by Felix Lange

A burst of refinement:
- Frame access opcodes (`FRAMEDATALOAD`, `FRAMEDATACOPY`) are cleaned up
- **Approval bits** are added to the `mode` field — bits 9 and 10 now declare what type of `APPROVE` a `VERIFY` frame is allowed to call, enabling the mempool to reason about frame behavior before execution
- Bit index fix follows shortly after

### March 13, 2026 — Derek Chiang Added as Co-author

**Commit:** [`ee66073`](https://github.com/ethereum/EIPs/commit/ee66073462f5c0f5db43353b5ce4183a72157327) — **this is the version we implement against.**

## Ongoing Discussions (as of mid-March 2026)

Several open threads on Ethereum Magicians remain active:

### Simplification Proposals

[@0xrcinus](https://ethereum-magicians.org/u/0xrcinus) proposes reducing from three modes to two (`VERIFY` + `EXECUTE`), removing `APPROVE` scope operands entirely, and adding frame "groups" for atomicity. These are substantial simplification proposals that could reshape the spec.

### Async Execution Compatibility

[@pdobacz](https://ethereum-magicians.org/u/pdobacz) raises concerns about compatibility with async execution proposals like [EIP-7886](https://eips.ethereum.org/EIPS/eip-7886) — frame transactions require EVM execution during validation, which complicates async block execution.

### Protocol Complexity Concerns

[@DanielVF](https://ethereum-magicians.org/u/DanielVF) voices broader concerns: *"Frame transactions would make checking transaction inclusion now require access to all blockchain state and execution of a Turing complete programming language. These are not trivial things."* He argues for simpler, more standardized solutions over infinite EVM-level flexibility, citing the slow adoption of EIP-7702 and ERC-4337 as cautionary tales.

### Transaction Assertions

[@alex-forshtat-tbk](https://ethereum-magicians.org/u/alex-forshtat-tbk) proposes using `VERIFY` frames for "transaction assertions" via a state diff opcode ([EIP-7906](https://eips.ethereum.org/EIPS/eip-7906)). [@frangio](https://ethereum-magicians.org/u/frangio) pushes back, arguing assertions are outside AA scope and dilute the case for the EIP.

## Key Takeaways for Implementers

1. **The spec is moving fast.** Between January 29 and March 13 there have been 12 commits, several with significant semantic changes. Expect more.

2. **APPROVE semantics are the most debated aspect.** The calling convention, propagation rules, and scope operand have all changed at least once. This is the area most likely to change again.

3. **EOA default code is recent and still contested.** Added March 10, debated immediately. P256 support may be extracted. The default code section should be treated as particularly volatile.

4. **Mempool strategy is unresolved.** Multiple community members have flagged this as a critical gap. The addition of approval bits (March 12) is a step toward addressable mempool validation, but concrete strategies are still TBD.

5. **The relationship with Hegota is significant.** EIP-8141 is positioned as a headliner for the next hard fork, paired with FOCIL for censorship resistance. This gives it urgency but also means it is under intense scrutiny.

## Sources

- [EIP-8141 commit history](https://github.com/ethereum/EIPs/commits/master/EIPS/eip-8141.md)
- [Ethereum Magicians discussion thread](https://ethereum-magicians.org/t/eip-8141-frame-transaction/27617)
- [EIP-8141 Proof of Concept (sm-stack)](https://hackmd.io/@TB5b8ghoQyChOtUKB0RsOg/B1PhyMK_be)
- [Headliner Breakout Call announcement](https://ethereum-magicians.org/t/headliner-breakout-eip-8141-frame-transaction-march-5-2026/27879)
