/**
 * EIP-8141 Frame Transaction — Unique/Divergent Behavior Tests
 *
 * Tests behavior that is fundamentally different from other tx types:
 * explicit sender, no ECDSA signatures, frame validation, computed gasLimit,
 * signature hash with VERIFY data elision, blob field constraints.
 */
import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { bytesToBigInt, bytesToHex, hexToBytes } from '@ethereumjs/util'
import { assert, describe, it } from 'vitest'

import { createFrameEIP8141Tx } from '../../src/index.ts'

import type { FrameBytes, TxData } from '../../src/8141/tx.ts'

const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })

const senderHex = `0x${'aa'.repeat(20)}` as `0x${string}`
const sender = hexToBytes(senderHex)

function makeFrame(
  mode: number,
  target: Uint8Array | null,
  gasLimit: number,
  data: Uint8Array = new Uint8Array(0),
): FrameBytes {
  const modeBytes = mode === 0 ? new Uint8Array(0) : new Uint8Array([mode])
  const targetBytes = target ?? new Uint8Array(0)
  const gasBytes = new Uint8Array(
    [gasLimit >> 8, gasLimit & 0xff].filter((_, i, a) => i > 0 || a[0] !== 0),
  )
  return [modeBytes, targetBytes, gasBytes.length > 0 ? gasBytes : new Uint8Array([0]), data]
}

function getMinimalTxData(override: Partial<TxData> = {}): TxData {
  return {
    nonce: 0,
    sender,
    frames: [makeFrame(1, null, 65536, new Uint8Array([0x20, 0x01]))],
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 10n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
    ...override,
  }
}

describe('[FrameEIP8141Tx] Unique Behavior — Explicit Sender', () => {
  it('getSenderAddress returns the explicit sender', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.equal(bytesToHex(tx.getSenderAddress().bytes), senderHex)
    assert.equal(bytesToHex(tx.sender.bytes), senderHex)
  })

  it('rejects sender that is not 20 bytes', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ sender: new Uint8Array(19) }), { common })
    }, '20-byte address')

    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ sender: new Uint8Array(21) }), { common })
    }, '20-byte address')
  })
})

describe('[FrameEIP8141Tx] Unique Behavior — No Signatures', () => {
  it('isSigned() always returns false', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isFalse(tx.isSigned())
  })

  it('verifySignature() returns false', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isFalse(tx.verifySignature())
  })

  it('sign() throws', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.throws(() => {
      tx.sign(new Uint8Array(32))
    }, 'does not use traditional signing')
  })

  it('addSignature() throws', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.throws(() => {
      tx.addSignature(0n, 0n, 0n)
    }, 'does not use traditional signatures')
  })

  it('getSenderPublicKey() throws', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.throws(() => {
      tx.getSenderPublicKey()
    }, 'sender is explicit')
  })

  it('v, r, s are all undefined', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isUndefined(tx.v)
    assert.isUndefined(tx.r)
    assert.isUndefined(tx.s)
  })
})

describe('[FrameEIP8141Tx] Unique Behavior — Frames', () => {
  it('rejects empty frames list', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ frames: [] }), { common })
    }, 'frames list must not be empty')
  })

  it('rejects frame with invalid mode (> 2)', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ frames: [makeFrame(3, null, 1000)] }), { common })
    }, 'invalid mode')
  })

  it('rejects frame with wrong target length', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(
        getMinimalTxData({
          frames: [
            [new Uint8Array([0]), new Uint8Array(10), new Uint8Array([100]), new Uint8Array(0)],
          ],
        }),
        { common },
      )
    }, 'target must be 20 bytes or empty')
  })

  it('accepts null target (empty bytes)', () => {
    const tx = createFrameEIP8141Tx(
      getMinimalTxData({ frames: [makeFrame(1, null, 1000, new Uint8Array([0x01]))] }),
      { common },
    )
    assert.equal(tx.frames[0][1].length, 0)
  })

  it('accepts 20-byte target', () => {
    const target = hexToBytes(`0x${'bb'.repeat(20)}`)
    const tx = createFrameEIP8141Tx(getMinimalTxData({ frames: [makeFrame(0, target, 1000)] }), {
      common,
    })
    assert.equal(tx.frames[0][1].length, 20)
  })

  it('accepts multiple frames', () => {
    const target = hexToBytes(`0x${'bb'.repeat(20)}`)
    const tx = createFrameEIP8141Tx(
      getMinimalTxData({
        frames: [
          makeFrame(1, null, 65536, new Uint8Array([0x01])),
          makeFrame(2, null, 100000),
          makeFrame(0, target, 200000),
        ],
      }),
      { common },
    )
    assert.equal(tx.frames.length, 3)
  })

  it('all frame modes (0, 1, 2) are accepted', () => {
    for (const mode of [0, 1, 2]) {
      assert.doesNotThrow(() => {
        createFrameEIP8141Tx(
          getMinimalTxData({ frames: [makeFrame(mode, null, 1000, new Uint8Array([0x01]))] }),
          { common },
        )
      }, `mode ${mode} should be valid`)
    }
  })
})

describe('[FrameEIP8141Tx] Unique Behavior — No Top-Level to/value/data', () => {
  it('to is undefined', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isUndefined(tx.to)
  })

  it('value is zero', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.equal(tx.value, 0n)
  })

  it('data is empty', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.equal(tx.data.length, 0)
  })

  it('toCreationAddress() throws', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.throws(() => {
      tx.toCreationAddress()
    }, 'does not support contract creation')
  })
})

describe('[FrameEIP8141Tx] Unique Behavior — Computed Gas Limit', () => {
  it('gasLimit = intrinsic + sum(frame gas limits)', () => {
    const frame1Gas = new Uint8Array([0x01, 0x00, 0x00])
    const frame2Gas = new Uint8Array([0x01, 0x86, 0xa0])
    const tx = createFrameEIP8141Tx(
      getMinimalTxData({
        frames: [
          [new Uint8Array([1]), new Uint8Array(0), frame1Gas, new Uint8Array([0x01])],
          [new Uint8Array([2]), new Uint8Array(0), frame2Gas, new Uint8Array(0)],
        ],
      }),
      { common },
    )
    const intrinsic = tx.getIntrinsicGas()
    const expectedFrameGasSum = bytesToBigInt(frame1Gas) + bytesToBigInt(frame2Gas)
    assert.equal(tx.gasLimit, intrinsic + expectedFrameGasSum)
  })

  it('intrinsic cost uses 15000 (not 21000)', () => {
    const tx = createFrameEIP8141Tx(getMinimalTxData(), { common })
    assert.isTrue(tx.getIntrinsicGas() >= 15000n)
    assert.isTrue(tx.getIntrinsicGas() < 21000n + 15000n)
  })
})

describe('[FrameEIP8141Tx] Unique Behavior — Signature Hash', () => {
  it('getMessageToSign zeroes VERIFY frame data', () => {
    const verifyData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05])
    const senderData = new Uint8Array([0x0a, 0x0b, 0x0c])
    const tx = createFrameEIP8141Tx(
      getMinimalTxData({
        frames: [makeFrame(1, null, 65536, verifyData), makeFrame(2, null, 100000, senderData)],
      }),
      { common },
    )
    const sigMsg = tx.getMessageToSign()

    // Modify only the SENDER frame data and compare — sig hash should change
    const tx2 = createFrameEIP8141Tx(
      getMinimalTxData({
        frames: [
          makeFrame(1, null, 65536, verifyData),
          makeFrame(2, null, 100000, new Uint8Array([0xff, 0xfe])),
        ],
      }),
      { common },
    )
    const sigMsg2 = tx2.getMessageToSign()
    assert.notDeepEqual(sigMsg, sigMsg2, 'SENDER frame data affects sig hash')

    // Modify only the VERIFY frame data — sig hash should NOT change
    const tx3 = createFrameEIP8141Tx(
      getMinimalTxData({
        frames: [
          makeFrame(1, null, 65536, new Uint8Array([0xff, 0xff, 0xff])),
          makeFrame(2, null, 100000, senderData),
        ],
      }),
      { common },
    )
    const sigMsg3 = tx3.getMessageToSign()
    assert.deepEqual(sigMsg, sigMsg3, 'VERIFY frame data does NOT affect sig hash')
  })
})

describe('[FrameEIP8141Tx] Unique Behavior — Blob Fields', () => {
  it('rejects non-zero maxFeePerBlobGas with empty blob hashes', () => {
    assert.throws(() => {
      createFrameEIP8141Tx(getMinimalTxData({ maxFeePerBlobGas: 100n, blobVersionedHashes: [] }), {
        common,
      })
    }, 'max_fee_per_blob_gas must be 0')
  })

  it('accepts zero maxFeePerBlobGas with empty blob hashes', () => {
    assert.doesNotThrow(() => {
      createFrameEIP8141Tx(getMinimalTxData({ maxFeePerBlobGas: 0n, blobVersionedHashes: [] }), {
        common,
      })
    })
  })
})
