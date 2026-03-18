/**
 * EIP-8141 SENDER Frame — Batch Calls
 *
 * Demonstrates SENDER mode default code executing multiple calls
 * in a single frame transaction. After VERIFY+APPROVE, the SENDER
 * frame decodes an RLP list of [target, value, data] tuples and
 * executes each call in sequence from the sender account.
 */

import { Common, Hardfork, Mainnet } from '@ethereumjs/common'
import { RLP } from '@ethereumjs/rlp'
import { type FrameEIP8141TxData, createFrameEIP8141Tx } from '@ethereumjs/tx'
import {
  Account,
  Address,
  BIGINT_0,
  bigIntToUnpaddedBytes,
  concatBytes,
  hexToBytes,
  privateToPublic,
  publicToAddress,
} from '@ethereumjs/util'
import { keccak256 } from 'ethereum-cryptography/keccak.js'
import { secp256k1 } from 'ethereum-cryptography/secp256k1.js'

import { createVM, runTx } from '../../src/index.ts'

const PRIVATE_KEY = hexToBytes('0x' + 'ab'.repeat(32))
const PUBLIC_KEY = privateToPublic(PRIVATE_KEY)
const SENDER_ADDR = new Address(publicToAddress(PUBLIC_KEY))

function buildVerifyData(scope: number, sigHash: Uint8Array, privateKey: Uint8Array): Uint8Array {
  const byte0 = ((scope & 0xf) << 4) | 0x00
  const dataWithoutSig = new Uint8Array([byte0])
  const hash = keccak256(concatBytes(sigHash, dataWithoutSig))

  const sig = secp256k1.sign(hash, privateKey.slice(0, 32))
  const rBytes = bigIntToUnpaddedBytes(sig.r)
  const sBytes = bigIntToUnpaddedBytes(sig.s)
  const rPadded = new Uint8Array(32)
  rPadded.set(rBytes, 32 - rBytes.length)
  const sPadded = new Uint8Array(32)
  sPadded.set(sBytes, 32 - sBytes.length)

  return concatBytes(new Uint8Array([byte0, sig.recovery + 27]), rPadded, sPadded)
}

async function main() {
  const common = new Common({ chain: Mainnet, hardfork: Hardfork.Prague, eips: [8141] })
  const vm = await createVM({ common })

  // Fund sender
  const initialBalance = BigInt('1000000000000000000') // 1 ETH
  await vm.stateManager.putAccount(SENDER_ADDR, new Account(0n, initialBalance))

  console.log('EIP-8141 Batch Call Frame Transaction')
  console.log('=====================================')
  console.log(`Sender: ${SENDER_ADDR.toString()}`)
  console.log(`Initial balance: ${initialBalance}`)

  // Three recipients for batch transfer
  const recipients = [
    { addr: new Address(hexToBytes('0x' + 'a1'.repeat(20))), value: BigInt(100) },
    { addr: new Address(hexToBytes('0x' + 'b2'.repeat(20))), value: BigInt(200) },
    { addr: new Address(hexToBytes('0x' + 'c3'.repeat(20))), value: BigInt(300) },
  ]

  // Build SENDER frame data: RLP-encoded batch of [to, value, data]
  const calls = recipients.map((r) => [
    r.addr.bytes,
    bigIntToUnpaddedBytes(r.value),
    new Uint8Array(0),
  ])
  const senderRlp = RLP.encode(calls)
  const senderFrameData = concatBytes(new Uint8Array([0x00]), senderRlp)

  const txData: FrameEIP8141TxData = {
    chainId: 1n,
    nonce: 0n,
    sender: SENDER_ADDR.toString() as `0x${string}`,
    maxPriorityFeePerGas: 1n,
    maxFeePerGas: 100n,
    maxFeePerBlobGas: 0n,
    frames: [
      [new Uint8Array([1]), new Uint8Array(0), bigIntToUnpaddedBytes(50000n), new Uint8Array(0)],
      [new Uint8Array([2]), new Uint8Array(0), bigIntToUnpaddedBytes(500000n), senderFrameData],
    ],
  }

  const txPlaceholder = createFrameEIP8141Tx(txData, { common })
  const sigHash = txPlaceholder.getHashedMessageToSign()
  const verifyData = buildVerifyData(0x2, sigHash, PRIVATE_KEY)

  const rawFrames = (txPlaceholder as any).frames as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ][]
  rawFrames[0][3] = verifyData

  const tx = createFrameEIP8141Tx({ ...txData, frames: rawFrames }, { common })

  console.log(`\nTransaction type: ${tx.type} (Frame Transaction)`)
  console.log(`Frame count: ${(tx as any).frames.length}`)
  console.log(`Batch calls in SENDER frame: ${recipients.length}`)

  try {
    const result = await runTx(vm, {
      tx: tx as any,
      skipBalance: true,
      skipNonce: true,
      skipHardForkValidation: true,
    })

    console.log(`\nExecution result:`)
    console.log(`  Total gas spent: ${result.totalGasSpent}`)

    for (const r of recipients) {
      const acc = await vm.stateManager.getAccount(r.addr)
      console.log(`  ${r.addr.toString()} balance: ${acc?.balance ?? BIGINT_0}`)
    }

    const senderAfter = await vm.stateManager.getAccount(SENDER_ADDR)
    console.log(`\n  Sender balance after: ${senderAfter!.balance}`)
    console.log(`  Sender nonce after: ${senderAfter!.nonce}`)
  } catch (e: any) {
    console.error(`Execution error: ${e.message}`)
  }
}

main().catch(console.error)
