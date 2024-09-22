import { useEffect } from 'react'
import { getChainsConfig, type ChainInfo } from '@safe-global/safe-gateway-typescript-sdk'
import useAsync, { type AsyncResult } from '../useAsync'
import { logError, Errors } from '@/services/exceptions'
import { airdaoChainInfo } from './airdaoChainInfo'

const getConfigs = async (): Promise<ChainInfo[]> => {
  const data = await getChainsConfig()
  const defaultChains = data.results || []
  defaultChains.push(airdaoChainInfo)
  return defaultChains
}

export const useLoadChains = (): AsyncResult<ChainInfo[]> => {
  const [data, error, loading] = useAsync<ChainInfo[]>(getConfigs, [])

  // Log errors
  useEffect(() => {
    if (error) {
      logError(Errors._620, error.message)
    }
  }, [error])

  return [data, error, loading]
}

export default useLoadChains
