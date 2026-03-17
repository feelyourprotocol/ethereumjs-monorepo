import { RLP } from '@ethereumjs/rlp'
import {
  EthereumJSErrorWithoutCode,
  bytesToBigInt,
  bytesToHex,
  equalsBytes,
  validateNoLeadingZeroes,
} from '@ethereumjs/util'

import { TransactionType } from '../types.ts'
import { txTypeBytes, validateNotArray } from '../util/internal.ts'

import { FrameEIP8141Tx } from './tx.ts'

import type { TxOptions } from '../types.ts'
import type { FrameBytes, TxData, TxValuesArray } from './tx.ts'

/**
 * Instantiate a Frame Transaction from a data dictionary.
 *
 * Format: { chainId, nonce, sender, frames, maxPriorityFeePerGas, maxFeePerGas,
 *           maxFeePerBlobGas, blobVersionedHashes }
 *
 * Notes:
 * - `chainId` will be set automatically if not provided
 * - No signature fields — validation happens through VERIFY frames
 */
export function createFrameEIP8141Tx(txData: TxData, opts: TxOptions = {}) {
  return new FrameEIP8141Tx(txData, opts)
}

/**
 * Create a Frame Transaction from an array of byte-encoded values ordered
 * according to the RLP encoding defined in EIP-8141.
 *
 * Format: `[chain_id, nonce, sender, frames, max_priority_fee_per_gas,
 *           max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]`
 */
export function createFrameEIP8141TxFromBytesArray(values: TxValuesArray, opts: TxOptions = {}) {
  if (values.length !== 8) {
    throw EthereumJSErrorWithoutCode(
      `Invalid EIP-8141 transaction. Expected 8 values, got ${values.length}.`,
    )
  }

  const [
    chainId,
    nonce,
    sender,
    frames,
    maxPriorityFeePerGas,
    maxFeePerGas,
    maxFeePerBlobGas,
    blobVersionedHashes,
  ] = values

  validateNotArray({ chainId })
  validateNoLeadingZeroes({ nonce, maxPriorityFeePerGas, maxFeePerGas, maxFeePerBlobGas })

  return new FrameEIP8141Tx(
    {
      chainId: bytesToBigInt(chainId),
      nonce,
      sender,
      frames: (frames ?? []) as FrameBytes[],
      maxPriorityFeePerGas,
      maxFeePerGas,
      maxFeePerBlobGas,
      blobVersionedHashes: blobVersionedHashes ?? [],
    },
    opts,
  )
}

/**
 * Instantiate a Frame Transaction from a RLP-serialized tx.
 *
 * Format: `0x06 || rlp([chain_id, nonce, sender, frames, max_priority_fee_per_gas,
 *           max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes])`
 */
export function createFrameEIP8141TxFromRLP(serialized: Uint8Array, opts: TxOptions = {}) {
  if (equalsBytes(serialized.subarray(0, 1), txTypeBytes(TransactionType.FrameEIP8141)) === false) {
    throw EthereumJSErrorWithoutCode(
      `Invalid serialized tx input: not an EIP-8141 transaction (wrong tx type, expected: ${
        TransactionType.FrameEIP8141
      }, received: ${bytesToHex(serialized.subarray(0, 1))})`,
    )
  }

  const values = RLP.decode(serialized.subarray(1))

  if (!Array.isArray(values)) {
    throw EthereumJSErrorWithoutCode('Invalid serialized tx input: must be array')
  }

  return createFrameEIP8141TxFromBytesArray(values as TxValuesArray, opts)
}
