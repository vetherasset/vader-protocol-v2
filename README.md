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

## Test

```
npx ganache-cli
npm test
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

-   Vether: [0x4402A7C8829489705852e54Da50Ebec60C8C86a8](https://kovan.etherscan.io/address/0x4402A7C8829489705852e54Da50Ebec60C8C86a8)
-   Vader: [0x42e05423368A8F937F4cA6463ff3E1Af581226A1](https://kovan.etherscan.io/address/0x42e05423368A8F937F4cA6463ff3E1Af581226A1)
-   Converter: [0x59931212011bF57a466B71257275Ff6D38432Be7](https://kovan.etherscan.io/address/0x59931212011bF57a466B71257275Ff6D38432Be7)
-   LinearVesting: [0x34f08b70a1A32A5c107Af7548F634038ac6CC856](https://kovan.etherscan.io/address/0x34f08b70a1A32A5c107Af7548F634038ac6CC856)
-   VaderReserve: [0x6FB2992DB95CCA4BD7e8969E2AB3f94AAA3565e6](https://kovan.etherscan.io/address/0x6FB2992DB95CCA4BD7e8969E2AB3f94AAA3565e6)
-   USDV: [0x3C35779BaBFbdeC11633dEadda00a558F2875De5](https://kovan.etherscan.io/address/0x3C35779BaBFbdeC11633dEadda00a558F2875De5)

-   VaderPoolV2: [0x53c661c2214833dFC1d309C6d956e6cE8f776D11](https://kovan.etherscan.io/address/0x53c661c2214833dFC1d309C6d956e6cE8f776D11)
-   VaderRouterV2: [0x663CA015052317ef6576C34cA71fc86F470F096c](https://kovan.etherscan.io/address/0x663CA015052317ef6576C34cA71fc86F470F096c)
-   SynthFactory: [0xc4996c9D9438BeDc57c6268A1d77F212924C3Ae9](https://kovan.etherscan.io/address/0xc4996c9D9438BeDc57c6268A1d77F212924C3Ae9)
-   LPWrapper: [0x2Ca66c2Bd91c80AC5CB811ef69d2148298D7dFBC](https://kovan.etherscan.io/address/0x2Ca66c2Bd91c80AC5CB811ef69d2148298D7dFBC)
-   TwapOralce: [0xbC6F88F4F06d781e2cdAE1E2313611c06aE00601](https://kovan.etherscan.io/address/0xbC6F88F4F06d781e2cdAE1E2313611c06aE00601)

-   Vault (Mock): [0xA677a539A170eBC9fd6E6011b726d68099E55EA9](https://kovan.etherscan.io/address/0xA677a539A170eBC9fd6E6011b726d68099E55EA9)
-   Timelock: [0x02e3157Df831C3454d008901ddBB108C301E378a](https://kovan.etherscan.io/address/0x02e3157Df831C3454d008901ddBB108C301E378a)
-   GovernorAlpha: [0xa8D27FEF019B93Cb99e1a51ef463919ec4BDAb0e](https://kovan.etherscan.io/address/0xa8D27FEF019B93Cb99e1a51ef463919ec4BDAb0e)

-   XVader: [0xD72237277a5A0EcDD87D1F16ae00b5dBe6C61C6a](https://kovan.etherscan.io/address/0xD72237277a5A0EcDD87D1F16ae00b5dBe6C61C6a)
