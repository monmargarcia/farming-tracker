import axios from 'axios'

const ALCHEMY_URL = process.env.ALCHEMY_RPC_URL!

interface Transfer {
  hash: string
  from: string
  to: string
  value: string
  asset: string
  blockNum: string
  metadata: { blockTimestamp: string }
}

// Get recent outgoing transactions for a wallet (EVM)
// Used to auto-detect gas costs and confirm activity happened on-chain
export async function getWalletTransfers(address: string): Promise<Transfer[]> {
  try {
    const res = await axios.post(ALCHEMY_URL, {
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [{
        fromBlock: '0x0',
        fromAddress: address,
        category: ['external', 'erc20'],
        withMetadata: true,
        maxCount: '0x14', // last 20 txs
        order: 'desc',
      }],
    })
    return res.data?.result?.transfers ?? []
  } catch (err) {
    console.error('[WalletService] Failed to fetch transfers:', err instanceof Error ? err.message : err)
    return []
  }
}

// Get ETH balance for a wallet
export async function getEthBalance(address: string): Promise<string> {
  try {
    const res = await axios.post(ALCHEMY_URL, {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })
    const balanceHex = res.data?.result ?? '0x0'
    const balanceWei = BigInt(balanceHex)
    const balanceEth = Number(balanceWei) / 1e18
    return balanceEth.toFixed(6)
  } catch (err) {
    console.error('[WalletService] Failed to fetch balance:', err instanceof Error ? err.message : err)
    return '0'
  }
}

// Get gas cost in USD for a transaction hash
export async function getGasCostUsd(txHash: string, ethPriceUsd: number): Promise<number> {
  try {
    const res = await axios.post(ALCHEMY_URL, {
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    })
    const receipt = res.data?.result
    if (!receipt) return 0

    const gasUsed = BigInt(receipt.gasUsed)
    const gasPrice = BigInt(receipt.effectiveGasPrice)
    const gasCostWei = gasUsed * gasPrice
    const gasCostEth = Number(gasCostWei) / 1e18
    return gasCostEth * ethPriceUsd
  } catch (err) {
    console.error('[WalletService] Failed to fetch gas cost:', err instanceof Error ? err.message : err)
    return 0
  }
}
