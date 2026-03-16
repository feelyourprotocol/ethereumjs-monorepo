# Execution Behavior

This page describes how a frame transaction is processed from validation through execution to finalization.

## Stateful Validation

Before any frames execute:

```
assert tx.nonce == state[tx.sender].nonce
```

The nonce check happens against the current state, just like legacy transactions. However, the nonce is *not* incremented here — that happens inside `APPROVE`.

## The Frame Execution Loop

After validation, the execution engine initializes two transaction-scoped variables:

```
payer_approved = false
sender_approved = false
```

Then it iterates through each frame in order:

### For each frame:

1. **Determine the call target**
   - If `target` is null, use `tx.sender`

2. **Set the caller based on mode**
   - `DEFAULT` or `VERIFY`: caller is `ENTRY_POINT` (`0xaa`)
   - `SENDER`: caller is `tx.sender` — but `sender_approved` must already be `true`, otherwise the **entire transaction is invalid**

3. **Handle codeless accounts**
   - If `frame.target` has no code, execute the [default code](./default-code) logic

4. **Execute the frame**
   - `VERIFY` mode: executed as a `STATICCALL` (no state changes)
   - `DEFAULT` / `SENDER` mode: regular call execution
   - The `ORIGIN` opcode returns the frame's `caller` throughout all call depths

5. **Handle the result**
   - If the frame reverts, its state changes are discarded and execution proceeds to the next frame
   - If the frame is `VERIFY` mode and did **not** successfully call `APPROVE`, the **entire transaction is invalid**

### After all frames:

- Verify that `payer_approved == true`. If not, the **entire transaction is invalid**.
- Refund unused gas to the gas payer.

## Transaction-Scoped State

### Approval Flags

The `sender_approved` and `payer_approved` flags are transaction-scoped and follow a strict one-way progression:

```
false → true (via APPROVE)
```

Once set, they cannot be unset or re-approved. The ordering constraint is enforced: sender must approve before payer can approve.

### Cross-Frame Interactions

Two important cross-frame behaviors:

1. **Warm/cold state journal is shared** — If frame 0 touches a storage slot (making it "warm"), frame 1 sees it as warm. This affects gas costs via EIP-2929 rules.

2. **Transient storage is discarded between frames** — `TSTORE` / `TLOAD` (EIP-1153) state does not persist across frame boundaries. Each frame starts with a fresh transient storage context.

## ORIGIN Behavior

For frame transactions, the `ORIGIN` opcode returns the frame's `caller` — **not** the traditional `tx.origin`:

- In `DEFAULT` and `VERIFY` frames: `ORIGIN` returns `ENTRY_POINT` (`0xaa`)
- In `SENDER` frames: `ORIGIN` returns `tx.sender`

This is consistent with the precedent set by EIP-7702 which already modified `ORIGIN` semantics. Contracts that rely on `ORIGIN == CALLER` for security checks (a long-discouraged pattern) may behave differently.

## Validity Summary

A frame transaction is **invalid** (rejected entirely, as if it never existed) if any of the following are true:

| Condition | When checked |
|---|---|
| Static constraints fail (nonce size, frame count, etc.) | Pre-execution |
| `tx.nonce != state[tx.sender].nonce` | Pre-execution |
| A `SENDER` frame executes while `sender_approved == false` | During execution |
| A `VERIFY` frame completes without calling `APPROVE` | After frame execution |
| `payer_approved == false` after all frames | Post-execution |
