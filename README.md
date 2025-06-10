# base-index-test

## Prerequisites
- Node.js v18+
- `@graphprotocol/graph-cli` (install globally with `npm install -g @graphprotocol/graph-cli`)
- Docker and docker-compose for running a local Graph node

## Setup
1. Install node packages
   ```bash
   npm install
   ```
2. Generate types and classes and create the initial manifest
   ```bash
   npm run init
   ```
3. Run `npm run prepare:<network>` to create a `subgraph.yaml` for a specific network. For example:
   ```bash
   npm run prepare:base
   ```

## Running tests
Execute the test suite with:
```bash
npm run test
```

## Local Graph node
Spin up a local Graph node using Docker:
```bash
docker-compose up
```
Once the services are up, create and deploy the subgraph locally:
```bash
npm run create-local
npm run deploy-local
```

## Deploying to The Graph
After preparing the manifest you can deploy to your Studio or hosted service:
```bash
npm run codegen
npm run build
npm run deploy
```
Make sure you have authenticated with `graph auth` beforehand.
