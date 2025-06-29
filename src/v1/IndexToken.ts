// Event handlers for the v1 IndexToken template. Responsible for
// updating balances and anatomy of a given index token instance.
import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import {
  AssetRemoved as AssetRemovedEvent,
  Transfer as TransferEvent,
  UpdateAnatomy as UpdateAnatomyEvent
} from "../../generated/templates/IndexTokenV1/IndexTokenV1"
import { createOrLoadIndexEntity, createOrLoadIndexAssetEntity, createOrLoadIndexAccountEntity, createOrLoadHistoricalAccountBalanceEntity, createOrLoadAccountEntity, createOrLoadChainIDToAssetMappingEntity } from "../EntityCreation"
import { getTokenInfo } from "./IndexFactory"
import { saveHistoricalData } from "../v2/ConfigBuilder"
import { ZERO_ADDRESS } from "../constants"


// Track transfers of index tokens and update holder counts and
// balances accordingly.
export function handleTransfer(event: TransferEvent): void {
  let index = createOrLoadIndexEntity(event.address)
  let scalar = new BigDecimal(BigInt.fromI32(10).pow(u8(index.decimals)))
  if (!event.params.from.equals(Address.fromString(ZERO_ADDRESS)) && event.params.value > BigInt.zero()) {
    let fromAccount = createOrLoadIndexAccountEntity(event.address, event.params.from)
    createOrLoadAccountEntity(event.params.from)
    fromAccount.balance = fromAccount.balance.minus(new BigDecimal(event.params.value).div(scalar))
    if (fromAccount.balance == BigDecimal.zero()) {
      index.holders = index.holders.minus(BigInt.fromI32(1))
    }
    fromAccount.save()
    let historicalAccountBalanceEntity = createOrLoadHistoricalAccountBalanceEntity(event.address, event.params.from, event)
    historicalAccountBalanceEntity.balance = fromAccount.balance
    historicalAccountBalanceEntity.save()
  }
  if (event.params.from.equals(Address.fromString(ZERO_ADDRESS)) && !event.params.to.equals(Address.fromString(ZERO_ADDRESS)) && event.params.value > BigInt.zero()) {
    index.totalSupply = index.totalSupply.plus(new BigDecimal(event.params.value).div(scalar))
  }
  if (!event.params.to.equals(Address.fromString(ZERO_ADDRESS)) && event.params.value > BigInt.zero()) {
    let toAccount = createOrLoadIndexAccountEntity(event.address, event.params.to)
    createOrLoadAccountEntity(event.params.to)
    if (toAccount.balance == BigDecimal.zero()) {
      index.holders = index.holders.plus(BigInt.fromI32(1))
    }
    toAccount.balance = toAccount.balance.plus(new BigDecimal(event.params.value).div(scalar))
    toAccount.save()

    let historicalAccountBalanceEntity = createOrLoadHistoricalAccountBalanceEntity(event.address, event.params.to, event)
    historicalAccountBalanceEntity.balance = toAccount.balance
    historicalAccountBalanceEntity.save()
  }
  if (event.params.to.equals(Address.fromString(ZERO_ADDRESS)) && !event.params.from.equals(Address.fromString(ZERO_ADDRESS)) && event.params.value > BigInt.zero()) {
    index.totalSupply = index.totalSupply.minus(new BigDecimal(event.params.value).div(scalar))
  }

  index.save()
  saveHistoricalData(event.address, event.block.timestamp)
}

// Remove an asset from the list of tracked index components.
export function handleAssetRemoved(event: AssetRemovedEvent): void {
  let index = createOrLoadIndexEntity(event.address)
  let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(event.address, index.chainID)
  let indexAssetEntity = createOrLoadIndexAssetEntity(event.address, event.params.asset, index.chainID)
  let assets = chainIDToAssetMappingEntity.assets
  let idx = assets.indexOf(indexAssetEntity.id)
  assets.splice(idx, 1)
  chainIDToAssetMappingEntity.assets = assets
  indexAssetEntity.weight = BigInt.fromI32(0)
  indexAssetEntity.save()
  chainIDToAssetMappingEntity.save()
}

// Add or update an asset's weight within the index.
export function handleUpdateAnatomy(event: UpdateAnatomyEvent): void {
  let index = createOrLoadIndexEntity(event.address)
  let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(event.address, index.chainID)
  let indexAssetEntity = createOrLoadIndexAssetEntity(event.address, event.params.asset, index.chainID)
  if (indexAssetEntity.decimals == 0) {
    getTokenInfo(indexAssetEntity, event.params.asset)
  }
  indexAssetEntity.weight = BigInt.fromI32(event.params.weight)
  let assets = chainIDToAssetMappingEntity.assets
  let idx = assets.indexOf(indexAssetEntity.id)
  if (idx == -1) {
    assets.push(indexAssetEntity.id)
  }
  chainIDToAssetMappingEntity.assets = assets
  indexAssetEntity.save()
  chainIDToAssetMappingEntity.save()
}
