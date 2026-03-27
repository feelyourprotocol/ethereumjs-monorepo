# Gas Accounting

Frame transactions introduce a per-frame gas allocation model that differs from the single gas limit of traditional transactions.

## Total Gas Limit

The transaction's total gas limit is the sum of three components:

```
tx_gas_limit = FRAME_TX_INTRINSIC_COST
             + calldata_cost(rlp(tx.frames))
             + sum(frame.gas_limit for all frames)
```

Where:
- `FRAME_TX_INTRINSIC_COST` = **15,000 gas** (lower than the 21,000 for legacy transactions)
- `calldata_cost` follows standard EVM rules: 4 gas per zero byte, 16 gas per non-zero byte
- Each frame contributes its own `gas_limit` to the total

## Fee Calculation

```
tx_fee = tx_gas_limit * effective_gas_price + blob_fees
blob_fees = len(blob_versioned_hashes) * GAS_PER_BLOB * blob_base_fee
```

The `effective_gas_price` follows EIP-1559 rules. Blob fees follow EIP-4844 rules.

## Per-Frame Gas Isolation

Each frame has its own gas budget. This is a significant design choice:

- **Unused gas from one frame is NOT available to subsequent frames**
- Each frame operates within its declared `gas_limit` independently
- A frame that uses less gas than allocated doesn't "donate" the remainder to later frames

This isolation simplifies reasoning about frame execution and prevents one frame's gas usage from affecting another's behavior.

## Gas Refund

After all frames execute, the total refund is:

```
refund = sum(frame.gas_limit for all frames) - total_gas_used
```

This refund is:
1. Returned to the **gas payer** (the account whose `frame.target` called `APPROVE(0x1)` or `APPROVE(0x2)`)
2. Added back to the **block gas pool**

::: warning
This refund mechanism is separate from EIP-3529 storage refunds. The frame gas refund is purely about unused gas allocation.
:::

## Gas Payment Flow

The gas payment timeline in a frame transaction is notably different from legacy transactions:

| Step | Legacy Transaction | Frame Transaction |
|---|---|---|
| **Pre-execution** | Full gas cost deducted from sender | Nothing deducted |
| **During execution** | — | `APPROVE(0x1)` or `APPROVE(0x2)` deducts full gas cost from payer |
| **Post-execution** | Unused gas refunded to sender | Unused gas refunded to payer |

The deferred payment model means the gas payer is not determined until a `VERIFY` frame calls `APPROVE` with a payment scope. This enables the flexible sponsorship patterns that are central to the EIP's design.

## Data Efficiency

For a simple smart account transaction sending ETH, the overhead is approximately **134 bytes** — not much larger than an EIP-1559 transaction. The main extra cost is the explicit sender address and the need to specify destination/amount in calldata rather than in dedicated fields.

Adding a gas sponsorship flow adds roughly **140 bytes** for the sponsor's verification, token transfer, and post-op frames.
