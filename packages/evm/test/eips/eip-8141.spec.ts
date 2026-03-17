import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import {
  Account,
  Address,
  BIGINT_0,
  BIGINT_1,
  bytesToBigInt,
  equalsBytes,
  hexToBytes,
} from '@ethereumjs/util'
import { assert, describe, it } from 'vitest'

import {
  ENTRY_POINT_ADDRESS,
  FRAME_MODE,
  type FrameTransactionContext,
  createEVM,
} from '../../src/index.ts'

function createCommonWith8141(): Common {
  return new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
}

function createFrameContext(
  overrides: Partial<FrameTransactionContext> = {},
): FrameTransactionContext {
  const sender = new Address(hexToBytes('0x' + 'aa'.repeat(20)))
  return {
    txType: 6,
    chainId: 1n,
    nonce: 0n,
    sender,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 10n,
    maxFeePerBlobGas: 0n,
    blobVersionedHashes: [],
    sigHash: new Uint8Array(32),
    frames: [
      {
        mode: FRAME_MODE.VERIFY,
        target: sender,
        gasLimit: 100000n,
        data: new Uint8Array(0),
      },
    ],
    currentFrameIndex: 0,
    senderApproved: false,
    payerApproved: false,
    approveCalledInCurrentFrame: false,
    frameResults: [],
    totalGasCost: 1000000n,
    totalBlobGasCost: 0n,
    ...overrides,
  }
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
    const ctx = createFrameContext()
    ;(evm as any).frameTransactionContext = ctx

    // PUSH1 0x00 (in2), PUSH1 0x00 (param), TXPARAM
    const code = hexToBytes('0x60006000b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.length, 1)
    assert.equal(result.runState!.stack.pop(), 6n)
    ;(evm as any).frameTransactionContext = undefined
  })

  it('should return nonce (param 0x01)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    const ctx = createFrameContext({ nonce: 42n })
    ;(evm as any).frameTransactionContext = ctx

    const code = hexToBytes('0x60006001b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.pop(), 42n)
    ;(evm as any).frameTransactionContext = undefined
  })

  it('should return current frame index (param 0x10)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    const ctx = createFrameContext({ currentFrameIndex: 3 })
    ;(evm as any).frameTransactionContext = ctx

    const code = hexToBytes('0x60006010b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.pop(), 3n)
    ;(evm as any).frameTransactionContext = undefined
  })

  it('should return frame count (param 0x09)', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    const ctx = createFrameContext()
    ;(evm as any).frameTransactionContext = ctx

    const code = hexToBytes('0x60006009b0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isUndefined(result.exceptionError)
    assert.equal(result.runState!.stack.pop(), 1n)
    ;(evm as any).frameTransactionContext = undefined
  })

  it('should halt on invalid param', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })
    const ctx = createFrameContext()
    ;(evm as any).frameTransactionContext = ctx

    // Invalid param 0xFF
    const code = hexToBytes('0x600060ffb0')
    const result = await evm.runCode!({ code, gasLimit: 100000n })

    assert.isDefined(result.exceptionError)
    ;(evm as any).frameTransactionContext = undefined
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

    const senderAddr = new Address(hexToBytes('0x' + 'bb'.repeat(20)))
    const senderAccount = new Account(0n, 10000000n)
    await evm.stateManager.putAccount(senderAddr, senderAccount)

    const ctx = createFrameContext({
      sender: senderAddr,
      frames: [
        {
          mode: FRAME_MODE.VERIFY,
          target: senderAddr,
          gasLimit: 100000n,
          data: new Uint8Array(0),
        },
      ],
      totalGasCost: 500000n,
    })
    ;(evm as any).frameTransactionContext = ctx

    // PUSH1 0x02 (scope), APPROVE
    const code = hexToBytes('0x6002aa')
    const result = await evm.runCall({
      to: senderAddr,
      caller: new Address(hexToBytes('0x' + '00'.repeat(19) + 'aa')),
      gasLimit: 100000n,
      data: new Uint8Array(0),
      code,
    })

    assert.isTrue(ctx.senderApproved)
    assert.isTrue(ctx.payerApproved)
    assert.isTrue(ctx.approveCalledInCurrentFrame)
    assert.isTrue(equalsBytes(ctx.payer!.bytes, senderAddr.bytes))

    const updatedAccount = await evm.stateManager.getAccount(senderAddr)
    assert.equal(updatedAccount!.nonce, 1n)
    assert.equal(updatedAccount!.balance, 10000000n - 500000n)
    ;(evm as any).frameTransactionContext = undefined
  })

  it('should revert if ADDRESS != frame.target', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })

    const senderAddr = new Address(hexToBytes('0x' + 'bb'.repeat(20)))
    const wrongAddr = new Address(hexToBytes('0x' + 'cc'.repeat(20)))
    await evm.stateManager.putAccount(wrongAddr, new Account(0n, 10000000n))

    const ctx = createFrameContext({
      sender: senderAddr,
      frames: [
        {
          mode: FRAME_MODE.VERIFY,
          target: senderAddr,
          gasLimit: 100000n,
          data: new Uint8Array(0),
        },
      ],
    })
    ;(evm as any).frameTransactionContext = ctx

    const code = hexToBytes('0x6002aa')
    const result = await evm.runCall({
      to: wrongAddr,
      caller: new Address(hexToBytes('0x' + '00'.repeat(19) + 'aa')),
      gasLimit: 100000n,
      code,
    })

    assert.isFalse(ctx.senderApproved)
    assert.isFalse(ctx.payerApproved)
    ;(evm as any).frameTransactionContext = undefined
  })

  it('should revert if insufficient balance', async () => {
    const common = createCommonWith8141()
    const evm = await createEVM({ common })

    const senderAddr = new Address(hexToBytes('0x' + 'bb'.repeat(20)))
    await evm.stateManager.putAccount(senderAddr, new Account(0n, 100n))

    const ctx = createFrameContext({
      sender: senderAddr,
      frames: [
        {
          mode: FRAME_MODE.VERIFY,
          target: senderAddr,
          gasLimit: 100000n,
          data: new Uint8Array(0),
        },
      ],
      totalGasCost: 500000n,
    })
    ;(evm as any).frameTransactionContext = ctx

    const code = hexToBytes('0x6002aa')
    const result = await evm.runCall({
      to: senderAddr,
      caller: new Address(hexToBytes('0x' + '00'.repeat(19) + 'aa')),
      gasLimit: 100000n,
      code,
    })

    assert.isFalse(ctx.senderApproved)
    assert.isFalse(ctx.payerApproved)
    ;(evm as any).frameTransactionContext = undefined
  })
})

describe('EIP-8141: FrameTransactionContext isolation', () => {
  it('EVM should have no frameTransactionContext by default', async () => {
    const evm = await createEVM()
    assert.isUndefined((evm as any).frameTransactionContext)
  })
})
