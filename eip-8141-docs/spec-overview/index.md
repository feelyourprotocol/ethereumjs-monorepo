# Spec Overview

::: danger 🤖 AI-Generated Content
This documentation is AI-generated and updated frequently. Cross-reference with the [actual EIP](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md). See the [home page](/) for the full disclaimer.
:::

This section provides a structured walkthrough of [EIP-8141 "Frame Transaction"](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md), broken down into digestible pieces for implementers and anyone who wants to understand what this proposal actually does.

**Based on:** EIP-8141 at commit [`ee66073`](https://github.com/ethereum/EIPs/commit/ee66073462f5c0f5db43353b5ce4183a72157327) (March 13, 2026)

## The Big Picture

EIP-8141 introduces a new [EIP-2718](https://eips.ethereum.org/EIPS/eip-2718) transaction type (`0x06`) called the **Frame Transaction**. Its core innovation is replacing the monolithic transaction model — where a single ECDSA signature controls validation, execution, and gas payment — with a **multi-frame architecture** where each of these concerns can be handled independently by arbitrary EVM code.

### Why?

1. **Post-quantum readiness** — Ethereum's current transaction model is fundamentally tied to the secp256k1 elliptic curve. Frame transactions provide a native off-ramp to any cryptographic system, including PQ-secure ones.

2. **Account abstraction, natively** — Rather than bolting AA onto the protocol via entry-point contracts (ERC-4337) or delegation (EIP-7702), frame transactions make it a first-class protocol feature. An account is simply an address with code.

3. **Gas abstraction** — Third parties can sponsor gas payments, users can pay in ERC-20 tokens, and the payment logic is fully programmable.

## Key Concepts at a Glance

| Concept | Summary |
|---|---|
| **Frame** | A single unit of execution within a frame transaction. Each frame has a mode, target, gas limit, and data. |
| **Frame Modes** | `DEFAULT` (0), `VERIFY` (1), `SENDER` (2) — determines caller identity and execution semantics. |
| **APPROVE opcode** | New opcode that signals sender authorization and/or gas payment commitment. |
| **TXPARAM opcode** | Introspection opcode for reading transaction and frame metadata. |
| **FRAMEDATALOAD / FRAMEDATACOPY** | Opcodes for cross-frame data access. |
| **Entry Point** | System address `0xaa` used as caller for `DEFAULT` and `VERIFY` frames. |
| **Default Code** | Built-in logic for EOAs using frame transactions (ECDSA + P256 support). |

## Constants

| Name | Value |
|---|---|
| `FRAME_TX_TYPE` | `0x06` |
| `FRAME_TX_INTRINSIC_COST` | `15000` |
| `ENTRY_POINT` | `address(0xaa)` |
| `MAX_FRAMES` | `10^3` |

## Section Guide

Dive deeper into each aspect of the spec:

- [**Transaction Structure**](./transaction-structure) — RLP encoding, fields, constraints, receipts, signature hash.
- [**Frame Modes**](./frame-modes) — DEFAULT, VERIFY, SENDER modes and approval bits.
- [**New Opcodes**](./opcodes) — APPROVE, TXPARAM, FRAMEDATALOAD, FRAMEDATACOPY.
- [**Execution Behavior**](./execution-behavior) — The frame execution loop, cross-frame interactions, and validation flow.
- [**Gas Accounting**](./gas-accounting) — How gas limits, fees, and refunds work across frames.
- [**Default Code (EOA)**](./default-code) — How EOAs without deployed code interact with frame transactions.
