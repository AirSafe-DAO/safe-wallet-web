import { FEATURES, GAS_PRICE_TYPE, RPC_AUTHENTICATION, type ChainInfo } from '@safe-global/safe-gateway-typescript-sdk'

export const airdaoChainInfo: ChainInfo = {
  transactionService: 'http://127.0.0.1:8000/api/v1/',
  chainId: '22040',
  chainName: 'AirDAO Testnet',
  shortName: 'ambtest',
  l2: false,
  isTestnet: true,
  description: 'AirDAO Testnet',
  chainLogoUri: 'https://assets.coingecko.com/coins/images/1041/standard/amb.png', // Updated with provided logo
  rpcUri: {
    authentication: RPC_AUTHENTICATION.NO_AUTHENTICATION,
    value: 'https://network.ambrosus-test.io',
  },
  safeAppsRpcUri: {
    authentication: RPC_AUTHENTICATION.NO_AUTHENTICATION,
    value: 'https://network.ambrosus-test.io',
  },
  publicRpcUri: {
    authentication: RPC_AUTHENTICATION.NO_AUTHENTICATION,
    value: 'https://network.ambrosus-test.io',
  },
  blockExplorerUriTemplate: {
    address: 'https://testnet.airdao.io/explorer/address/{{address}}',
    txHash: 'https://testnet.airdao.io/explorer/tx/{{txHash}}',
    api: 'https://testnet.airdao.io/explorer',
  },
  nativeCurrency: {
    name: 'AirDAO',
    symbol: 'AMB',
    decimals: 18,
    logoUri: 'https://assets.coingecko.com/coins/images/1041/standard/amb.png', // Updated with provided logo
  },
  theme: {
    textColor: '#ffffff',
    backgroundColor: '#000000',
  },
  ensRegistryAddress: null,
  gasPrice: [
    {
      type: GAS_PRICE_TYPE.FIXED,
      weiValue: '0',
    },
  ],
  disabledWallets: [],
  features: [
    FEATURES.CONTRACT_INTERACTION,
    FEATURES.SAFE_APPS,
    FEATURES.DOMAIN_LOOKUP,
    FEATURES.EIP1271,
    FEATURES.EIP1559,
    // 'CONTRACT_INTERACTION',
    // 'OFFCHAIN_SIGNATURES',
    // 'SAFE_APPS',
    // Add or remove features based on actual support
  ],
  balancesProvider: {
    chainName: 'AirDAO Testnet',
    enabled: true,
  },
  contractAddresses: {
    safeSingletonAddress: '0xc0cFF0D4C6b1EC02EEF42D831D1C10f75759EfE0',
    safeProxyFactoryAddress: '0x3e030482A27371eF35CCc5a60Cf38A888CFe985b',
    multiSendAddress: '0x738981Fc297322d93bB77C1cF23dC248AdCEc50B',
    multiSendCallOnlyAddress: '0x01cB07dD74B36a836FAd6ccEc8ac888a78Ef7b40',
    fallbackHandlerAddress: '0x53bD692DeFfd097b2955168eF4b382db5De32790',
    signMessageLibAddress: '0x2CF56a62c51430cc07008C461375ae3Abc9F71f5',
    createCallAddress: '0x898687FE361147385E99Bb86c71885e05DE11946',
    simulateTxAccessorAddress: '0xB6aA5bce7e43b0cca8Cf945d08F4c78e30Ad6479',
    safeWebAuthnSignerFactoryAddress: null,
  },
}
