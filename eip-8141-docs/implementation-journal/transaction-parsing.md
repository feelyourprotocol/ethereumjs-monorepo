# Transaction Parsing

*March 17, 2026 — First implementation day*

::: danger 🤖 AI-Generated Content
This documentation is AI-generated and updated frequently. See the [home page](/) for the full disclaimer.
:::

## What We Built

In this session we scaffolded the complete `FrameEIP8141Tx` transaction type in `@ethereumjs/tx`, following the structure of existing types (EIP-7702 as primary reference). The scope:

- **Common**: Added EIP-8141 to the EIP registry (`eips.ts`) with `minimumHardfork: Prague` and `requiredEIPs: [2718, 4844]`.
- **Params**: Registered `frameTxIntrinsicCost: 15000` and `maxFrames: 1000`.
- **Types**: Added `TransactionType.FrameEIP8141 = 6`, type guards, `FrameEIP8141TxData`, `FrameEIP8141TxValuesArray`, `EIP8141CompatibleTx`, and `Capability.EIP8141FrameTx`.
- **Tx class** (`src/8141/tx.ts`): Full implementation of `FrameEIP8141Tx` implementing `TransactionInterface`, with computed `gasLimit`, explicit `sender`, signature hash with VERIFY data elision, and all required interface methods.
- **Constructors** (`src/8141/constructors.ts`): `createFrameEIP8141Tx`, `createFrameEIP8141TxFromBytesArray`, `createFrameEIP8141TxFromRLP`.
- **Capabilities** (`src/capabilities/eip8141.ts`): Frame validation, calldata gas computation, intrinsic gas, and gas limit calculation.
- **Factory**: Integrated into `createTx()` and `createTxFromRLP()`.
- **Tests**: 39 tests across two suites — shared generic behavior and EIP-8141-unique behavior.

## The Big Story: TransactionInterface Friction

The single most impactful finding from this initial scaffolding is how poorly EIP-8141 fits the existing `TransactionInterface` abstraction. Every previous Ethereum transaction type (Legacy through EIP-7702) shares a common shape:

```
[nonce, gasLimit, to, value, data, ..., v, r, s]
```

EIP-8141 breaks **all** of these assumptions:

| Field | Previous TXs | EIP-8141 |
|-------|-------------|----------|
| `to` | Top-level address | Doesn't exist (per-frame targets) |
| `value` | Top-level ETH amount | Doesn't exist (no built-in value transfer) |
| `data` | Top-level calldata | Doesn't exist (per-frame data) |
| `gasLimit` | Explicit field | Computed from frames |
| `v`, `r`, `s` | ECDSA signature | Don't exist (VERIFY frame validation) |
| `sender` | Derived from signature | Explicit 20-byte field |

### Concrete Problems

**1. `sharedConstructor` is unusable.** The shared constructor (`util/internal.ts`) destructures `{ nonce, gasLimit, to, value, data, v, r, s }` from `TxData` — six of these eight fields don't exist in `FrameEIP8141TxData`. We had to skip it entirely and write custom initialization, duplicating the Common setup and parameter loading logic.

**2. The `TxData` union breaks.** Adding `FrameEIP8141TxData` to the `TxData[TransactionType]` union caused TypeScript errors in `sharedConstructor` because the union members no longer share `gasLimit`, `to`, `value`, `data`, `v`, `r`, `s`. We had to add these as unused optional fields to `FrameEIP8141TxData` — pure noise to satisfy the type system.

**3. Interface methods that must throw.** The `TransactionInterface` mandates `sign()`, `addSignature()`, `getSenderPublicKey()`, and `verifySignature()`. For Frame TX, all of these throw at runtime — there is no ECDSA signature to produce or verify. This is a runtime trap for any code that calls these methods on a generic `TypedTransaction`.

**4. Capability chain doesn't fit.** The interface inheritance chain is linear: `TransactionInterface` → `EIP2718CompatibleTx` → `EIP2930CompatibleTx` → `EIP1559CompatibleTx`. Frame TX uses EIP-1559 fees but explicitly does NOT use EIP-2930 access lists (the EIP rationale explains why). We had to create `EIP8141CompatibleTx` extending `EIP2718CompatibleTx` directly, breaking the assumption that EIP-1559 fees imply access lists.

### Potential Mitigations

If the EthereumJS `TransactionInterface` were to evolve, a cleaner approach might be:

- **Split the interface**: Separate `SignableTransaction` (with `sign`, `addSignature`, `v/r/s`) from a base `Transaction` (with serialization, hashing, validation).
- **Make base fields optional**: `to`, `value`, `data` could be optional on the base interface since Frame TX proves they're not universal.
- **Compose capabilities**: Instead of a linear inheritance chain, use composition — a tx could declare its capabilities as a set, and the interface would only require methods matching active capabilities.

These are non-trivial refactors. For now, our approach of implementing the full interface with throwing stubs is pragmatic and keeps the factory and generic transaction handling working.

## Computed Gas Limit

Unlike all other tx types where `gasLimit` is an explicit field, EIP-8141 computes it:

```
tx_gas_limit = FRAME_TX_INTRINSIC_COST + calldata_cost(rlp(frames)) + sum(frame.gas_limit)
```

We compute this in the constructor and store it as a readonly property, satisfying the interface while being spec-compliant. One subtle implication: `gasLimit` is not part of the RLP payload, so it doesn't round-trip through serialization. After deserializing, we recompute it — this is a difference from other tx types where `gasLimit` is preserved byte-for-byte in the RLP.

## Signature Hash (VERIFY Data Elision)

The EIP-8141 signature hash zeroes out `frame.data` for all VERIFY frames before hashing. Our test suite verifies this property directly:

- Changing VERIFY frame data does **not** change the signature hash
- Changing SENDER frame data **does** change the signature hash

This is correct per spec and elegant for the gas-sponsoring use case (the sponsor's data can be attached after the sender signs).

## Frame Validation (Black Box for Now)

We intentionally treat frames as a structural black box at the tx layer. Validation is limited to:

- Frame count: `1 <= len(frames) <= MAX_FRAMES (1000)`
- Mode validity: `mode & 0xFF` must be 0, 1, or 2
- Target length: 0 (null → sender) or 20 bytes

Semantic validation (does a VERIFY frame actually call APPROVE? Is `sender_approved` set before SENDER frames?) happens during EVM execution, not at the transaction layer.

## What's Next

- Flesh out frame types beyond the `FrameBytes` black box
- Implement the frame execution loop in `@ethereumjs/evm`
- Add the four new opcodes (APPROVE, TXPARAM, FRAMEDATALOAD, FRAMEDATACOPY)
- Implement the default code for EOA support
- Receipt generation with per-frame status
