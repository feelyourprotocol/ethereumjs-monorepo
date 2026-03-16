# Transaction Parsing

*Status: Not yet started — this page outlines the planned approach and open questions.*

## Overview

The first concrete implementation task is adding the `FrameTransaction` type to `@ethereumjs/tx`. This involves:

1. Defining the RLP schema for encoding and decoding
2. Registering the new type (`0x06`) in the transaction type registry
3. Implementing field validation (static constraints)
4. Computing the signature hash with `VERIFY` frame data elision
5. Generating the new receipt format

## Planned Approach

The EthereumJS tx library has a well-established pattern for adding new transaction types, most recently with EIP-4844 blob transactions and EIP-7702 set-code transactions. We will follow this pattern, extending the base transaction class.

### Key differences from existing types:

- **Explicit sender** — unlike all other types, the sender is a field, not derived from a signature
- **No top-level signature** — the signature lives inside frame data
- **Frames array** — a nested RLP structure that needs its own encoding/decoding logic
- **No `to` field** — replaced by per-frame `target`
- **No `value` field** — transfers are done through frame execution
- **No `accessList`** — intentionally omitted per the spec rationale

## Open Questions

These are questions we expect to encounter during implementation:

### RLP Encoding Details

- How exactly should a null `target` be encoded in RLP? As an empty byte string `0x80`? The spec says "target is None" but doesn't specify the RLP representation explicitly.
- What is the RLP encoding of the `mode` field when it includes approval bits? Is it encoded as a full uint256, or should it be a minimal-length integer?

### Validation Scope

- Should we validate frame mode approval bits at the parsing stage, or defer to execution time?
- How much validation belongs in the transaction class vs. the VM execution logic?

### Signature Hash

- The signature hash elides `VERIFY` frame data. But what about a `VERIFY` frame where `mode` also has approval bits set — do we use `mode & 0xFF` to identify `VERIFY`, or the full `mode` value?
- The spec says `tx.frames[i].data = Bytes()` for signature hash computation. Does this mean the `data` field becomes an empty RLP string, or is the entire frame field structure preserved with just the data emptied?

## Notes

*This page will be updated as implementation progresses with answers to the questions above, implementation decisions made, and any surprises encountered.*
