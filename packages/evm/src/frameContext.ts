import type { Address, PrefixedHexString } from '@ethereumjs/util'

/**
 * EIP-8141 Frame Transaction Context
 *
 * Generic interface with no dependency on @ethereumjs/tx.
 * The VM populates this from the transaction object and sets it
 * on the EVM before starting the frame execution loop.
 */

export const FRAME_MODE = {
  DEFAULT: 0,
  VERIFY: 1,
  SENDER: 2,
} as const

export const ENTRY_POINT_ADDRESS = '0x00000000000000000000000000000000000000aa' as PrefixedHexString

export interface FrameData {
  mode: number
  target: Address | null
  gasLimit: bigint
  data: Uint8Array
}

export interface FrameResult {
  status: number
  gasUsed: bigint
  returnValue: Uint8Array
}

export interface FrameTransactionContext {
  txType: number
  chainId: bigint
  nonce: bigint
  sender: Address
  maxPriorityFeePerGas: bigint
  maxFeePerGas: bigint
  maxFeePerBlobGas: bigint
  blobVersionedHashes: PrefixedHexString[]
  sigHash: Uint8Array

  frames: FrameData[]

  currentFrameIndex: number
  senderApproved: boolean
  payerApproved: boolean
  payer?: Address
  approveCalledInCurrentFrame: boolean

  frameResults: FrameResult[]

  totalGasCost: bigint
  totalBlobGasCost: bigint
}
