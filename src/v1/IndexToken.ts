import { Address, BigDecimal, BigInt, ByteArray, Bytes, dataSource } from "@graphprotocol/graph-ts"
import {
  AssetRemoved as AssetRemovedEvent,
  Transfer as TransferEvent,
  UpdateAnatomy as UpdateAnatomyEvent
} from "../../generated/templates/IndexTokenV1/IndexTokenV1"
import { createOrLoadIndexEntity, createOrLoadIndexAssetEntity, createOrLoadIndexAccountEntity, createOrLoadHistoricalAccountBalanceEntity, createOrLoadAccountEntity } from "../EntityCreation"
import { ERC20 } from "../../generated/IndexFactoryV1/ERC20"

export function handleTransfer(event: TransferEvent): void {
  let index = createOrLoadIndexEntity(event.address)
  let scalar = new BigDecimal(BigInt.fromI32(10).pow(u8(index.decimals)))
  if (event.params.from != Address.fromString('0x0000000000000000000000000000000000000000') && event.params.value > BigInt.zero()) {
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
  if (event.params.from == Address.fromString('0x0000000000000000000000000000000000000000') && event.params.to != Address.fromString('0x0000000000000000000000000000000000000000') && event.params.value > BigInt.zero()) {
    index.totalSupply = index.totalSupply.plus(new BigDecimal(event.params.value).div(scalar))
  }
  if (event.params.to != Address.fromString('0x0000000000000000000000000000000000000000') && event.params.value > BigInt.zero()) {
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
  if (event.params.to == Address.fromString('0x0000000000000000000000000000000000000000') && event.params.from != Address.fromString('0x0000000000000000000000000000000000000000') && event.params.value > BigInt.zero()) {
    index.totalSupply = index.totalSupply.minus(new BigDecimal(event.params.value).div(scalar))
  }

  index.save()
}

export function handleAssetRemoved(event: AssetRemovedEvent): void {
  let index = createOrLoadIndexEntity(event.address)
  let indexAssetEntity = createOrLoadIndexAssetEntity(event.address, event.params.asset)
  let assets = index.assets
  let idx = assets.indexOf(indexAssetEntity.id)
  assets.splice(idx, 1)
  index.assets = assets
  indexAssetEntity.weight = 0
  indexAssetEntity.save()
  index.save()
}

export function handleUpdateAnatomy(event: UpdateAnatomyEvent): void {
  let index = createOrLoadIndexEntity(event.address)
  let indexAssetEntity = createOrLoadIndexAssetEntity(event.address, event.params.asset)
  let tokenContract = ERC20.bind(event.params.asset)
  indexAssetEntity.name = tokenContract.name()
  indexAssetEntity.symbol = tokenContract.symbol()
  indexAssetEntity.decimals = tokenContract.decimals()
  let assets = index.assets
  let idx = assets.indexOf(indexAssetEntity.id)
  if (idx == -1) {
    assets.push(indexAssetEntity.id)
  }
  indexAssetEntity.weight = event.params.weight
  index.assets = assets
  indexAssetEntity.save()
  index.save()
}