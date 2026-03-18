/**
 * EIP-8141 Frame Execution Context
 *
 * Holds a reference to the actual FrameEIP8141Tx plus mutable runtime
 * state needed during frame execution. The EVM stores this as an
 * optional property — set by the VM before the frame loop, cleared after.
 */

import type { FrameEIP8141Tx } from '@ethereumjs/tx'
import type { Address, PrefixedHexString } from '@ethereumjs/util'

export const FRAME_MODE = {
  DEFAULT: 0,
  VERIFY: 1,
  SENDER: 2,
} as const

export const ENTRY_POINT_ADDRESS = '0x00000000000000000000000000000000000000aa' as PrefixedHexString

export interface ParsedFrame {
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

/**
 * Mutable runtime state that evolves during frame execution.
 * Separated from the immutable tx object for clarity.
 */
export interface FrameExecutionState {
  parsedFrames: ParsedFrame[]
  currentFrameIndex: number
  senderApproved: boolean
  payerApproved: boolean
  payer?: Address
  approveCalledInCurrentFrame: boolean
  frameResults: FrameResult[]
  totalGasCost: bigint
  totalBlobGasCost: bigint
}

/**
 * The frame execution context set on the EVM during EIP-8141 frame tx processing.
 * Combines the immutable transaction with mutable execution state.
 */
export interface FrameExecutionContext {
  tx: FrameEIP8141Tx
  state: FrameExecutionState
}
