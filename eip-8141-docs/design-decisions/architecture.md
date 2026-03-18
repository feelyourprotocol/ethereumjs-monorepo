# Architecture Choices

::: danger 🤖 AI-Generated Content
This documentation is AI-generated and updated frequently. See the [home page](/) for the full disclaimer.
:::

## EVM Transaction Dependency — The Pivot

*March 18, 2026 — Decision made after reviewing the initial vertical integration code*

### The Original Design

When we first implemented the EVM layer for EIP-8141, we deliberately kept `@ethereumjs/tx` out of the EVM's dependency tree. The reasoning was sound in principle: the EVM should be a standalone bytecode execution engine, and coupling it to a specific transaction format would reduce its generality.

To achieve this, we created a `FrameTransactionContext` interface in the EVM that duplicated every field from `FrameEIP8141Tx`:

```typescript
// The old approach: a 15-field interface that mirrors the tx
export interface FrameTransactionContext {
  txType: number
  chainId: bigint
  nonce: bigint
  sender: Address
  maxPriorityFeePerGas: bigint
  maxFeePerGas: bigint
  maxFeePerBlobGas: bigint
  blobVersionedHashes: PrefixedHexString[]
  sigHash: Uint8Array
  frames: FrameData[]
  currentFrameIndex: number
  senderApproved: boolean
  // ... and more
}
```

The VM would build this context from the real tx object, copy every field over, then set it on the EVM.

### What Went Wrong

After the vertical integration was working (VERIFY + SENDER default code, 14 tests, 6 examples), we reviewed the code and found:

1. **Massive redundancy.** The VM's `runFrameTx.ts` had a 35-line block (lines 61–96) that did nothing but copy fields from `FrameEIP8141Tx` into `FrameTransactionContext`. Every field was copied with `(tx as any).fieldName` casts because the tx type system didn't expose them cleanly.

2. **`any` casts everywhere.** The EVM property was accessed as `(evm as any).frameTransactionContext` in 4 opcode handlers, all 12 tests, and all 3 examples. The type system provided zero help.

3. **`FrameData` duplicated `FrameBytes`.** The EVM defined its own `FrameData` type (`{ mode, target, gasLimit, data }`) to avoid importing `FrameBytes` from `@ethereumjs/tx`. The VM parsed `FrameBytes[]` into `FrameData[]` on every transaction.

4. **Tests were painful.** Every EVM test had to manually construct a 15-field context object instead of using `createFrameEIP8141Tx()` from the tx package.

5. **Two sources of truth.** Changes to the tx structure required updating both the tx class and the context interface in lockstep.

### The Decision

**Add `@ethereumjs/tx` as a dependency to `@ethereumjs/evm`.**

Replace the monolithic `FrameTransactionContext` with:

```typescript
export interface FrameExecutionContext {
  tx: FrameEIP8141Tx          // the actual immutable tx
  state: FrameExecutionState   // only the mutable runtime state
}
```

The `FrameExecutionState` contains only what evolves during execution:

```typescript
export interface FrameExecutionState {
  parsedFrames: ParsedFrame[]
  currentFrameIndex: number
  senderApproved: boolean
  payerApproved: boolean
  payer?: Address
  approveCalledInCurrentFrame: boolean
  frameResults: FrameResult[]
  totalGasCost: bigint
  totalBlobGasCost: bigint
}
```

### What This Changed

| Aspect | Before | After |
|--------|--------|-------|
| EVM property | `(evm as any).frameTransactionContext` | `evm.frameExecutionContext` (typed) |
| Opcode access to tx fields | `ctx.nonce`, `ctx.sender`, etc. (copied fields) | `tx.nonce`, `tx.sender` (real tx object) |
| VM context setup | 35-line field-copy block with `(tx as any)` casts | Parse frames + create lean state object |
| EVM tests | Manual 15-field context | `createFrameEIP8141Tx()` + small state |
| Type safety | None (`any` casts) | Full TypeScript type checking |

### Trade-offs

**What we gained:**
- Type safety throughout the opcode handlers — no `any` casts
- Single source of truth for tx fields
- Simpler VM bridge code (no field copying)
- Tests use real tx objects from the tx package
- Smaller, focused `FrameExecutionState` (only mutable state)

**What we gave up:**
- The EVM now depends on `@ethereumjs/tx` (adds one package to the dependency tree)
- The EVM is no longer fully transaction-format-agnostic (though in practice, it already had deep knowledge of EIP-8141 semantics through the opcode handlers)

### Why the Trade-off is Worth It

The key insight is that **the EVM was never truly tx-agnostic for frame transactions.** The APPROVE opcode knows about nonce increment, balance deduction, and sender/payer approval semantics. The TXPARAM opcode returns 21 distinct transaction parameters by number. Pretending the EVM doesn't know about the tx format by routing everything through a generic interface just added indirection without adding abstraction.

The dependency cost is minimal — `@ethereumjs/tx` is already a peer in the monorepo and adds no new external dependencies. The type safety and code clarity gains are substantial.

## EVM Frame Loop Placement

*Decided March 17, 2026*

### Decision

The frame execution loop lives in the **VM** (`packages/vm/src/runFrameTx.ts`), not in the EVM. The EVM provides the opcode handlers and stores the `FrameExecutionContext`, but the iteration logic — deciding which frame to run next, checking approval flags, routing to default code vs. deployed code — is VM-level transaction processing.

### Rationale

- The loop needs access to both the tx object and the state manager for default code execution (ecrecover, account lookups).
- The EVM's `runCall` remains a single call entry point; the loop calls it once per frame.
- This matches the existing architecture where `runTx` orchestrates and `runCall` executes.
- The `FrameExecutionContext` on the EVM is the communication channel: the VM sets it up, the opcodes read/mutate it, the VM reads the results.

## Transaction Class Design

*Decided March 17, 2026*

### Decision

`FrameEIP8141Tx` implements the full `TransactionInterface` with throwing stubs for signature methods. This is option 1 from the original analysis: extend the existing pattern, accept the awkward fit.

### Rationale

Documented in detail in the [Transaction Parsing](/implementation-journal/transaction-parsing) journal entry. The pragmatic choice: the factory and generic transaction handling work, at the cost of some throwing methods. A deeper refactor of `TransactionInterface` would be valuable but is out of scope for this reference implementation.
