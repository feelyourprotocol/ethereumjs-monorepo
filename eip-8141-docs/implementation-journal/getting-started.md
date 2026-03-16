# Getting Started

*First entry — March 2026*

## Initial Impressions

EIP-8141 is one of the more ambitious EIPs we have encountered. It touches practically every layer of transaction processing:

- **Transaction parsing** — a new RLP structure with an explicit sender and a frames array
- **EVM** — four new opcodes, a new execution model with frame-scoped state
- **Consensus** — new validity rules, approval semantics, nonce handling
- **Receipts** — a new receipt format with per-frame status
- **Mempool** — new validation requirements and DoS considerations

The spec is well-structured and includes helpful examples, but the sheer surface area means there are many places where implementation details need to be inferred.

## Scoping the Work

For the reference implementation in EthereumJS, the work naturally splits across several packages:

| Package | Work Needed |
|---|---|
| `@ethereumjs/tx` | New transaction type class, RLP encoding/decoding, signature hash, validation |
| `@ethereumjs/evm` | New opcodes (APPROVE, TXPARAM, FRAMEDATALOAD, FRAMEDATACOPY), frame execution loop |
| `@ethereumjs/vm` | Integration of frame transaction processing into the VM execution pipeline |
| `@ethereumjs/common` | New hardfork definition, EIP parameters |

We decided to start with `@ethereumjs/tx` since the transaction structure is the foundation everything else builds on.

## First Questions

Some questions that came up immediately on first read:

1. **How does the transaction pool handle frame transactions?** The spec mentions mempool considerations in the security section but doesn't prescribe a specific validation strategy. How much of the frame execution do we need to run during pool validation?

2. **What happens to `tx.origin` in nested calls?** The spec says `ORIGIN` returns the frame's caller throughout all call depths. This is a significant behavioral change that contracts might depend on.

3. **How does the nonce increment work with `APPROVE`?** The nonce is checked pre-execution but incremented inside `APPROVE`. What if a `VERIFY` frame reverts after incrementing — does the nonce roll back? (Yes — `VERIFY` is a STATICCALL, so no state changes persist, but `APPROVE` is special...)

4. **Frame gas isolation** — unused gas from one frame can't flow to the next. This is clean conceptually but means the transaction author needs to estimate gas per-frame, which is harder than estimating total gas.

These questions will be explored in subsequent journal entries as we work through the implementation.

## Environment Setup

The implementation lives in the `ethereumjs-monorepo-fyp` fork (a [Feel Your Protocol](https://feelyourprotocol.org) project). We are working against the EthereumJS v10 release line. The documentation you are reading now is generated with VitePress from the `eip-8141-docs/` directory at the repository root.

**EIP version:** [`ee66073`](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md) (March 13, 2026)
