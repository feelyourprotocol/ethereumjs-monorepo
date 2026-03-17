/**
 * EIP-8141 Frame Transaction — Generic Shared Tests
 *
 * Tests behavior that Frame TX shares with other tx types:
 * Common initialization, type registration, serialization round-trip,
 * JSON representation, factory integration.
 */
import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { bytesToHex, hexToBytes } from '@ethereumjs/util'
import { assert, describe, it } from 'vitest'

import {
  TransactionType,
  createFrameEIP8141Tx,
  createFrameEIP8141TxFromRLP,
  createTx,
  createTxFromRLP,
  isFrameEIP8141Tx,
} from '../../src/index.ts'

import type { TxData } from '../../src/8141/tx.ts'

const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })

const sender = hexToBytes(`0x${'aa'.repeat(20)}`)

function getMinimalTxData(override: Partial<TxData> = {}): TxData {
  return {
    nonce: 0,
    sender,
    frames: [
      [
        new Uint8Array([1]),
        new Uint8Array(0),
        new Uint8Array([0x01, 0x00, 0x00]),
        new Uint8Array([0x20, 0x01]),
      ],
    ],
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 10n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
    ...override,
  }
}

describe('[FrameEIP8141Tx] Generic Shared Behavior', () => {
  it('should initialize with correct transaction type', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.equal(tx.type, TransactionType.FrameEIP8141)
    assert.equal(tx.type, 6)
  })

  it('should pass type guard', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isTrue(isFrameEIP8141Tx(tx))
  })

  it('should require EIP-8141 on Common', () => {
    const noEIPCommon = new Common({ chain: Mainnet, hardfork: Hardfork.Prague })
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData(), { common: noEIPCommon })
    }, 'EIP-8141 not enabled on Common')
  })

  it('should set chain ID from Common', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.equal(tx.chainId, common.chainId())
  })

  it('should reject mismatched chain ID', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ chainId: 999n }), { common })
    }, 'does not match')
  })

  it('serialize() / deserialize() round-trip', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    const serialized = tx.serialize()

    assert.equal(serialized[0], TransactionType.FrameEIP8141)

    const restored = createFrameEIP8141TxFromRLP(serialized, { common })
    assert.equal(restored.nonce, tx.nonce)
    assert.equal(restored.maxFeePerGas, tx.maxFeePerGas)
    assert.equal(restored.maxPriorityFeePerGas, tx.maxPriorityFeePerGas)
    assert.equal(restored.maxFeePerBlobGas, tx.maxFeePerBlobGas)
    assert.equal(restored.frames.length, tx.frames.length)
    assert.equal(bytesToHex(restored.sender.bytes), bytesToHex(tx.sender.bytes))
  })

  it('should produce valid JSON', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    const json = tx.toJSON()

    assert.isDefined(json.type)
    assert.isDefined(json.chainId)
    assert.isDefined(json.nonce)
    assert.isDefined(json.maxFeePerGas)
    assert.isDefined(json.maxPriorityFeePerGas)
    assert.isDefined(json.maxFeePerBlobGas)
    assert.isDefined(json.gasLimit)
    assert.isArray(json.blobVersionedHashes)
  })

  it('should produce a stable hash', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    const hash1 = tx.hash()
    const hash2 = tx.hash()
    assert.deepEqual(hash1, hash2)
  })

  it('factory createTx should create FrameEIP8141Tx', () => {
    const tx = createTx({ ...getMinimalTxData(), type: TransactionType.FrameEIP8141 }, { common })
    assert.isTrue(isFrameEIP8141Tx(tx))
  })

  it('factory createTxFromRLP should decode FrameEIP8141Tx', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    const serialized = tx.serialize()
    const restored = createTxFromRLP(serialized, { common })
    assert.isTrue(isFrameEIP8141Tx(restored))
  })

  it('should reject maxFeePerGas < maxPriorityFeePerGas', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ maxFeePerGas: 1n, maxPriorityFeePerGas: 10n }), {
        common,
      })
    }, 'maxFeePerGas cannot be less than maxPriorityFeePerGas')
  })

  it('should support the correct capabilities', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isTrue(tx.supports(1559))
    assert.isTrue(tx.supports(2718))
    assert.isTrue(tx.supports(8141))
    assert.isFalse(tx.supports(2930))
    assert.isFalse(tx.supports(7702))
  })

  it('getIntrinsicGas returns value > FRAME_TX_INTRINSIC_COST', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isTrue(tx.getIntrinsicGas() >= 15000n)
  })

  it('gasLimit includes intrinsic cost + frame gas sum', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    const frameGasSum = 0x10000n
    assert.isTrue(tx.gasLimit >= tx.getIntrinsicGas() + frameGasSum)
  })

  it('getUpfrontCost calculates correctly', () => {
    const tx = createFrameEIP8141Tx(
      getMinimalTxData({ maxFeePerGas: 100n, maxPriorityFeePerGas: 10n }),
      { common },
    )
    const baseFee = 50n
    const cost = tx.getUpfrontCost(baseFee)
    assert.isTrue(cost > 0n)
    assert.isTrue(cost === tx.gasLimit * (10n + baseFee))
  })
})
