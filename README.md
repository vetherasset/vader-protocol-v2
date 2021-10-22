# vader-monorepo

The Vader monorepo (internal)

## Setup

Node version that should be utilized is 12.16.2, other versions can show unwarranted errors. For Node.JS version management, `nvm` is recommended.

```shell
npm i

# put your wallet seed here
touch .secret

# put your environment variables here
cp .env.sample .env
```

## Deploy

```shell
# deploy (run migration script from x to y)
npx truffle migrate -f x --to y --network kovan

# verify contract
npx truffle run verify MyContract --network kovan
```

## Networks & Addresses

### Kovan

-   Vether: [0x438f70Ab08AB3F74833c439643C3fC1939cE2929](https://kovan.etherscan.io/address/0x438f70Ab08AB3F74833c439643C3fC1939cE2929)
-   Vader: [0x1E6F42f04D64D55ec08d6D4e6A7CB4a235E1c742](https://kovan.etherscan.io/address/0x1E6F42f04D64D55ec08d6D4e6A7CB4a235E1c742)
-   Converter: [0x8e7A48fC00cF9541392FB820628Ca730b6badf3e](https://kovan.etherscan.io/address/0x8e7A48fC00cF9541392FB820628Ca730b6badf3e)
-   LinearVesting: [0x0031e708132089B3ed866495d5838273ea27B0ee](https://kovan.etherscan.io/address/0x0031e708132089B3ed866495d5838273ea27B0ee)
-   VaderMath: [0x55Bab235490a097653Dd12f10982Dd577705e994](https://kovan.etherscan.io/address/0x55Bab235490a097653Dd12f10982Dd577705e994)
-   VaderPoolFactory: [0xa2b26Aa8fE7b5C0D1C9288c372F49f576bae4e4b](https://kovan.etherscan.io/address/0xa2b26Aa8fE7b5C0D1C9288c372F49f576bae4e4b)
-   VaderRouter: [0x9C7a0c281Eb192859b41353b1bE682f6F3eD3bEA](https://kovan.etherscan.io/address/0x9C7a0c281Eb192859b41353b1bE682f6F3eD3bEA)
-   VaderReserve: [0x3C5d480d3a0CC4e62f557e2A2c546aE9110CB987](https://kovan.etherscan.io/address/0x3C5d480d3a0CC4e62f557e2A2c546aE9110CB987)
-   USDV: [0x6b645db074f05775363d9b315c82cbb3A5337C50](https://kovan.etherscan.io/address/0x6b645db074f05775363d9b315c82cbb3A5337C50)
-   Vault (Mock): [0x267acDF7EeC7fbD4FE6aD25449B98045180073A8](https://kovan.etherscan.io/address/0x267acDF7EeC7fbD4FE6aD25449B98045180073A8)
-   GovernorAlpha: [0x4055F28E1D0dc6b170f5c2D9075aA8e420b6092A](https://kovan.etherscan.io/address/0x4055F28E1D0dc6b170f5c2D9075aA8e420b6092A)
-   Timelock: [0xDf6CeAdA2f7cd83C040574362b91EA198Fc6f464](https://kovan.etherscan.io/address/0xDf6CeAdA2f7cd83C040574362b91EA198Fc6f464)
