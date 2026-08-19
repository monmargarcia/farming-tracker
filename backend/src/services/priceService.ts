import axios from 'axios'

const DEFILLAMA_URL = 'https://coins.llama.fi/prices/current/coingecko:ethereum'

// Get the current ETH price in USD from DeFiLlama
// Used to convert on-chain gas costs (ETH) into the USD figure the dashboard tracks
export async function getEthPriceUsd(): Promise<number | null> {
  try {
    const res = await axios.get(DEFILLAMA_URL, { timeout: 10_000 })
    const price = res.data?.coins?.['coingecko:ethereum']?.price
    return typeof price === 'number' ? price : null
  } catch (err) {
    console.error('[PriceService] Failed to fetch ETH price:', err instanceof Error ? err.message : err)
    return null
  }
}
