# Protocol Alignment

This page examines how EIP-8141 interacts with existing Ethereum protocol features — where it integrates smoothly, where there is friction, and where there might be conflicts.

## Interactions with Existing EIPs

### EIP-2718 (Typed Transaction Envelope)

**Alignment: Smooth**

Frame transactions fit naturally into the EIP-2718 framework as type `0x06`. The RLP encoding follows established patterns. No issues expected here.

### EIP-1559 (Fee Market)

**Alignment: Good, with one nuance**

The `max_fee_per_gas` and `max_priority_fee_per_gas` fields work as expected under EIP-1559 rules. The nuance is that the gas payer might not be the transaction sender — the effective gas price calculation and fee distribution need to account for the payer being a different account, determined at execution time rather than statically.

### EIP-4844 (Blob Transactions)

**Alignment: Good**

Frame transactions support blobs via `blob_versioned_hashes` and `max_fee_per_blob_gas`. The blob mechanism is orthogonal to the frame execution model — blobs are attached at the transaction level, not per-frame.

### EIP-7702 (Set Code for EOAs)

**Alignment: Overlapping concerns**

Both EIP-7702 and EIP-8141 address account abstraction, but from different angles. EIP-7702 lets EOAs delegate to contract code; EIP-8141 provides a native frame-based AA model. Key questions:

- Can a frame transaction target an account that has EIP-7702 delegation active?
- Does the "default code" behavior override or coexist with EIP-7702 delegated code?
- Should there be guidance on migration paths from EIP-7702 to frame-based accounts?

### EIP-2929 (Gas Cost Increases for State Access)

**Alignment: Good, intentional interaction**

The spec explicitly says the warm/cold access journal is shared across frames. This is a deliberate and sensible choice — it prevents double-charging for state access across frames within the same transaction.

### EIP-1153 (Transient Storage)

**Alignment: Intentional isolation**

Transient storage is discarded between frames. This is a deliberate choice that prevents cross-frame communication via transient storage. Contract developers need to be aware that `TSTORE`/`TLOAD` patterns that work within a single call don't work across frames.

### EIP-3529 (Reduction in Refunds)

**Alignment: Separate mechanism**

The spec explicitly notes that frame gas refunds are separate from EIP-3529 storage refunds. This is clear and avoids confusion.

## Broader Protocol Considerations

### Transaction Pool Impact

Frame transactions require EVM execution during validation (to verify `APPROVE` was called). This is a significant change from the current model where transaction validation is purely cryptographic. The performance and DoS implications for the mempool are substantial and will need careful benchmarking.

### Block Building

Block builders need to account for the fact that frame transactions can have complex validation logic that may depend on state. This interacts with proposer-builder separation (PBS) and may affect MEV strategies.

### JSON-RPC API

The new receipt format, the per-frame status, and the non-static payer address all affect the JSON-RPC API. An informative section or companion document on JSON-RPC changes would be valuable.

### State Transition Tests

Generating comprehensive test vectors for frame transactions is going to be significantly more complex than for existing transaction types due to the combinatorial explosion of frame modes, approval scopes, and execution paths.

## Summary

EIP-8141 is generally well-aligned with the existing protocol stack. The main areas of concern are:

1. **Overlap with EIP-7702** — needs clear guidance on coexistence
2. **Mempool impact** — needs concrete validation strategies
3. **JSON-RPC impact** — needs specification or companion document
4. **Testing complexity** — the combinatorial space is large
