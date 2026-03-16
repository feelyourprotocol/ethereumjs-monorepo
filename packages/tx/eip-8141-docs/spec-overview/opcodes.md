# New Opcodes

EIP-8141 introduces four new opcodes that provide the EVM interface for frame transaction execution and introspection.

## APPROVE (`0xaa`)

The most significant new opcode. `APPROVE` is the mechanism by which a frame signals that the transaction sender and/or gas payer has been verified.

### Stack

| Position | Value |
|---|---|
| `top - 0` | `offset` — return data memory offset |
| `top - 1` | `length` — return data length |
| `top - 2` | `scope` — what is being approved |

### Scope Values

| Scope | Meaning |
|---|---|
| `0x0` | Approve **execution** — sender authorizes future `SENDER` mode frames |
| `0x1` | Approve **payment** — account commits to paying gas costs |
| `0x2` | Approve **both** execution and payment |

### Behavior

`APPROVE` works like `RETURN` (exits the frame successfully) but additionally updates transaction-scoped approval state:

- **Scope 0x0**: Sets `sender_approved = true`. Only valid when `frame.target == tx.sender`. Cannot be called twice.
- **Scope 0x1**: Increments the sender's nonce, collects gas fees from the account, sets `payer_approved = true`. Requires `sender_approved == true` first. Cannot be called twice.
- **Scope 0x2**: Combines both — sets `sender_approved`, increments nonce, collects gas, sets `payer_approved`. Only valid when `frame.target == tx.sender`. Cannot be called twice.

### Constraints

- `ADDRESS` must equal `frame.target` — only the frame's target contract can call `APPROVE`
- The approval bits in `frame.mode` (bits 9-10) must permit the requested scope
- Any violation results in an exceptional halt or frame revert

## TXPARAM (`0xb0`)

An introspection opcode for accessing transaction metadata. Gas cost: **2**.

### Stack

| Position | Value |
|---|---|
| `top - 0` | `param` — which field to read |
| `top - 1` | `in2` — frame index (or must be 0) |

### Parameters

#### Transaction-level (`in2` must be 0)

| `param` | Returns |
|---|---|
| `0x00` | Transaction type |
| `0x01` | `nonce` |
| `0x02` | `sender` |
| `0x03` | `max_priority_fee_per_gas` |
| `0x04` | `max_fee_per_gas` |
| `0x05` | `max_fee_per_blob_gas` |
| `0x06` | Max cost (worst-case total fee) |
| `0x07` | `len(blob_versioned_hashes)` |
| `0x08` | `compute_sig_hash(tx)` |
| `0x09` | `len(frames)` |

#### Frame-level (`in2` = frame index)

| `param` | Returns |
|---|---|
| `0x10` | Currently executing frame index |
| `0x11` | `target` of frame at index |
| `0x12` | `gas_limit` of frame at index |
| `0x13` | `mode` of frame at index |
| `0x14` | `len(data)` of frame at index (0 for `VERIFY` frames) |
| `0x15` | `status` of frame at index (only past frames) |

### Error Cases

- Invalid `param` values: exceptional halt
- Out-of-bounds frame index: exceptional halt
- Accessing status of current or future frame: exceptional halt
- `len(data)` returns 0 for `VERIFY` mode frames (data is elided)

## FRAMEDATALOAD (`0xb1`)

Loads a 32-byte word from another frame's data. Gas cost: **3** (matches `CALLDATALOAD`).

### Stack

| Position | Value |
|---|---|
| `top - 0` | `offset` — byte offset into frame data |
| `top - 1` | `frameIndex` — which frame's data to read |

Semantics match `CALLDATALOAD` — reads 32 bytes starting at `offset`, zero-padding if the offset extends beyond the data length. When targeting a `VERIFY` frame, the returned data is always zero.

## FRAMEDATACOPY (`0xb2`)

Copies data from another frame into memory. Gas cost matches `CALLDATACOPY` (fixed cost of 3 + memory expansion + copy cost).

### Stack

| Position | Value |
|---|---|
| `top - 0` | `memOffset` — destination in memory |
| `top - 1` | `dataOffset` — byte offset into frame data |
| `top - 2` | `length` — bytes to copy |
| `top - 3` | `frameIndex` — which frame's data to read |

When targeting a `VERIFY` frame, no data is copied (the region is zero-filled per standard memory expansion).
