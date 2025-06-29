// Event handlers for the v1 IndexFactory contract. These handlers
// are responsible for bootstrapping new index subgraphs as indexes
// are deployed on-chain.
import { Address, BigDecimal, Bytes, DataSourceContext, log, BigInt, dataSource } from "@graphprotocol/graph-ts"
import {
  ManagedIndexCreated as ManagedIndexCreatedEvent
} from "../../generated/IndexFactoryV1/IndexFactoryV1"
import { FeePool, IndexRegistry, IndexTokenV1, Vault, VaultFactory } from "../../generated/templates"
import { IndexTokenV1 as indexTokenContract } from "../../generated/templates/IndexTokenV1/IndexTokenV1"
import { IndexRegistry as indexRegistryContract } from "../../generated/templates/IndexRegistry/IndexRegistry"
import { VaultFactory as vaultFactoryContract } from "../../generated/templates/VaultFactory/VaultFactory"
import { createOrLoadChainIDToAssetMappingEntity, createOrLoadIndexAssetEntity, createOrLoadIndexEntity } from "../EntityCreation"
import { ERC20 } from "../../generated/IndexFactoryV1/ERC20"
import { MakerERC20 } from "../../generated/IndexFactoryV1/MakerERC20"
import { IndexAsset } from "../../generated/schema"
import { ZERO_ADDRESS } from "../constants"

// Fired when the factory deploys a new managed index.
// Creates templates for the new contracts and seeds initial entities.
export function handleManagedIndexCreated(
  event: ManagedIndexCreatedEvent
): void {
  let indexContract = indexTokenContract.bind(event.params.index)
  let vTokenFactory = indexContract.vTokenFactory()
  let registry = indexContract.registry()

  IndexTokenV1.create(event.params.index)

  let vTokenContext = new DataSourceContext()
  vTokenContext.setBytes('indexAddress', event.params.index)
  VaultFactory.createWithContext(vTokenFactory, vTokenContext)

  let registryContext = new DataSourceContext()
  registryContext.setBytes('indexAddress', event.params.index)
  IndexRegistry.createWithContext(registry, registryContext)

  let feePoolAddress = indexRegistryContract.bind(registry).feePool()
  FeePool.create(feePoolAddress)
  let chainID = dataSource.context().getBigInt('chainID')
  let indexEntity = createOrLoadIndexEntity(event.params.index)
  indexEntity.decimals = indexContract.decimals()
  indexEntity.name = indexContract.name()
  indexEntity.symbol = indexContract.symbol()
  indexEntity.chainID = chainID
  indexEntity.creationDate = event.block.timestamp
  indexEntity.version = "v1"
  let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(event.params.index, chainID)
  let chainIDAssetArray: string[] = []

  for (let i = 0; i < event.params._assets.length; i++) {
    let token = event.params._assets[i]
    let weight = event.params._weights[i]
    let vtokenAddress = vaultFactoryContract.bind(vTokenFactory).vTokenOf(token)
    if (!vtokenAddress.equals(Address.fromString(ZERO_ADDRESS))) {
      let context = new DataSourceContext()
      context.setBytes('assetAddress', token)
      context.setBytes('indexAddress', event.params.index)
      Vault.createWithContext(vtokenAddress, context)
      let indexAssetEntity = createOrLoadIndexAssetEntity(event.params.index, token, chainID)
      getTokenInfo(indexAssetEntity, token)
      indexAssetEntity.weight = BigInt.fromI32(weight)
      indexAssetEntity.save()
      chainIDAssetArray.push(indexAssetEntity.id)
    }
  }
  chainIDToAssetMappingEntity.assets = chainIDAssetArray
  chainIDToAssetMappingEntity.save()
  indexEntity.assets = [chainIDToAssetMappingEntity.id]
  indexEntity.save()
}

// Helper used by the factory handlers to populate basic token
// metadata for assets that belong to an index.
export function getTokenInfo(indexAssetEntity: IndexAsset, tokenAddress: Bytes): void {
  let tokenContract = ERC20.bind(Address.fromBytes(tokenAddress))
  let makerERC20Contract = MakerERC20.bind(Address.fromBytes(tokenAddress))
  let tokenName = tokenContract.try_name()
  if (tokenName.reverted) {
    let tokenName = makerERC20Contract.name().toString()
    indexAssetEntity.name = tokenName
  }
  else {
    indexAssetEntity.name = tokenName.value
  }
  let tokenSymbol = tokenContract.try_symbol()
  if (tokenSymbol.reverted) {
    let tokenSymbol = makerERC20Contract.symbol().toString()
    indexAssetEntity.symbol = tokenSymbol
  }
  else {
    indexAssetEntity.symbol = tokenSymbol.value
  }
  indexAssetEntity.decimals = tokenContract.decimals()
  indexAssetEntity.save()
}