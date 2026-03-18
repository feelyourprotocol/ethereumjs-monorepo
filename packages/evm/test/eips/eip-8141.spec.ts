import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import {
  Account,
  Address,
  BIGINT_0,
  bigIntToUnpaddedBytes,
  bytesToBigInt,
  equalsBytes,
  hexToBytes,
} from '@ethereumjs/util'
import { assert, describe, it } from 'vitest'

import {
  FRAME_MODE,
  type FrameExecutionContext,
  type FrameExecutionState,
  type ParsedFrame,
  createEVM,
} from '../../src/index.ts'

function createCommonWith8141(): Common {
  return new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
}

/**
 * Helper: build a FrameExecutionContext from a real tx + state overrides.
 */
function createFrameContext(
  common: Common,
  overrides: {
    senderHex?: string
    nonce?: bigint
    frames?: [number, string | null, bigint, Uint8Array][]
    currentFrameIndex?: number
    senderApproved?: boolean
    payerApproved?: boolean
    totalGasCost?: bigint
  } = {},
): FrameExecutionContext {
  const senderHex = overrides.senderHex ?? '0x' + 'aa'.repeat(20)
  const nonce = overrides.nonce ?? 0n

  const rawFrames: [Uint8Array, Uint8Array, Uint8Array, Uint8Array][] = (
    overrides.frames ?? [[FRAME_MODE.VERIFY, null, 100000n, new Uint8Array(0)]]
  ).map(([mode, target, gasLimit, data]) => [
    new Uint8Array([mode]),
    target !== null ? hexToBytes(target as `0x${string}`) : new Uint8Array(0),
    bigIntToUnpaddedBytes(gasLimit),
    data,
  ])

  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce,
    sender: senderHex as `0x${string}`,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 10n,
    maxFeePerBlobGas: 0n,
    frames: rawFrames,
  }

  const tx = createFrameEIP8141Tx(txData, { common })

  const parsedFrames: ParsedFrame[] = rawFrames.map(([modeBytes, targetBytes, gasBytes, data]) => ({
    mode: modeBytes[0],
    target: targetBytes.length === 0 ? null : new Address(targetBytes),
    gasLimit: gasBytes.length === 0 ? BIGINT_0 : bytesToBigInt(gasBytes),
    data,
  }))

  const state: FrameExecutionState = {
    parsedFrames,
    currentFrameIndex: overrides.currentFrameIndex ?? 0,
    senderApproved: overrides.senderApproved ?? false,
    payerApproved: overrides.payerApproved ?? false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost: overrides.totalGasCost ?? 1000000n,
    totalBlobGasCost: 0n,
  }

  return { tx, state }
}

describe('EIP-8141: Opcode Registration', () => {
  it('should register APPROVE, TXPARAM, FRAMEDATALOAD, FRAMEDATACOPY when EIP-8141 is active', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    const opcodeList = evm.getActiveOpcodes()!

    assert.isDefined(opcodeList.get(0xaa), 'APPROVE should be registered')
    assert.isDefined(opcodeList.get(0xb0), 'TXPARAM should be registered')
    assert.isDefined(opcodeList.get(0xb1), 'FRAMEDATALOAD should be registered')
    assert.isDefined(opcodeList.get(0xb2), 'FRAMEDATACOPY should be registered')

    assert.equal(opcodeList.get(0xaa)!.name, 'APPROVE')
    assert.equal(opcodeList.get(0xb0)!.name, 'TXPARAM')
    assert.equal(opcodeList.get(0xb1)!.name, 'FRAMEDATALOAD')
    assert.equal(opcodeList.get(0xb2)!.name, 'FRAMEDATACOPY')
  })

  it('should NOT register EIP-8141 opcodes when EIP is not active', async () => {
    const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague })
    const evm = await createEVM({ common })
    const opcodeList = evm.getActiveOpcodes()!

    const approve = opcodeList.get(0xaa)
    assert.isTrue(
      approve === undefined || approve.name === 'INVALID',
      'APPROVE should not be registered without EIP-8141',
    )
  })
})

describe('EIP-8141: TXPARAM opcode', () => {
  it('should return tx type (param 0x00)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    evm.frameExecutionContext = createFrameContext(common)

    const code = hexToBytes('0x60006000b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.length, 1)
    assert.equal(result.runState!.stack.pop(), 6n)
    evm.frameExecutionContext = undefined
  })

  it('should return nonce (param 0x01)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    evm.frameExecutionContext = createFrameContext(common, { nonce: 42n })

    const code = hexToBytes('0x60006001b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.pop(), 42n)
    evm.frameExecutionContext = undefined
  })

  it('should return current frame index (param 0x10)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    evm.frameExecutionContext = createFrameContext(common, { currentFrameIndex: 3 })

    const code = hexToBytes('0x60006010b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.pop(), 3n)
    evm.frameExecutionContext = undefined
  })

  it('should return frame count (param 0x09)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    evm.frameExecutionContext = createFrameContext(common)

    const code = hexToBytes('0x60006009b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.pop(), 1n)
    evm.frameExecutionContext = undefined
  })

  it('should halt on invalid param', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    evm.frameExecutionContext = createFrameContext(common)

    const code = hexToBytes('0x600060ffb0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isDefined(result.exceptionError)
    evm.frameExecutionContext = undefined
  })

  it('should halt when no frame context is set', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })

    const code = hexToBytes('0x60006000b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isDefined(result.exceptionError)
  })
})

describe('EIP-8141: APPROVE opcode', () => {
  it('scope 0x2: should set sender+payer approved and modify state', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })

    const senderHex = '0x' + 'bb'.repeat(20)
    const senderAddr = new Address(hexToBytes(senderHex as `0x${string}`))
    const senderAccount = new Account(0n, 10000000n)
    await evm.stateManager.putAccount(senderAddr, senderAccount)

    const fctx = createFrameContext(common, {
      senderHex,
      frames: [[FRAME_MODE.VERIFY, null, 100000n, new Uint8Array(0)]],
      totalGasCost: 500000n,
    })
    evm.frameExecutionContext = fctx

    const code = hexToBytes('0x6002aa')
    await evm.runCall({
      to: senderAddr,
      caller: new Address(hexToBytes(('0x' + '00'.repeat(19) + 'aa') as `0x${string}`)),
      gasLimit: 100000n,
      data: new Uint8Array(0),
      code,
    })

    assert.isTrue(fctx.state.senderApproved)
    assert.isTrue(fctx.state.payerApproved)
    assert.isTrue(fctx.state.approveCalledInCurrentFrame)
    assert.isTrue(equalsBytes(fctx.state.payer!.bytes, senderAddr.bytes))

    const updatedAccount = await evm.stateManager.getAccount(senderAddr)
    assert.equal(updatedAccount!.nonce, 1n)
    assert.equal(updatedAccount!.balance, 10000000n - 500000n)
    evm.frameExecutionContext = undefined
  })

  it('should revert if ADDRESS != frame.target', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })

    const senderHex = '0x' + 'bb'.repeat(20)
    const wrongAddr = new Address(hexToBytes(('0x' + 'cc'.repeat(20)) as `0x${string}`))
    await evm.stateManager.putAccount(wrongAddr, new Account(0n, 10000000n))

    const fctx = createFrameContext(common, {
      senderHex,
      frames: [[FRAME_MODE.VERIFY, null, 100000n, new Uint8Array(0)]],
    })
    evm.frameExecutionContext = fctx

    const code = hexToBytes('0x6002aa')
    await evm.runCall({
      to: wrongAddr,
      caller: new Address(hexToBytes(('0x' + '00'.repeat(19) + 'aa') as `0x${string}`)),
      gasLimit: 100000n,
      code,
    })

    assert.isFalse(fctx.state.senderApproved)
    assert.isFalse(fctx.state.payerApproved)
    evm.frameExecutionContext = undefined
  })

  it('should revert if insufficient balance', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })

    const senderHex = '0x' + 'bb'.repeat(20)
    const senderAddr = new Address(hexToBytes(senderHex as `0x${string}`))
    await evm.stateManager.putAccount(senderAddr, new Account(0n, 100n))

    const fctx = createFrameContext(common, {
      senderHex,
      frames: [[FRAME_MODE.VERIFY, null, 100000n, new Uint8Array(0)]],
      totalGasCost: 500000n,
    })
    evm.frameExecutionContext = fctx

    const code = hexToBytes('0x6002aa')
    await evm.runCall({
      to: senderAddr,
      caller: new Address(hexToBytes(('0x' + '00'.repeat(19) + 'aa') as `0x${string}`)),
      gasLimit: 100000n,
      code,
    })

    assert.isFalse(fctx.state.senderApproved)
    assert.isFalse(fctx.state.payerApproved)
    evm.frameExecutionContext = undefined
  })
})

describe('EIP-8141: FrameExecutionContext isolation', () => {
  it('EVM should have no frameExecutionContext by default', async () => {
    const evm = await createEVM()
    assert.isUndefined(evm.frameExecutionContext)
  })
})
