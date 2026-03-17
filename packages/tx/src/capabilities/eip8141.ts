import { RLP } from '@ethereumjs/rlp'
import { BIGINT_0, EthereumJSErrorWithoutCode, bytesToBigInt } from '@ethereumjs/util'

import type { EIP8141CompatibleTx } from '../types.ts'

/**
 * Validates static constraints on the frames list per the EIP-8141 spec.
 */
export function validateFrames(tx: EIP8141CompatibleTx): void {
  const frames = tx.frames
  const maxFrames = Number(tx.common.param('maxFrames'))

  if (frames.length === 0) {
    throw EthereumJSErrorWithoutCode('EIP-8141: frames list must not be empty')
  }
  if (frames.length > maxFrames) {
    throw EthereumJSErrorWithoutCode(
      `EIP-8141: frames count ${frames.length} exceeds MAX_FRAMES (${maxFrames})`,
    )
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    if (!Array.isArray(frame) || frame.length !== 4) {
      throw EthereumJSErrorWithoutCode(
        `EIP-8141: frame ${i} must be a 4-element array [mode, target, gas_limit, data]`,
      )
    }
    const mode = bytesToBigInt(frame[0]) & 0xffn
    if (mode > 2n) {
      throw EthereumJSErrorWithoutCode(
        `EIP-8141: frame ${i} has invalid mode ${mode} (must be 0, 1, or 2)`,
      )
    }
    const target = frame[1]
    if (target.length !== 0 && target.length !== 20) {
      throw EthereumJSErrorWithoutCode(
        `EIP-8141: frame ${i} target must be 20 bytes or empty (null)`,
      )
    }
  }
}

/**
 * Computes the calldata cost of the RLP-encoded frames (the "data gas").
 * This uses standard EVM calldata pricing: 4 gas/zero-byte, 16 gas/non-zero-byte.
 */
export function getDataGas(tx: EIP8141CompatibleTx): bigint {
  const txDataZero = tx.common.param('txDataZeroGas')
  const txDataNonZero = tx.common.param('txDataNonZeroGas')

  const rlpFrames = RLP.encode(tx.frames)
  let cost = BIGINT_0
  for (let i = 0; i < rlpFrames.length; i++) {
    cost += rlpFrames[i] === 0 ? txDataZero : txDataNonZero
  }
  return cost
}

/**
 * Returns the EIP-8141 intrinsic gas: FRAME_TX_INTRINSIC_COST + calldata cost.
 * Does NOT include per-frame gas limits (those are accounted for in computeGasLimit).
 */
export function getIntrinsicGas(tx: EIP8141CompatibleTx): bigint {
  const frameTxIntrinsicCost = tx.common.param('frameTxIntrinsicCost')
  return frameTxIntrinsicCost + getDataGas(tx)
}

/**
 * Computes the total gas limit per the EIP-8141 spec:
 * FRAME_TX_INTRINSIC_COST + calldata_cost(rlp(frames)) + sum(frame.gas_limit)
 */
export function computeGasLimit(tx: EIP8141CompatibleTx): bigint {
  let frameGasSum = BIGINT_0
  for (const frame of tx.frames) {
    frameGasSum += bytesToBigInt(frame[2])
  }
  return getIntrinsicGas(tx) + frameGasSum
}
