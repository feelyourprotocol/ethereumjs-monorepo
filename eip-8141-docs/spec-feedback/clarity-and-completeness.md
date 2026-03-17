# Clarity & Completeness

This page catalogs areas where the EIP-8141 specification could be clearer or more complete, based on our implementation experience. Each item is tagged with a severity:

- **Ambiguity** — the spec can be read multiple ways
- **Gap** — the spec doesn't address something an implementer needs to know
- **Suggestion** — the spec is clear but could be improved

::: tip
Items are updated as we progress through the implementation. Some may be resolved by spec updates or through discussion with the authors.
:::

## Transaction Structure

### Radical Departure from Base Transaction Shape

**Type: Suggestion** — *Added March 17, 2026 after initial tx scaffolding*

EIP-8141 is the first transaction type that breaks **all** shared assumptions of the existing transaction model:

- No `to`, `value`, `data` at top level (replaced by frames)
- No `gasLimit` as explicit field (computed from frames)
- No `v`, `r`, `s` signature fields (validation through VERIFY frames)
- Explicit `sender` instead of ECDSA-derived sender
- No `accessList` (EIP-2930, explicitly omitted)

While each of these decisions is individually well-motivated in the Rationale section, their combined effect makes it very hard for existing client implementations to accommodate Frame TX within the existing transaction abstraction. In EthereumJS, the `TransactionInterface` mandates all these fields and associated methods (`sign()`, `addSignature()`, `verifySignature()`, `getSenderPublicKey()`).

**Observation for spec authors:** It might be worth acknowledging this structural incompatibility in the spec or in an informative appendix. Implementers need to either (a) refactor their transaction abstractions, or (b) provide dummy/throwing implementations for ~8 interface methods. We chose (b) for pragmatism.

**Specific practical issue:** `gasLimit` not being an explicit field means it doesn't round-trip through RLP serialization — it must be recomputed after deserialization. This is different from every other tx type and could surprise implementers and downstream consumers (block explorers, indexers) who assume `gasLimit` is a first-class stored field.

### RLP Encoding of Null Target

**Type: Gap**

The spec says `target` can be `None`, which resolves to `tx.sender` during execution. But the RLP encoding of `None` is not specified. Is it an empty byte string (`0x80`), the RLP encoding of zero (`0x80` again), or something else? For a canonical encoding, this matters.

### Mode Field Encoding

**Type: Ambiguity**

The `mode` field uses bits 0-7 for the execution mode and bits 9-10 for approval bits. The spec describes this in two separate sections (Frame Modes and Approval Bits). It would help to have a single consolidated definition of the mode field format, including its RLP encoding (is it always encoded as a uint16? minimal-length integer?).

### Receipt Compatibility

**Type: Gap**

The new receipt format `[cumulative_gas_used, payer, [frame_receipt, ...]]` differs from the standard receipt format. How does this interact with existing tooling (block explorers, indexers, RPC methods like `eth_getTransactionReceipt`)? Should there be guidance on JSON-RPC representation?

### accessList Assumption in Existing Client Code

**Type: Suggestion** — *Added March 17, 2026 after EVM/VM vertical integration*

Existing Ethereum client code universally assumes that all EIP-2718 typed transactions have an `accessList` field (since EIP-2930 was the first typed transaction). The EIP-8141 Frame Transaction is the first typed transaction to NOT have an access list. In EthereumJS, this caused a runtime error deep in `runTx()` where the access list is iterated for pre-warming.

**Observation for spec authors:** Worth explicitly calling out in the "Backwards Compatibility" section that Frame TX does not include `accessList`, and that client code which assumes all typed transactions have one will need guards. This is a broader pattern: many client implementations have implicit assumptions about the "typed transaction shape" that go beyond the formal `TransactionInterface`.

### Default Code as Non-EVM Execution

**Type: Suggestion** — *Added March 17, 2026 after implementing default code*

The default code for EOAs (VERIFY and SENDER modes) is described in the spec as pseudocode. In practice, implementing this as EVM bytecode would be very complex (VERIFY needs ecrecover, SENDER needs RLP decoding). We implemented it as native TypeScript code that directly manipulates state, bypassing the EVM interpreter entirely.

**Observation:** This means default code execution has different observability characteristics than contract code — no EVM trace, no step events, no gas metering at the opcode level. The spec might benefit from acknowledging that default code is expected to be implemented natively rather than as EVM bytecode, and noting the implications for debugging and tracing tools.

### Dual APPROVE Implementation Requirement

**Type: Gap** — *Added March 17, 2026 after implementing APPROVE in both EVM and VM*

APPROVE must exist in two forms: as an EVM opcode (for smart account contracts) and as a native function (for default code). Both must produce identical state effects. The spec only describes APPROVE once, in the opcode section. Implementers need to maintain two synchronized implementations with identical semantics — any drift between them would be a consensus bug.

**Suggestion:** Add a note that default code implementations must replicate APPROVE semantics exactly, or provide a clearer separation between "APPROVE as opcode" and "APPROVE as abstract operation."

## Opcodes

### TXPARAM Parameter Numbering

**Type: Suggestion**

The `param` values jump from `0x09` to `0x10` (skipping `0x0A`-`0x0F`). This appears intentional (separating transaction-level from frame-level params) but is worth calling out explicitly in the spec to prevent implementers from treating it as an error.

### APPROVE Interaction with STATICCALL

**Type: Ambiguity**

`VERIFY` frames execute as `STATICCALL` (no state changes). But `APPROVE` with scope `0x1` or `0x2` *increments the nonce* and *deducts the gas cost* — both are state changes. The spec implies these happen at a "transaction scope" level that transcends the STATICCALL restriction, but this isn't stated explicitly. An implementer needs to know: do these state changes happen even though the frame is a STATICCALL? (We believe yes, but it should be explicit.)

### FRAMEDATACOPY Memory Behavior for VERIFY Frames

**Type: Ambiguity**

When `FRAMEDATACOPY` targets a `VERIFY` frame, "no data is copied." Does the destination memory region still get zero-filled (as with standard memory expansion), or is it left untouched? This matters for gas calculation (memory expansion cost).

## Execution Behavior

### Revert Semantics for Non-VERIFY Frames

**Type: Suggestion**

The spec says "If a frame's execution reverts, its state changes are discarded and execution proceeds to the next frame." This is clear for `DEFAULT` and `SENDER` frames. But it raises a question: is there any signal back to the transaction author that a frame reverted? The per-frame `status` in the receipt covers this, but it might be worth noting explicitly that non-VERIFY frame reverts are "soft failures" — the transaction continues.

### ORIGIN Throughout Call Depths

**Type: Gap**

The spec says `ORIGIN` returns the frame's `caller` "throughout all call depths." How does this interact with `DELEGATECALL`? In a `DELEGATECALL` chain, `ORIGIN` currently always returns the original external caller. With frame transactions, is it always the frame's caller regardless of `DELEGATECALL`?

## Default Code

### P256 Key-to-Address Derivation

**Type: Suggestion**

The spec says for P256: `frame.target != keccak(qx|qy)[12:]`. This is the Ethereum address derivation from a public key — but applied to a P256 key rather than secp256k1. It might be worth noting that this means P256-based accounts have addresses derived differently from traditional EOAs, and there's an implicit expectation that the user *knows* their P256-derived address.

### Default Code Error Handling

**Type: Gap**

What happens if the RLP decoding of calls in `SENDER` mode fails (malformed data)? The spec shows `calls = rlp_decode(frame.data[1:])` but doesn't specify behavior for decode errors. Presumably the frame should revert, but it's worth stating.

## Security Section

### Mempool Validation Strategy

**Type: Gap**

The security section acknowledges the DoS problem but says "Node implementations *should consider* restricting which opcodes..." A concrete recommended validation strategy (even as an informative appendix) would be very helpful for implementers. The reference to ERC-7562 is useful but leaves the details to the reader.
