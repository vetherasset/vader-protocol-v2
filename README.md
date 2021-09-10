# Vader Protocol V2

The V2 implementation of the Vader Protocol &amp; vision!

## Development

Any new files introduced in this repo need to achieve at least 90% code coverage before being added with 100% being the target (and under multiple scenarios thereby "exceeding" 100% in actuality).

## Documentation

The project applies a variance of the Synthetix documentation model whereby each variable and function needs to be strictly documented and the code structure of a contract needs to be split with the corresponding headers.

## Build

Truffle is utilized as the build pipeline of the project. As such, a straightforward `truffle compile` command should be issued via the CLI to compile the contracts.

## Tests & Coverage

Node version that should be utilized for code coverage is `12.16.2`, other versions can show unwarranted errors. For Node.JS version management, `nvm` is recommended.

For each respective action a corresponding script has been introduced in the `package.json` file (`npm test` & `npm run coverage`).
