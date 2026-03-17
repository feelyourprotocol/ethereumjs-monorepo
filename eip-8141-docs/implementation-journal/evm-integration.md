# EVM & VM Integration

*March 17, 2026 — Vertical integration of the "Simple Transaction" flow*

::: danger 🤖 AI-Generated Content
This documentation is AI-generated and updated frequently. See the [home page](/) for the full disclaimer.
:::

## What We Built

Full vertical integration of EIP-8141's "Simple Transaction" (Example 1) across three packages: `@ethereumjs/evm`, `@ethereumjs/vm`, and the existing `@ethereumjs/tx`. This is the first end-to-end path where a Frame Transaction actually executes.

### EVM Layer (`@ethereumjs/evm`)

- **`FrameTransactionContext`** (`frameContext.ts`): Generic interface using only primitives and `@ethereumjs/util` types — no `@ethereumjs/tx` dependency. Holds approval flags, frame array, current frame index, per-frame results, and gas totals.
- **Four new opcodes** registered in `codes.ts`:
  - `APPROVE` (0xaa) — async, frame terminator
  - `TXPARAM` (0xb0) — reads 21 distinct transaction/frame parameters
  - `FRAMEDATALOAD` (0xb1) — 32-byte read from any frame's data
  - `FRAMEDATACOPY` (0xb2) — variable-length copy with dynamic gas (memory expansion + copy cost)
- **Gas params** added to `params.ts`: `approveGas: 0`, `txparamGas: 2`, `framedataloadGas: 3`, `framedatacopyGas: 3`.
- **12 EVM unit tests** covering opcode registration, TXPARAM parameter access, APPROVE state transitions, and error conditions.

### VM Layer (`@ethereumjs/vm`)

- **`runFrameTransaction()`** (`runFrameTx.ts`): The frame execution loop. Bridges `@ethereumjs/tx` (FrameEIP8141Tx) to `@ethereumjs/evm` (FrameTransactionContext), iterating through frames with mode-dependent routing.
- **Default code** for EOA accounts (no deployed code):
  - **VERIFY mode**: secp256k1 signature verification via `ecrecover`, then direct APPROVE logic (nonce increment + balance deduction).
  - **SENDER mode**: RLP-decoded batch of `[target, value, data]` calls executed sequentially.
- **`runTx.ts` modifications**: EIP-3607 bypass for smart accounts, deferred gas handling (APPROVE-based), access list guard for frame transactions.
- **2 VM integration tests** covering successful VERIFY+SENDER flow and VERIFY failure rejection.

### Examples

- **3 EVM examples** (`packages/evm/examples/eip8141-frame-txs/`): TXPARAM, FRAMEDATALOAD, APPROVE opcode demonstrations.
- **3 VM examples** (`packages/vm/examples/eip8141-frame-txs/`): Simple frame tx, batch calls, verify failure.

## Architecture: Keeping EVM TX-Agnostic

The core design constraint was **no `@ethereumjs/tx` dependency in `@ethereumjs/evm`**. The solution:

```
@ethereumjs/tx         @ethereumjs/evm           @ethereumjs/vm
┌──────────────┐      ┌─────────────────────┐   ┌────────────────────┐
│ FrameEIP8141 │      │ FrameTransaction    │   │ runFrameTx.ts      │
│ Tx class     │      │ Context (generic)   │   │ - Parses tx.frames │
│              │ ───→ │ - mode, target,     │ ← │ - Builds context   │
│ frames[]     │      │   gasLimit, data    │   │ - Runs frame loop  │
│ sender       │      │ - approval flags    │   │ - Default code     │
└──────────────┘      │ - frame results     │   └────────────────────┘
                      └─────────────────────┘
```

The VM's `runFrameTransaction()` is the sole point that touches both packages. The EVM only knows about `FrameTransactionContext` — a plain TypeScript interface with no import from `@ethereumjs/tx`.

## Key Findings

### 1. accessList Iteration Breaks Frame Transactions

The `runTx()` wrapper unconditionally iterates over `castedTx.accessList` for all EIP-2718 typed transactions. Frame transactions are typed (type 6) but have no access list, causing `"castedTx.accessList is not iterable"`. This was the last bug we fixed — a guard `if (!isFrameEIP8141Tx(opts.tx))` before the access list loop.

**Spec feedback**: This reinforces the finding from transaction parsing — the existing code assumes all typed transactions share a common structure. Frame TX breaks this assumption at multiple integration points, not just in the tx package but also in the VM execution pipeline.

### 2. Default Code is TypeScript, Not EVM Bytecode

We implemented EOA default code (VERIFY and SENDER modes) directly in TypeScript rather than as EVM bytecode. Reasons:

- **VERIFY mode** needs `ecrecover` — calling the precompile from synthesized bytecode would be complex and fragile.
- **SENDER mode** needs RLP decoding of the call batch — no EVM opcode does this.
- The spec's pseudocode already describes these as procedural algorithms, not as bytecode sequences.

This means default code doesn't go through the opcode interpreter, which simplifies the implementation but means any contract that introspects "is there code at this address?" will get a different answer for EOAs vs. smart accounts.

### 3. APPROVE as Both Opcode and Function

APPROVE exists in two forms: as an EVM opcode (0xaa) for smart account contracts, and as a TypeScript function (`executeApprove()`) for default code. Both must produce identical state effects (nonce increment, balance deduction, flag setting). Any change to the APPROVE semantics must be synchronized between the two implementations.

### 4. Gas Accounting is Deferred

Traditional transactions deduct `gasLimit * gasPrice` upfront in `runTx.ts`. Frame transactions cannot do this because the **payer** isn't known until APPROVE executes. The flow:

1. VM skips upfront gas deduction for frame transactions.
2. Frame loop executes VERIFY frame → default code calls `executeApprove()` → balance deducted from sender/payer.
3. After all frames complete, any unused gas is refunded to the payer.

This "deferred gas" pattern is architecturally novel for Ethereum and required careful restructuring of `runTx.ts`'s post-execution refund logic.

### 5. Nonce Increments are Unusual

The sender's nonce gets incremented by APPROVE (during VERIFY frame execution), not by the VM before execution starts. This means:
- If a frame transaction fails before APPROVE runs, the nonce is NOT incremented.
- If APPROVE succeeds and later frames fail, the nonce IS already incremented.

This is different from standard transactions where the nonce is always incremented regardless of execution outcome.

## What's Next

- Smart account contracts (accounts with deployed code that use APPROVE/TXPARAM opcodes)
- Proper receipt format with per-frame status
- Warm/cold journal sharing across frames
- Transient storage reset between frames
- P256 signature support in default code
- Gas refund logic verification
