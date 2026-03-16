# Architecture Choices

*Status: Planned — decisions will be documented here as the implementation takes shape.*

## Transaction Class Design

### Context

EthereumJS represents each transaction type as a class that extends a common base. The existing hierarchy includes `LegacyTransaction`, `EIP2930Transaction`, `EIP1559Transaction`, `EIP4844Transaction`, and `EIP7702Transaction`. A new `FrameTransaction` class needs to fit into this structure.

### Key Questions

- **Does FrameTransaction fit the existing base class?** The frame transaction is structurally different enough (no signature fields, no `to`, no `value`, explicit sender, frames array) that we need to evaluate whether the current base class assumptions still hold.

- **How to represent frames?** Should frames be a simple array of plain objects, or a dedicated `Frame` class with its own validation and serialization logic?

- **Sender vs. signature** — existing transaction types derive the sender from the signature. FrameTransaction has an explicit sender. How does this affect the `getSenderAddress()` / `getSenderPublicKey()` API?

### Options Under Consideration

1. **Extend the existing base class** — override the methods that don't apply, accept some awkward null/empty returns for signature-related methods.

2. **Create a parallel base class** — a `FrameTransactionBase` that shares only the minimal interface with legacy transactions.

3. **Refactor the base class** — make the base class more generic to accommodate both signed and frame-based transactions. This would be the cleanest but most invasive change.

*Decision will be documented once implementation begins.*

## EVM Frame Loop Placement

### Context

The frame execution loop needs to live somewhere in the VM/EVM stack. Options include:

1. **In the VM (`runTx`)** — the loop is part of transaction processing, before/around the EVM call
2. **In the EVM (`runCall`)** — the loop is a new execution mode within the EVM itself
3. **In a dedicated module** — a `FrameExecutor` that orchestrates between the VM and EVM

### Key Considerations

- The loop needs access to both transaction data (for `TXPARAM`) and EVM execution (for running frames)
- Approval state is transaction-scoped, not call-scoped
- The warm/cold journal sharing and transient storage isolation happen at the EVM level
- `ORIGIN` behavior changes need to be wired in at the EVM level

*Decision will be documented once implementation begins.*
