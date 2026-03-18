# Default Code (EOA Support)

Frame transactions need to work with existing EOAs (externally owned accounts) — accounts that have no deployed code. To support this, the spec defines a "default code" behavior that EOAs implicitly have when participating in frame transactions.

::: info Implementation Note
The spec describes the *behavior* of the default code, not a specific implementation. Clients are free to implement this however they want, as long as the behavior matches.
:::

## Behavior by Mode

### VERIFY Mode

When an EOA is the target of a `VERIFY` frame:

1. Verify that `frame.target == tx.sender` (revert otherwise)
2. Read the first byte of `frame.data` as two nibbles:
   - **High nibble**: `scope` — the `APPROVE` scope to use
   - **Low nibble**: `signature_type` — which signature scheme to verify

#### Signature Types

| Type | Value | Data Layout | Address Derivation |
|---|---|---|---|
| ECDSA (secp256k1) | `0x0` | `[byte0, v(1), r(32), s(32)]` — 66 bytes total | `ecrecover(hash, v, r, s)` |
| P256 | `0x1` | `[byte0, r(32), s(32), qx(32), qy(32)]` — 129 bytes total | `keccak(qx \|\| qy)[12:]` |

For both types, the hash being signed is:

```
hash = keccak256(sig_hash || data_without_signature)
```

Where `sig_hash` is the canonical transaction signature hash (from `TXPARAM(0x08)`) and `data_without_signature` is the prefix of `frame.data` before the signature bytes.

After successful verification, the default code calls `APPROVE(scope)`.

### SENDER Mode

When an EOA is the target of a `SENDER` frame:

1. Verify the first nibble of the first byte is `0x0` (revert otherwise)
2. Verify `frame.target == tx.sender` (revert otherwise)
3. Decode the rest of `frame.data` as RLP: `[[target, value, data], ...]`
4. Execute each call with `msg.sender = tx.sender`
5. If any call reverts, revert the entire frame

This effectively gives EOAs a built-in "batch call" capability when using frame transactions.

### DEFAULT Mode

EOAs in `DEFAULT` mode simply revert. There is no meaningful default behavior for a codeless account receiving a generic call from `ENTRY_POINT`.

## Why This Matters

The default code is a pragmatic bridge: it lets today's EOA users benefit from frame transactions (gas abstraction, sponsorship, batch calls) without requiring account migration. The inclusion of P256 support is forward-looking — it enables passkey-based wallet authentication at the protocol level.

Over time, the expectation is that users will migrate to smart accounts with custom validation logic. But the default code ensures the transition isn't gated on that migration.
