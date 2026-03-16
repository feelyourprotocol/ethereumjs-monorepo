# Transaction Structure

## RLP Encoding

Frame transactions use [EIP-2718](https://eips.ethereum.org/EIPS/eip-2718) typed transaction envelopes with type `0x06`. The payload is defined as:

```
[chain_id, nonce, sender, frames, max_priority_fee_per_gas, max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]
```

Where each frame is:

```
[mode, target, gas_limit, data]
```

### Notable Differences from Existing Transaction Types

| Aspect | Legacy / EIP-1559 / EIP-4844 | Frame Transaction |
|---|---|---|
| **Sender** | Derived from signature via `ecrecover` | Explicit `sender` field in the payload |
| **Signature** | Top-level field(s) | Embedded in frame data (typically a `VERIFY` frame) |
| **Execution target** | Single `to` field | Multiple frames, each with its own `target` |
| **Value** | Explicit `value` field | No value field — transfers handled via frame execution |
| **Access list** | Optional (EIP-2930) | Not included |

The explicit `sender` field is a fundamental shift: since the transaction is not necessarily signed with ECDSA, the sender cannot be recovered from a signature. The sender is declared and then *verified* by a `VERIFY` frame during execution.

## Field Constraints

The spec defines static validity constraints:

```python
assert tx.chain_id < 2**256
assert tx.nonce < 2**64
assert len(tx.frames) > 0 and len(tx.frames) <= MAX_FRAMES  # 1..1000
assert len(tx.sender) == 20
assert tx.frames[n].mode < 3
assert len(tx.frames[n].target) == 20 or tx.frames[n].target is None
```

When `target` is `None` (null), it resolves to `tx.sender` during execution.

## Blob Support

Frame transactions support [EIP-4844](https://eips.ethereum.org/EIPS/eip-4844) blobs. When no blobs are included:
- `blob_versioned_hashes` must be an empty list
- `max_fee_per_blob_gas` must be `0`

## Receipt Format

The receipt structure differs from standard transactions:

```
[cumulative_gas_used, payer, [frame_receipt, ...]]
```

Where each frame receipt is:

```
[status, gas_used, logs]
```

Key additions:
- **`payer`** — the address that paid gas fees (recorded here because it cannot be determined statically from the transaction, unlike legacy transactions where sender = payer)
- **Per-frame status and logs** — each frame gets its own receipt entry

## Signature Hash

The canonical signature hash elides data from `VERIFY` frames:

```python
def compute_sig_hash(tx: FrameTx) -> Hash:
    for i, frame in enumerate(tx.frames):
        if frame.mode == VERIFY:
            tx.frames[i].data = Bytes()
    return keccak(rlp(tx))
```

This is critical for two reasons:
1. The signature itself lives in `VERIFY` frame data — it cannot be part of its own hash.
2. It enables future aggregation of cryptographic operations across `VERIFY` frames.
3. For gas sponsorship, leaving sponsor `VERIFY` data malleable allows sponsors to attach their authorization after the sender has signed.
