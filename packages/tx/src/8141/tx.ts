import {
  Address,
  BIGINT_0,
  EthereumJSErrorWithoutCode,
  bigIntToHex,
  bigIntToUnpaddedBytes,
  bytesToBigInt,
  bytesToHex,
  toBytes,
} from '@ethereumjs/util'
import { keccak_256 } from '@noble/hashes/sha3.js'

import * as EIP2718 from '../capabilities/eip2718.ts'
import * as EIP8141 from '../capabilities/eip8141.ts'
import { paramsTx } from '../params.ts'
import { TransactionType } from '../types.ts'
import { getCommon, valueOverflowCheck } from '../util/internal.ts'

import type { Common } from '@ethereumjs/common'
import type {
  Capability,
  FrameEIP8141TxData,
  JSONTx,
  TransactionCache,
  TransactionInterface,
  TxOptions,
} from '../types.ts'

/**
 * A single frame in its RLP-decoded bytes form: [mode, target, gas_limit, data].
 *
 * - mode: execution mode (0=DEFAULT, 1=VERIFY, 2=SENDER); upper bits configure approval constraints
 * - target: 20-byte address or empty bytes (null → tx.sender)
 * - gas_limit: gas allocation for this frame
 * - data: calldata for the frame
 */
export type FrameBytes = [Uint8Array, Uint8Array, Uint8Array, Uint8Array]

export type TxData = FrameEIP8141TxData

/**
 * RLP values array:
 * [chain_id, nonce, sender, frames, max_priority_fee_per_gas, max_fee_per_gas, max_fee_per_blob_gas, blob_versioned_hashes]
 */
export type TxValuesArray = [
  Uint8Array,
  Uint8Array,
  Uint8Array,
  FrameBytes[],
  Uint8Array,
  Uint8Array,
  Uint8Array,
  Uint8Array[],
]

/**
 * EIP-8141 Frame Transaction
 *
 * - TransactionType: 6
 * - EIP: [EIP-8141](https://github.com/ethereum/EIPs/blob/ee66073462f5c0f5db43353b5ce4183a72157327/EIPS/eip-8141.md)
 *
 * Structural deviations from previous tx types (documented in implementation journal):
 *
 * 1. No `to`, `value`, `data` at top level — replaced by `frames`
 * 2. No signature fields (`v`, `r`, `s`) — validation happens in VERIFY frames
 * 3. Explicit `sender` field — not derived from ECDSA signature
 * 4. `gasLimit` is computed from frames, not an explicit field
 * 5. Cannot use `sharedConstructor` — too many assumptions about base fields
 * 6. Breaks the capability interface chain (no EIP-2930 access lists)
 */
export class FrameEIP8141Tx implements TransactionInterface<typeof TransactionType.FrameEIP8141> {
  public type = TransactionType.FrameEIP8141

  // EIP-8141 specific fields (part of the RLP)
  public readonly chainId: bigint
  public readonly nonce!: bigint
  public readonly sender: Address
  public readonly frames: FrameBytes[]
  public readonly maxPriorityFeePerGas: bigint
  public readonly maxFeePerGas: bigint
  public readonly maxFeePerBlobGas: bigint
  public readonly blobVersionedHashes: Uint8Array[]

  // Interface-required fields — computed or set to defaults.
  // gasLimit is derived from frames per spec (not an explicit tx field).
  public readonly gasLimit!: bigint
  // Frame TX has no top-level target/value/data; these live inside individual frames.
  public readonly to?: Address
  public readonly value: bigint = BIGINT_0
  public readonly data: Uint8Array = new Uint8Array(0)
  // Frame TX has no traditional ECDSA signature.
  public readonly v?: bigint
  public readonly r?: bigint
  public readonly s?: bigint

  public readonly common!: Common
  readonly txOptions!: TxOptions
  readonly cache: TransactionCache = {}

  protected activeCapabilities: number[] = []

  /**
   * Constructs a new FrameEIP8141Tx.
   *
   * Note: Cannot use `sharedConstructor` because it assumes top-level `to`, `value`,
   * `data`, `gasLimit`, and `v`/`r`/`s` fields — none of which exist for Frame TX.
   */
  public constructor(txData: TxData, opts: TxOptions = {}) {
    this.common = getCommon(opts.common)
    this.common.updateParams(opts.params ?? paramsTx)
    this.txOptions = opts

    if (!this.common.isActivatedEIP(8141)) {
      throw EthereumJSErrorWithoutCode('EIP-8141 not enabled on Common')
    }

    this.activeCapabilities = [1559, 2718, 8141]

    const {
      chainId,
      nonce,
      sender,
      frames,
      maxPriorityFeePerGas,
      maxFeePerGas,
      maxFeePerBlobGas,
      blobVersionedHashes,
    } = txData

    // Chain ID
    if (chainId !== undefined && bytesToBigInt(toBytes(chainId)) !== this.common.chainId()) {
      throw EthereumJSErrorWithoutCode(
        `Common chain ID ${this.common.chainId()} does not match the derived chain ID ${chainId}`,
      )
    }
    this.chainId = this.common.chainId()

    // Nonce
    this.nonce = bytesToBigInt(toBytes(nonce))
    valueOverflowCheck({ nonce: this.nonce }, 64, true)

    // Sender — explicit 20-byte address (fundamental departure from ECDSA-derived sender)
    const senderBytes = toBytes(sender as Uint8Array)
    if (senderBytes.length !== 20) {
      throw EthereumJSErrorWithoutCode('EIP-8141: sender must be a 20-byte address')
    }
    this.sender = new Address(senderBytes)

    // Frames — validated but otherwise treated as a black box at the tx layer
    this.frames = (frames ?? []) as FrameBytes[]
    EIP8141.validateFrames(this)

    // EIP-1559 fee market fields
    this.maxFeePerGas = bytesToBigInt(toBytes(maxFeePerGas))
    this.maxPriorityFeePerGas = bytesToBigInt(toBytes(maxPriorityFeePerGas))

    valueOverflowCheck({
      maxFeePerGas: this.maxFeePerGas,
      maxPriorityFeePerGas: this.maxPriorityFeePerGas,
    })

    if (this.maxFeePerGas < this.maxPriorityFeePerGas) {
      throw EthereumJSErrorWithoutCode(
        'EIP-8141: maxFeePerGas cannot be less than maxPriorityFeePerGas',
      )
    }

    // EIP-4844 blob fields
    this.maxFeePerBlobGas = bytesToBigInt(toBytes(maxFeePerBlobGas))
    this.blobVersionedHashes = (blobVersionedHashes ?? []).map((h) => toBytes(h as Uint8Array))

    if (this.blobVersionedHashes.length === 0 && this.maxFeePerBlobGas !== BIGINT_0) {
      throw EthereumJSErrorWithoutCode(
        'EIP-8141: max_fee_per_blob_gas must be 0 when no blobs are included',
      )
    }

    // Compute gasLimit from frames per spec:
    // tx_gas_limit = FRAME_TX_INTRINSIC_COST + calldata_cost(rlp(frames)) + sum(frame.gas_limit)
    this.gasLimit = EIP8141.computeGasLimit(this)

    // Interface defaults for fields that don't exist in Frame TX
    this.to = undefined
    this.value = BIGINT_0
    this.data = new Uint8Array(0)

    const freeze = opts?.freeze ?? true
    if (freeze) {
      Object.freeze(this)
    }
  }

  supports(capability: Capability) {
    return this.activeCapabilities.includes(capability)
  }

  /**
   * Returns the calldata cost of the RLP-encoded frames.
   */
  getDataGas(): bigint {
    return EIP8141.getDataGas(this)
  }

  /**
   * Returns the effective priority fee, same calculation as EIP-1559.
   */
  getEffectivePriorityFee(baseFee: bigint): bigint {
    if (baseFee === undefined || baseFee > this.maxFeePerGas) {
      throw EthereumJSErrorWithoutCode('Tx cannot pay baseFee')
    }
    const remainingFee = this.maxFeePerGas - baseFee
    return this.maxPriorityFeePerGas < remainingFee ? this.maxPriorityFeePerGas : remainingFee
  }

  /**
   * Total upfront cost: gasLimit * effectiveGasPrice (no top-level value).
   */
  getUpfrontCost(baseFee: bigint = BIGINT_0): bigint {
    const prio = this.maxPriorityFeePerGas
    const maxBase = this.maxFeePerGas - baseFee
    const inclusionFeePerGas = prio < maxBase ? prio : maxBase
    const gasPrice = inclusionFeePerGas + baseFee
    return this.gasLimit * gasPrice
  }

  /**
   * EIP-8141 intrinsic gas: FRAME_TX_INTRINSIC_COST (15000) + calldata cost.
   * Notably different from the standard 21000 txGas used by all other tx types.
   */
  getIntrinsicGas(): bigint {
    return EIP8141.getIntrinsicGas(this)
  }

  /**
   * Frame TX does not support top-level contract creation.
   */
  toCreationAddress(): never {
    throw EthereumJSErrorWithoutCode('FrameEIP8141Tx does not support contract creation')
  }

  /**
   * Returns the raw RLP values array.
   */
  raw(): TxValuesArray {
    return [
      bigIntToUnpaddedBytes(this.chainId),
      bigIntToUnpaddedBytes(this.nonce),
      this.sender.bytes,
      this.frames,
      bigIntToUnpaddedBytes(this.maxPriorityFeePerGas),
      bigIntToUnpaddedBytes(this.maxFeePerGas),
      bigIntToUnpaddedBytes(this.maxFeePerBlobGas),
      this.blobVersionedHashes,
    ]
  }

  /**
   * Returns the serialized EIP-2718 encoding: `0x06 || rlp(payload)`.
   */
  serialize(): Uint8Array {
    return EIP2718.serialize(this)
  }

  /**
   * Returns the message used for signature hash computation.
   * Per EIP-8141 spec: VERIFY frame data is zeroed before hashing.
   */
  getMessageToSign(): Uint8Array {
    const rawValues = this.raw()
    const frames = rawValues[3]
    const sigFrames = frames.map((frame: FrameBytes): FrameBytes => {
      const mode = bytesToBigInt(frame[0]) & 0xffn
      if (mode === 1n) {
        return [frame[0], frame[1], frame[2], new Uint8Array(0)]
      }
      return frame
    })
    const sigValues: TxValuesArray = [
      rawValues[0],
      rawValues[1],
      rawValues[2],
      sigFrames,
      rawValues[4],
      rawValues[5],
      rawValues[6],
      rawValues[7],
    ]
    return EIP2718.serialize(this, sigValues)
  }

  getHashedMessageToSign(): Uint8Array {
    return EIP2718.getHashedMessageToSign(this)
  }

  /**
   * Computes a keccak hash of the serialized tx.
   * Unlike traditional tx types, this does NOT require a signature.
   */
  public hash(): Uint8Array {
    const keccakFunction = this.common.customCrypto.keccak256 ?? keccak_256

    if (Object.isFrozen(this)) {
      this.cache.hash ??= keccakFunction(this.serialize())
      return this.cache.hash
    }
    return keccakFunction(this.serialize())
  }

  public getMessageToVerifySignature(): Uint8Array {
    return this.getHashedMessageToSign()
  }

  /**
   * Frame TX sender is an explicit field, not recovered from a cryptographic signature.
   */
  public getSenderPublicKey(): Uint8Array {
    throw EthereumJSErrorWithoutCode(
      'FrameEIP8141Tx: sender is explicit, not derived from a signature public key',
    )
  }

  /**
   * Frame TX does not use traditional ECDSA signatures.
   * Validation happens through VERIFY frames during EVM execution.
   */
  addSignature(_v: bigint, _r: Uint8Array | bigint, _s: Uint8Array | bigint): FrameEIP8141Tx {
    throw EthereumJSErrorWithoutCode(
      'FrameEIP8141Tx: does not use traditional signatures; validation happens in VERIFY frames',
    )
  }

  toJSON(): JSONTx {
    return {
      type: bigIntToHex(BigInt(this.type)),
      chainId: bigIntToHex(this.chainId),
      nonce: bigIntToHex(this.nonce),
      gasLimit: bigIntToHex(this.gasLimit),
      maxPriorityFeePerGas: bigIntToHex(this.maxPriorityFeePerGas),
      maxFeePerGas: bigIntToHex(this.maxFeePerGas),
      maxFeePerBlobGas: bigIntToHex(this.maxFeePerBlobGas),
      blobVersionedHashes: this.blobVersionedHashes.map(bytesToHex),
    }
  }

  getValidationErrors(): string[] {
    const errors: string[] = []
    if (this.frames.length === 0) {
      errors.push('EIP-8141: frames list must not be empty')
    }
    return errors
  }

  isValid(): boolean {
    return this.getValidationErrors().length === 0
  }

  /**
   * Frame TX has no traditional ECDSA signature.
   * Always returns false — "signed" in the traditional sense does not apply.
   */
  public isSigned(): boolean {
    return false
  }

  /**
   * Frame TX has no traditional signature to verify.
   * VERIFY frame execution happens at the EVM layer, not here.
   */
  verifySignature(): boolean {
    return false
  }

  /**
   * Returns the explicit sender address (not derived from signature).
   */
  getSenderAddress(): Address {
    return this.sender
  }

  /**
   * Frame TX does not use traditional private-key signing.
   */
  sign(_privateKey: Uint8Array, _extraEntropy?: Uint8Array | boolean): FrameEIP8141Tx {
    throw EthereumJSErrorWithoutCode(
      'FrameEIP8141Tx: does not use traditional signing; validation happens in VERIFY frames',
    )
  }

  public errorStr(): string {
    let hash = ''
    try {
      hash = bytesToHex(this.hash())
    } catch {
      hash = 'error'
    }
    let postfix = `tx type=${this.type} hash=${hash} nonce=${this.nonce} `
    postfix += `sender=${this.sender.toString()} frames=${this.frames.length} `
    postfix += `maxFeePerGas=${this.maxFeePerGas} maxPriorityFeePerGas=${this.maxPriorityFeePerGas}`
    return postfix
  }
}
