# EVM Integration

*Status: Not yet started — this page outlines the planned approach and open questions.*

## Overview

The EVM integration is the largest part of the implementation. It covers:

1. Four new opcodes: `APPROVE`, `TXPARAM`, `FRAMEDATALOAD`, `FRAMEDATACOPY`
2. The frame execution loop — iterating through frames with mode-dependent behavior
3. Transaction-scoped approval state management
4. Cross-frame state interactions (warm/cold journal sharing, transient storage isolation)
5. Modified `ORIGIN` behavior

## Planned Approach

### New Opcodes

Each opcode needs to be registered in the EVM's opcode table and implemented:

| Opcode | Complexity | Notes |
|---|---|---|
| `TXPARAM` (`0xb0`) | Medium | Needs access to full transaction data and frame state; many param variants |
| `FRAMEDATALOAD` (`0xb1`) | Low | Similar to `CALLDATALOAD` but cross-frame |
| `FRAMEDATACOPY` (`0xb2`) | Low | Similar to `CALLDATACOPY` but cross-frame |
| `APPROVE` (`0xaa`) | High | Complex state transitions, multiple validation checks, frame termination |

### Frame Execution Loop

The frame loop is new architectural territory for the EVM. Currently, transaction execution is a single call. Frame transactions require:

- An outer loop that iterates through frames
- Per-frame context setup (caller, mode, gas limit)
- Transaction-scoped state that persists across the loop (approval flags)
- Per-frame state that resets (transient storage)

### Approval State Machine

The approval state follows strict rules:

```
Initial:    sender_approved=false, payer_approved=false
APPROVE(0): sender_approved=true  (requires frame.target == tx.sender)
APPROVE(1): payer_approved=true   (requires sender_approved == true)
APPROVE(2): both=true             (requires frame.target == tx.sender)
```

Both flags are one-way (`false → true`) and cannot be set twice.

## Open Questions

### APPROVE as Frame Terminator

`APPROVE` works like `RETURN` — it exits the frame. But it also performs state transitions (nonce increment, gas collection for payment approval). How do these interact with the `STATICCALL` semantics of `VERIFY` mode?

The spec implies that `APPROVE`'s state changes (nonce, balance) are *not* subject to the STATICCALL restriction — they are "transaction-scoped" rather than "state-scoped". This needs careful implementation to ensure the state changes from `APPROVE` persist even though the frame itself cannot modify state.

### ORIGIN Scope

The spec says `ORIGIN` returns the frame's `caller` "throughout all call depths." If a `SENDER` frame (caller = `tx.sender`) calls contract A, which calls contract B — both A and B see `ORIGIN = tx.sender`. This is clear. But what about `DELEGATECALL` chains? Does `ORIGIN` still return the frame-level caller?

### Warm/Cold Journal Sharing

The warm/cold access journal being shared across frames means the first frame to touch a storage slot pays the cold access cost, and all subsequent frames pay warm costs. This is efficient but means frame ordering affects gas costs — something transaction authors need to be aware of.

### Transient Storage Reset

Discarding transient storage between frames means `TSTORE`/`TLOAD` can only be used for intra-frame communication, not cross-frame. This is a deliberate isolation choice but worth documenting clearly for contract developers.

## Notes

*This page will be updated as implementation progresses.*
