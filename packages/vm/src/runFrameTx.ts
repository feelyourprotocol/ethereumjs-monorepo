/**
 * EIP-8141 Frame Transaction Execution
 *
 * Implements the frame execution loop and default code for EOA accounts.
 * The EVM holds a FrameExecutionContext = { tx, state } during execution.
 */

import { ENTRY_POINT_ADDRESS, FRAME_MODE } from '@ethereumjs/evm'
import type { ExecResult, FrameExecutionState, FrameResult, ParsedFrame } from '@ethereumjs/evm'
import { RLP } from '@ethereumjs/rlp'
import type { FrameBytes, FrameEIP8141Tx } from '@ethereumjs/tx'
import {
  Account,
  Address,
  BIGINT_0,
  BIGINT_1,
  EthereumJSErrorWithoutCode,
  bytesToBigInt,
  bytesToHex,
  concatBytes,
  ecrecover,
  equalsBytes,
  hexToBytes,
  publicToAddress,
} from '@ethereumjs/util'
import { keccak_256 } from '@noble/hashes/sha3.js'

import type { Block } from '@ethereumjs/block'
import type { RunTxOpts, RunTxResult } from './types.ts'
import type { VM } from './vm.ts'

const ECRECOVER_GAS = BigInt(3000)
const DEFAULT_CODE_OVERHEAD = BigInt(100)

/**
 * Parse raw FrameBytes from the tx into ParsedFrame objects.
 */
function parseFrames(tx: FrameEIP8141Tx): ParsedFrame[] {
  return tx.frames.map((f: FrameBytes) => {
    const modeVal = f[0].length === 0 ? 0 : Number(bytesToBigInt(f[0]))
    return {
      mode: modeVal & 0xff,
      target: f[1].length === 0 ? null : new Address(f[1]),
      gasLimit: f[2].length === 0 ? BIGINT_0 : bytesToBigInt(f[2]),
      data: f[3],
    }
  })
}

/**
 * Execute an EIP-8141 frame transaction through the frame execution loop.
 *
 * Gas cost deduction and nonce increment are handled by APPROVE (or the default
 * code equivalent), not by the VM upfront.
 */
export async function runFrameTransaction(
  vm: VM,
  tx: FrameEIP8141Tx,
  gasPrice: bigint,
  blobGasPrice: bigint,
  intrinsicGas: bigint,
  block: Block | undefined,
  _opts: RunTxOpts,
): Promise<RunTxResult> {
  const evm = vm.evm
  const caller = tx.getSenderAddress()
  const parsedFrames = parseFrames(tx)

  const blobCount = tx.blobVersionedHashes.length
  const blobGasPerBlob = blobCount > 0 ? vm.common.param('blobGasPerBlob') : BIGINT_0
  const totalBlobGas = blobGasPerBlob * BigInt(blobCount)
  const totalGasCost = tx.gasLimit * gasPrice
  const totalBlobGasCost = totalBlobGas * blobGasPrice

  const state: FrameExecutionState = {
    parsedFrames,
    currentFrameIndex: 0,
    senderApproved: false,
    payerApproved: false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost,
    totalBlobGasCost,
  }

  evm.frameExecutionContext = { tx, state }

  let totalFrameGasUsed = BIGINT_0
  const entryPoint = new Address(hexToBytes(ENTRY_POINT_ADDRESS))
  const allLogs: any[] = []
  let txInvalid = false
  let invalidReason = ''

  try {
    for (let i = 0; i < parsedFrames.length; i++) {
      state.currentFrameIndex = i
      state.approveCalledInCurrentFrame = false
      const frame = parsedFrames[i]

      if (frame.mode === FRAME_MODE.SENDER && !state.senderApproved) {
        txInvalid = true
        invalidReason = 'SENDER frame executed before sender_approved'
        break
      }

      const frameTarget = frame.target ?? caller
      const frameCaller = frame.mode === FRAME_MODE.SENDER ? caller : entryPoint

      const code = await vm.stateManager.getCode(frameTarget)
      const hasCode = code.length > 0

      let frameResult: FrameResult

      if (!hasCode) {
        frameResult = await runDefaultCode(
          vm,
          tx,
          state,
          frame,
          frameCaller,
          frameTarget,
          gasPrice,
          block,
        )
      } else {
        const result = await evm.runCall({
          block,
          gasPrice,
          caller: frameCaller,
          gasLimit: frame.gasLimit,
          to: frameTarget,
          value: BIGINT_0,
          data: frame.data,
          origin: frameCaller,
          blobVersionedHashes: tx.blobVersionedHashes.map(bytesToHex),
        })

        const reverted = result.execResult.exceptionError !== undefined
        frameResult = {
          status: reverted ? 0 : 1,
          gasUsed: result.execResult.executionGasUsed,
          returnValue: result.execResult.returnValue,
        }
        if (result.execResult.logs) {
          allLogs.push(...result.execResult.logs)
        }
      }

      state.frameResults.push(frameResult)
      totalFrameGasUsed += frameResult.gasUsed

      if (frame.mode === FRAME_MODE.VERIFY && !state.approveCalledInCurrentFrame) {
        txInvalid = true
        invalidReason = 'VERIFY frame did not call APPROVE'
        break
      }
    }

    if (!txInvalid && !state.payerApproved) {
      txInvalid = true
      invalidReason = 'payer_approved not set after executing all frames'
    }
  } finally {
    evm.frameExecutionContext = undefined
  }

  if (txInvalid) {
    throw EthereumJSErrorWithoutCode(`EIP-8141 frame transaction invalid: ${invalidReason}`)
  }

  const totalGasSpent = intrinsicGas + totalFrameGasUsed

  const result: RunTxResult = {
    execResult: {
      executionGasUsed: totalFrameGasUsed,
      exceptionError: undefined,
      gas: BIGINT_0,
      gasUsed: totalFrameGasUsed,
      returnValue: new Uint8Array(0),
      logs: allLogs.length > 0 ? allLogs : undefined,
      runState: undefined as any,
    } as ExecResult,
    totalGasSpent,
    amountSpent: BIGINT_0,
    receipt: undefined as any,
    bloom: undefined as any,
    gasRefund: BIGINT_0,
    blockGasSpent: totalGasSpent,
  } as RunTxResult

  return result
}

/**
 * Default code execution for EOA accounts (no deployed code).
 */
async function runDefaultCode(
  vm: VM,
  tx: FrameEIP8141Tx,
  execState: FrameExecutionState,
  frame: ParsedFrame,
  _frameCaller: Address,
  frameTarget: Address,
  gasPrice: bigint,
  block: Block | undefined,
): Promise<FrameResult> {
  if (frame.mode === FRAME_MODE.VERIFY) {
    return runDefaultCodeVerify(vm, tx, execState, frame, frameTarget)
  }
  if (frame.mode === FRAME_MODE.SENDER) {
    return runDefaultCodeSender(vm, tx, execState, frame, frameTarget, gasPrice, block)
  }
  return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
}

/**
 * Default code VERIFY mode: ECDSA signature verification + APPROVE.
 */
async function runDefaultCodeVerify(
  vm: VM,
  tx: FrameEIP8141Tx,
  execState: FrameExecutionState,
  frame: ParsedFrame,
  frameTarget: Address,
): Promise<FrameResult> {
  const gasUsed = ECRECOVER_GAS + DEFAULT_CODE_OVERHEAD
  if (frame.gasLimit < gasUsed) {
    return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
  }

  if (!equalsBytes(frameTarget.bytes, tx.sender.bytes)) {
    return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
  }

  if (frame.data.length < 1) {
    return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
  }

  const firstByte = frame.data[0]
  const scope = (firstByte >> 4) & 0xf
  const sigType = firstByte & 0xf

  if (sigType === 0x0) {
    if (frame.data.length !== 66) {
      return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
    }
    const v = frame.data[1]
    const r = frame.data.slice(2, 34)
    const s = frame.data.slice(34, 66)
    const dataWithoutSig = frame.data.slice(0, 1)
    const sigHash = tx.getHashedMessageToSign()
    const keccakFn = vm.common.customCrypto.keccak256 ?? keccak_256
    const hash = keccakFn(concatBytes(sigHash, dataWithoutSig))

    let recoveredAddress: Address
    try {
      const pubKey = ecrecover(hash, BigInt(v), r, s)
      recoveredAddress = new Address(publicToAddress(pubKey))
    } catch {
      return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
    }

    if (!equalsBytes(recoveredAddress.bytes, frameTarget.bytes)) {
      return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
    }
  } else {
    return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
  }

  const approveResult = await executeApprove(vm, tx, execState, frameTarget, scope)
  if (!approveResult) {
    return { status: 0, gasUsed, returnValue: new Uint8Array(0) }
  }

  execState.approveCalledInCurrentFrame = true
  return { status: 1, gasUsed, returnValue: new Uint8Array(0) }
}

/**
 * Default code SENDER mode: decode RLP calls and execute them.
 */
async function runDefaultCodeSender(
  vm: VM,
  tx: FrameEIP8141Tx,
  _execState: FrameExecutionState,
  frame: ParsedFrame,
  frameTarget: Address,
  gasPrice: bigint,
  block: Block | undefined,
): Promise<FrameResult> {
  if (frame.data.length < 1) {
    return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
  }

  const firstNibble = (frame.data[0] >> 4) & 0xf
  if (firstNibble !== 0x0) {
    return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
  }

  if (!equalsBytes(frameTarget.bytes, tx.sender.bytes)) {
    return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
  }

  const rlpData = frame.data.slice(1)
  let calls: any[]
  try {
    const decoded = RLP.decode(rlpData)
    calls = decoded as any[]
  } catch {
    return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
  }

  let remainingGas = frame.gasLimit
  let totalGasUsed = BIGINT_0
  const allLogs: any[] = []

  for (const call of calls) {
    if (!Array.isArray(call) || call.length < 3) {
      return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
    }
    const [callTargetBytes, callValueBytes, callDataBytes] = call as [
      Uint8Array,
      Uint8Array,
      Uint8Array,
    ]
    const callTarget = new Address(callTargetBytes)
    const callValue = callValueBytes.length === 0 ? BIGINT_0 : bytesToBigInt(callValueBytes)
    const callData = callDataBytes ?? new Uint8Array(0)

    const result = await vm.evm.runCall({
      block,
      gasPrice,
      caller: tx.sender,
      gasLimit: remainingGas,
      to: callTarget,
      value: callValue,
      data: callData,
      origin: tx.sender,
    })

    const callGasUsed = result.execResult.executionGasUsed
    totalGasUsed += callGasUsed
    remainingGas = remainingGas > callGasUsed ? remainingGas - callGasUsed : BIGINT_0

    if (result.execResult.logs) {
      allLogs.push(...result.execResult.logs)
    }

    if (result.execResult.exceptionError) {
      return { status: 0, gasUsed: frame.gasLimit, returnValue: new Uint8Array(0) }
    }
  }

  return {
    status: 1,
    gasUsed: totalGasUsed,
    returnValue: new Uint8Array(0),
  }
}

/**
 * Execute APPROVE logic directly (for default code, not via opcode).
 * Returns true on success, false if conditions fail.
 */
async function executeApprove(
  vm: VM,
  tx: FrameEIP8141Tx,
  execState: FrameExecutionState,
  target: Address,
  scope: number,
): Promise<boolean> {
  const stateManager = vm.stateManager

  if (scope === 0x0) {
    if (execState.senderApproved) return false
    if (!equalsBytes(target.bytes, tx.sender.bytes)) return false
    execState.senderApproved = true
    return true
  }

  if (scope === 0x1) {
    if (execState.payerApproved) return false
    if (!execState.senderApproved) return false
    let account = await stateManager.getAccount(target)
    if (account === undefined) account = new Account()
    if (account.balance < execState.totalGasCost + execState.totalBlobGasCost) return false
    account.nonce += BIGINT_1
    account.balance -= execState.totalGasCost + execState.totalBlobGasCost
    await vm.evm.journal.putAccount(target, account)
    execState.payerApproved = true
    execState.payer = target
    return true
  }

  if (scope === 0x2) {
    if (execState.senderApproved || execState.payerApproved) return false
    if (!equalsBytes(target.bytes, tx.sender.bytes)) return false
    let account = await stateManager.getAccount(target)
    if (account === undefined) account = new Account()
    if (account.balance < execState.totalGasCost + execState.totalBlobGasCost) return false
    execState.senderApproved = true
    account.nonce += BIGINT_1
    account.balance -= execState.totalGasCost + execState.totalBlobGasCost
    await vm.evm.journal.putAccount(target, account)
    execState.payerApproved = true
    execState.payer = target
    return true
  }

  return false
}
