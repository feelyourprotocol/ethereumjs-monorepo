# Frame Modes

Each frame in a frame transaction has a `mode` that determines its execution semantics — who the caller is, what state modifications are allowed, and what role the frame plays in the transaction lifecycle.

## The Three Modes

| `mode & 0xFF` | Name | Caller | State Changes | Purpose |
|---|---|---|---|---|
| 0 | `DEFAULT` | `ENTRY_POINT` (`0xaa`) | Yes | General-purpose execution |
| 1 | `VERIFY` | `ENTRY_POINT` (`0xaa`) | No (STATICCALL) | Transaction validation |
| 2 | `SENDER` | `tx.sender` | Yes | Act on behalf of sender |

### DEFAULT Mode

The simplest mode. The frame executes as a regular call with `ENTRY_POINT` as the caller. This is useful for setup operations that don't require sender authority — for example, deploying the sender's smart account contract before verification.

### VERIFY Mode

The validation mode. Key characteristics:

- Executes like a `STATICCALL` — **no state modifications** are allowed
- Must call `APPROVE` during execution or the **entire transaction is invalid**
- Frame data is **elided from the signature hash** and **invisible to other frames** via `FRAMEDATALOAD` / `FRAMEDATACOPY`

The `VERIFY` mode is where the "abstract" in account abstraction lives. The frame can implement any validation logic: ECDSA, P256, BLS, multi-sig, time-locks, social recovery — anything expressible in EVM.

### SENDER Mode

Executes with `tx.sender` as the caller address, effectively acting *on behalf of* the account. This requires `sender_approved == true` (set via a prior `APPROVE` call), so a `VERIFY` frame must succeed before any `SENDER` frames can execute.

## Approval Bits

The upper bits of `mode` (bits 9-10) configure what the frame is allowed to approve:

| Mode bit | Meaning |
|---|---|
| 9 | `APPROVE` of execution allowed |
| 10 | `APPROVE` of payment allowed |

The combination `(mode >> 8) & 3` determines which `APPROVE` scopes the frame can use:

| Value | Allowed scopes |
|---|---|
| `1` | Only execution (`0x0`) |
| `2` | Only payment (`0x1`) |
| `3` | Execution, payment, or both (`0x0`, `0x1`, `0x2`) |

This bit-level design allows the transaction to declare up front what each `VERIFY` frame is authorized to do, making it possible for the mempool and other observers to reason about frame behavior before execution.

## Typical Frame Sequences

### Simple Transaction (sender = payer)

| Frame | Mode | Purpose |
|---|---|---|
| 0 | `VERIFY` | Verify signature, `APPROVE(0x2)` — approve execution + payment |
| 1 | `SENDER` | Execute the actual call |

### Sponsored Transaction (separate payer)

| Frame | Mode | Purpose |
|---|---|---|
| 0 | `VERIFY` | Sender verifies, `APPROVE(0x0)` — approve execution only |
| 1 | `VERIFY` | Sponsor verifies, `APPROVE(0x1)` — approve payment only |
| 2 | `SENDER` | Transfer ERC-20 tokens to sponsor |
| 3 | `SENDER` | Execute the user's intended call |
| 4 | `DEFAULT` | Sponsor post-op (refunds, token conversion) |

### First-time Account Deployment

| Frame | Mode | Purpose |
|---|---|---|
| 0 | `DEFAULT` | Deploy smart account via factory |
| 1 | `VERIFY` | Verify signature against newly deployed code |
| 2 | `SENDER` | Execute the actual call |
