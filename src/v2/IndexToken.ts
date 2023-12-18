import { Deposit as DepositEvent, Withdraw as WithdrawEvent } from "../../generated/templates/IndexTokenV2/IndexTokenV2"
import { createOrLoadIndexEntity, createOrLoadIndexAssetEntity, loadIndexAssetEntity, createOrLoadChainIDToAssetMappingEntity, loadChainIDToAssetMappingEntity } from "../EntityCreation"
import { BigDecimal, Bytes, Address, BigInt, dataSource } from "@graphprotocol/graph-ts"
export { handleTransfer } from "../v1/IndexToken"

export function handleDeposit(event: DepositEvent): void {
    let reserveAsset = dataSource.context().getBytes('reserveAsset')
    let reserveAssetEntity = createOrLoadIndexAssetEntity(event.address, reserveAsset)
    let scalar = new BigDecimal(BigInt.fromI32(10).pow(u8(createOrLoadIndexAssetEntity(event.address, reserveAsset).decimals)))
    let amount = new BigDecimal(event.params.reserve).div(scalar)
    reserveAssetEntity.balance = reserveAssetEntity.balance.plus(amount)
    reserveAssetEntity.save()
}

export function handleWithdraw(event: WithdrawEvent): void {
    let indexEntity = createOrLoadIndexEntity(event.address)
    let reserveAsset = dataSource.context().getBytes('reserveAsset')
    let reserveAssetEntity = createOrLoadIndexAssetEntity(event.address, reserveAsset)
    let scalar = new BigDecimal(BigInt.fromI32(10).pow(u8(reserveAssetEntity.decimals)))
    let amount = new BigDecimal(event.params.reserve).div(scalar)
    reserveAssetEntity.balance = reserveAssetEntity.balance.minus(amount)
    reserveAssetEntity.save()
    if (event.params.k > BigInt.zero() && indexEntity.k != null) {
        let assetScalar = new BigDecimal(indexEntity.k.minus(event.params.k).div(indexEntity.k))
        let indexAssets = indexEntity.assets
        for (let i = 0; i < indexAssets.length; i++) {
            let chainIDToAssetMappingEntity = loadChainIDToAssetMappingEntity(indexAssets[i])
            let chainIDAssetArray = chainIDToAssetMappingEntity.assets
            for (let y = 0; y < chainIDAssetArray.length; y++){
                let indexAssetEntity = loadIndexAssetEntity(chainIDAssetArray[y])
                indexAssetEntity.balance = indexAssetEntity.balance.times(assetScalar)
                indexAssetEntity.save()
            }
        }
        indexEntity.k = indexEntity.k.minus(event.params.k)
        indexEntity.save()
    }
}