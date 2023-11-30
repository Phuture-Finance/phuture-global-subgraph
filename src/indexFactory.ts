import { Address, BigDecimal, Bytes, DataSourceContext, log, BigInt, dataSource } from "@graphprotocol/graph-ts"
import {
  ManagedIndexCreated as ManagedIndexCreatedEvent
} from "../generated/indexFactory/indexFactory"
import { feePool, indexRegistry, indexToken, vault, vaultFactory } from "../generated/templates"
import { indexToken as indexTokenContract } from "../generated/templates/indexToken/indexToken"
import { indexRegistry as indexRegistryContract } from "../generated/templates/indexRegistry/indexRegistry"
import { vaultFactory as vaultFactoryContract } from "../generated/templates/vaultFactory/vaultFactory"
import { createOrLoadAssetEntity, createOrLoadIndexAssetEntity, createOrLoadIndexEntity } from "./entityCreation"

export function handleManagedIndexCreated(
  event: ManagedIndexCreatedEvent
): void {
  let chainID = dataSource.context().getBigInt('chainID')
  let indexContract = indexTokenContract.bind(event.params.index)
  let decimals = indexContract.decimals()
  let vTokenFactory = indexContract.vTokenFactory()
  let registry = indexContract.registry()
  let name = indexContract.name()
  let symbol = indexContract.symbol()

  indexToken.create(event.params.index)

  let vTokenContext = new DataSourceContext()
  vTokenContext.setBytes('indexAddress', event.params.index)
  vaultFactory.createWithContext(vTokenFactory, vTokenContext)

  let registryContext = new DataSourceContext()
  registryContext.setBytes('indexAddress', event.params.index)
  indexRegistry.createWithContext(registry, registryContext)

  let feePoolAddress = indexRegistryContract.bind(registry).feePool()
  feePool.create(feePoolAddress)

  let indexEntity = createOrLoadIndexEntity(event.params.index)
  indexEntity.decimals = decimals
  indexEntity.name = name
  indexEntity.symbol = symbol
  indexEntity.chainID = chainID

  let indexAssetArray: Bytes[] = []

  for (let i = 0; i < event.params._assets.length; i++) {
    let token = event.params._assets[i]
    let weight = event.params._weights[i]
    let vtokenAddress = vaultFactoryContract.bind(vTokenFactory).vTokenOf(token)
    if (vtokenAddress != Address.fromString("0x0000000000000000000000000000000000000000")) {
      let context = new DataSourceContext()
      context.setBytes('assetAddress', token)
      context.setBytes('indexAddress', event.params.index)
      vault.createWithContext(vtokenAddress, context)
    }
    createOrLoadAssetEntity(token)
    let indexAssetEntity = createOrLoadIndexAssetEntity(event.params.index, token)
    indexAssetEntity.weight = weight
    indexAssetEntity.save()
    indexAssetArray.push(indexAssetEntity.id)
  }
  indexEntity.assets = indexAssetArray
  indexEntity.save()
}
