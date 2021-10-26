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
-   Vader: [0xE8bD273f54a990007b1069a15b66B584abc86e04](https://kovan.etherscan.io/address/0xE8bD273f54a990007b1069a15b66B584abc86e04)
-   Converter: [0xF79c9406c14AF5Aa8b3F1E5E538A026aDf4D0ff5](https://kovan.etherscan.io/address/0xF79c9406c14AF5Aa8b3F1E5E538A026aDf4D0ff5)
-   LinearVesting: [0xEa66FB7590147A5C901E14034f243e1cF8f958ff](https://kovan.etherscan.io/address/0xEa66FB7590147A5C901E14034f243e1cF8f958ff)
-   VaderMath: [0x0A23bde5E3930EfEaa546A4b4F10a1b7A9cC1e6C](https://kovan.etherscan.io/address/0x0A23bde5E3930EfEaa546A4b4F10a1b7A9cC1e6C)
-   VaderPoolV2: [0x795bE6b0BF54AF587385604B9DB869E797db69E0](https://kovan.etherscan.io/address/0x795bE6b0BF54AF587385604B9DB869E797db69E0)
-   VaderRouterV2: [0x80362414e23E64c404a8581779b28f037B8d5A05](https://kovan.etherscan.io/address/0x80362414e23E64c404a8581779b28f037B8d5A05)
-   VaderReserve: [0x176207eD5Ae8c41F766E8C31112c7cDdE5Fb32AA](https://kovan.etherscan.io/address/0x176207eD5Ae8c41F766E8C31112c7cDdE5Fb32AA)
-   USDV: [0xE90E0A75694Fc97576868243AD0364d10291f48A](https://kovan.etherscan.io/address/0xE90E0A75694Fc97576868243AD0364d10291f48A)
-   Vault (Mock): [0x85380a961CE380CdA8977E3A9D26bA91D9C379B1](https://kovan.etherscan.io/address/0x85380a961CE380CdA8977E3A9D26bA91D9C379B1)
-   GovernorAlpha: [0x34e9Db9bC8c668E2fa922c1d22913DCd587607D8](https://kovan.etherscan.io/address/0x34e9Db9bC8c668E2fa922c1d22913DCd587607D8)
-   Timelock: [0x7574D631E9b402917cC478ac568b465D7F726033](https://kovan.etherscan.io/address/0x7574D631E9b402917cC478ac568b465D7F726033)
