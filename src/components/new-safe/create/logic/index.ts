import type { SafeVersion } from '@safe-global/safe-core-sdk-types'
import { type Eip1193Provider, type Provider } from 'ethers'

import { getSafeInfo, type SafeInfo, type ChainInfo, relayTransaction } from '@safe-global/safe-gateway-typescript-sdk'
import {
  getReadOnlyFallbackHandlerContract,
  getReadOnlyGnosisSafeContract,
  getReadOnlyProxyFactoryContract,
} from '@/services/contracts/safeContracts'
import type { UrlObject } from 'url'
import { AppRoutes } from '@/config/routes'
import { SAFE_APPS_EVENTS, trackEvent } from '@/services/analytics'
import { predictSafeAddress, SafeFactory, SafeProvider } from '@safe-global/protocol-kit'
import type Safe from '@safe-global/protocol-kit'
import type { DeploySafeProps } from '@safe-global/protocol-kit'
import { isValidSafeVersion } from '@/hooks/coreSDK/safeCoreSDK'

import { backOff } from 'exponential-backoff'
import { EMPTY_DATA, ZERO_ADDRESS } from '@safe-global/protocol-kit/dist/src/utils/constants'
import { getLatestSafeVersion } from '@/utils/chains'
import { ECOSYSTEM_ID_ADDRESS } from '@/config/constants'
import { airdaoChainInfo } from '@/hooks/loadables/airdaoChainInfo'

export type SafeCreationProps = {
  owners: string[]
  threshold: number
  saltNonce: number
}

const getSafeFactory = async (provider: Eip1193Provider, safeVersion: SafeVersion): Promise<SafeFactory> => {
  if (!isValidSafeVersion(safeVersion)) {
    throw new Error('Invalid Safe version')
  }
  // return (await getProxyFactoryContract(safeVersion)) as any
  try {
    // const factory = new SafeFactory()
    // factory.#provider = provider
    // factory.#signer = signer
    // factory.#safeProvider = await SafeProvider.init(provider, signer, safeVersion, contractNetworks)
    // factory.#safeVersion = safeVersion
    // this.#contractNetworks = contractNetworks
    // const chainId = await this.#safeProvider.getChainId()
    // const customContracts = contractNetworks?.[chainId.toString()]
    // this.#safeProxyFactoryContract = await getProxyFactoryContract({
    //   safeProvider: this.#safeProvider,
    //   safeVersion,
    //   customContracts,
    // })
    // this.#safeContract = await getSafeContract({
    //   safeProvider: this.#safeProvider,
    //   safeVersion,
    //   isL1SafeSingleton,
    //   customContracts,
    // })
    // const safeProvider = await SafeProvider.init(
    //   provider,
    //   undefined,
    //   safeVersion,
    //   airdaoChainInfo.contractAddresses as any,
    // )
    const factory = await SafeFactory.init({
      provider,
      safeVersion,
      contractNetworks: { '22040': airdaoChainInfo.contractAddresses as any },
    })
    console.log('factory addr', await factory.getAddress())
    return factory
  } catch (e) {
    console.error(e)
    throw e
  }
}

/**
 * Create a Safe creation transaction via Core SDK and submits it to the wallet
 */
export const createNewSafe = async (
  provider: Eip1193Provider,
  props: DeploySafeProps,
  safeVersion: SafeVersion,
): Promise<Safe> => {
  const safeFactory = await getSafeFactory(provider, safeVersion)
  return safeFactory.deploySafe(props)
}

/**
 * Compute the new counterfactual Safe address before it is actually created
 */
export const computeNewSafeAddress = async (
  provider: Eip1193Provider,
  props: DeploySafeProps,
  chain: ChainInfo,
  safeVersion?: SafeVersion,
): Promise<string> => {
  // console.log(provider, props, chain, safeVersion)
  const safeProvider = new SafeProvider({ provider })

  try {
    const safe = await predictSafeAddress({
      safeProvider,
      chainId: BigInt(chain.chainId),
      safeAccountConfig: props.safeAccountConfig,
      safeDeploymentConfig: {
        saltNonce: props.saltNonce,
        safeVersion: safeVersion || getLatestSafeVersion(chain),
      },
      customContracts: airdaoChainInfo.contractAddresses as any,
    })
    console.log('predicted', safe)
    return safe
  } catch (e) {
    console.error(e)
    throw e
  }
}

/**
 * Encode a Safe creation transaction NOT using the Core SDK because it doesn't support that
 * This is used for gas estimation.
 */
export const encodeSafeCreationTx = async ({
  owners,
  threshold,
  saltNonce,
  chain,
  safeVersion,
}: SafeCreationProps & { chain: ChainInfo; safeVersion?: SafeVersion }) => {
  const usedSafeVersion = safeVersion ?? getLatestSafeVersion(chain)
  const readOnlySafeContract = await getReadOnlyGnosisSafeContract(chain, usedSafeVersion)
  const readOnlyProxyContract = await getReadOnlyProxyFactoryContract(usedSafeVersion)
  const readOnlyFallbackHandlerContract = await getReadOnlyFallbackHandlerContract(usedSafeVersion)

  const callData = {
    owners,
    threshold,
    to: ZERO_ADDRESS,
    data: EMPTY_DATA,
    fallbackHandler: await readOnlyFallbackHandlerContract.getAddress(),
    paymentToken: ZERO_ADDRESS,
    payment: 0,
    paymentReceiver: ECOSYSTEM_ID_ADDRESS,
  }

  // @ts-ignore union type is too complex
  const setupData = readOnlySafeContract.encode('setup', [
    callData.owners,
    callData.threshold,
    callData.to,
    callData.data,
    callData.fallbackHandler,
    callData.paymentToken,
    callData.payment,
    callData.paymentReceiver,
  ])

  return readOnlyProxyContract.encode('createProxyWithNonce', [
    await readOnlySafeContract.getAddress(),
    setupData,
    BigInt(saltNonce),
  ])
}

export const estimateSafeCreationGas = async (
  chain: ChainInfo,
  provider: Provider,
  from: string,
  safeParams: SafeCreationProps,
  safeVersion?: SafeVersion,
): Promise<bigint> => {
  const readOnlyProxyFactoryContract = await getReadOnlyProxyFactoryContract(safeVersion ?? getLatestSafeVersion(chain))
  const encodedSafeCreationTx = await encodeSafeCreationTx({ ...safeParams, chain })

  const gas = await provider.estimateGas({
    from,
    to: await readOnlyProxyFactoryContract.getAddress(),
    data: encodedSafeCreationTx,
  })

  return gas
}

export const pollSafeInfo = async (chainId: string, safeAddress: string): Promise<SafeInfo> => {
  // exponential delay between attempts for around 4 min
  return backOff(() => getSafeInfo(chainId, safeAddress), {
    startingDelay: 750,
    maxDelay: 20000,
    numOfAttempts: 19,
    retry: (e) => {
      console.info('waiting for client-gateway to provide safe information', e)
      return true
    },
  })
}

export const getRedirect = (
  chainPrefix: string,
  safeAddress: string,
  redirectQuery?: string | string[],
): UrlObject | string => {
  const redirectUrl = Array.isArray(redirectQuery) ? redirectQuery[0] : redirectQuery
  const address = `${chainPrefix}:${safeAddress}`

  // Should never happen in practice
  if (!chainPrefix) return AppRoutes.index

  // Go to the dashboard if no specific redirect is provided
  if (!redirectUrl || !redirectUrl.startsWith(AppRoutes.apps.index)) {
    return { pathname: AppRoutes.home, query: { safe: address } }
  }

  // Otherwise, redirect to the provided URL (e.g. from a Safe App)

  // Track the redirect to Safe App
  trackEvent(SAFE_APPS_EVENTS.SHARED_APP_OPEN_AFTER_SAFE_CREATION)

  // We're prepending the safe address directly here because the `router.push` doesn't parse
  // The URL for already existing query params
  // TODO: Check if we can accomplish this with URLSearchParams or URL instead
  const hasQueryParams = redirectUrl.includes('?')
  const appendChar = hasQueryParams ? '&' : '?'
  return redirectUrl + `${appendChar}safe=${address}`
}

export const relaySafeCreation = async (
  chain: ChainInfo,
  owners: string[],
  threshold: number,
  saltNonce: number,
  version?: SafeVersion,
) => {
  const latestSafeVersion = getLatestSafeVersion(chain)

  const safeVersion = version ?? latestSafeVersion

  const readOnlyProxyFactoryContract = await getReadOnlyProxyFactoryContract(safeVersion)
  const proxyFactoryAddress = await readOnlyProxyFactoryContract.getAddress()
  const readOnlyFallbackHandlerContract = await getReadOnlyFallbackHandlerContract(safeVersion)
  const fallbackHandlerAddress = await readOnlyFallbackHandlerContract.getAddress()
  const readOnlySafeContract = await getReadOnlyGnosisSafeContract(chain, safeVersion)
  const safeContractAddress = await readOnlySafeContract.getAddress()

  const callData = {
    owners,
    threshold,
    to: ZERO_ADDRESS,
    data: EMPTY_DATA,
    fallbackHandler: fallbackHandlerAddress,
    paymentToken: ZERO_ADDRESS,
    payment: 0,
    paymentReceiver: ECOSYSTEM_ID_ADDRESS,
  }

  // @ts-ignore
  const initializer = readOnlySafeContract.encode('setup', [
    callData.owners,
    callData.threshold,
    callData.to,
    callData.data,
    callData.fallbackHandler,
    callData.paymentToken,
    callData.payment,
    callData.paymentReceiver,
  ])

  const createProxyWithNonceCallData = readOnlyProxyFactoryContract.encode('createProxyWithNonce', [
    safeContractAddress,
    initializer,
    BigInt(saltNonce),
  ])

  const relayResponse = await relayTransaction(chain.chainId, {
    to: proxyFactoryAddress,
    data: createProxyWithNonceCallData,
    version: safeVersion,
  })

  return relayResponse.taskId
}
