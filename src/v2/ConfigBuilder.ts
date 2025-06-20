import { Address, BigDecimal, BigInt, Bytes, dataSource, DataSourceContext, ethereum } from "@graphprotocol/graph-ts";
import { Messenger } from "../../generated/templates";
import { ConfigUpdated as ConfigUpdatedEvent, CurrencyRegistered as CurrencyRegisteredEvent, FinishChainRebalancing as FinishChainRebalancingEvent, FinishRebalancing as FinishRebalancingEvent, RegisterChain as RegisterChainEvent, SetMessenger as SetMessengerEvent, StartRebalancing as StartRebalancingEvent } from "../../generated/templates/ConfigBuilder/ConfigBuilder";
import { createOrLoadAnatomyEntity, createOrLoadChainIDToAssetMappingEntity, createOrLoadConfigEntity, createOrLoadCurrencySetEntity, createOrLoadHistoricalIndexAssetEntity, createOrLoadHistoricalIndexBalanceEntity, createOrLoadIndexAssetEntity, createOrLoadIndexEntity, loadChainIDToAssetMappingEntity, loadIndexAssetEntity } from "../EntityCreation";
import { convertAUMFeeRate } from "../v1/FeePool";

export function handleConfigUpdate(event: ConfigUpdatedEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let indexEntity = createOrLoadIndexEntity(indexAddress)
    let configEntity = createOrLoadConfigEntity(indexAddress)
    let decoded = ethereum.decode('((uint256,bool,address),(uint16,bool),(uint16,bool))', event.params.param0)!.toTuple()
    configEntity.AUMDilutionPerSecond = decoded[0].toTuple()[0].toBigInt()
    configEntity.useCustomAUMFee = decoded[0].toTuple()[1].toBoolean()
    configEntity.metadata = decoded[0].toTuple()[2].toAddress()
    configEntity.depositFeeInBP = decoded[1].toTuple()[0].toBigInt()
    configEntity.depositCustomCallback = decoded[1].toTuple()[1].toBoolean()
    configEntity.redemptionFeeInBP = decoded[2].toTuple()[0].toBigInt()
    configEntity.redemptionCustomCallback = decoded[2].toTuple()[1].toBoolean()
    let aumFee = decoded[0].toTuple()[0].toBigInt()
    let scalar = new BigDecimal(BigInt.fromI32(10000))
    let mintingFee = new BigDecimal(decoded[1].toTuple()[0].toBigInt()).div(scalar)
    let redemptionFee = new BigDecimal(decoded[2].toTuple()[0].toBigInt()).div(scalar)
    indexEntity.mintingFee = mintingFee
    indexEntity.redemptionFee = redemptionFee
    indexEntity.save()
    configEntity.save()
    convertAUMFeeRate(indexAddress, aumFee)
}

export function handleSetMessenger(event: SetMessengerEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let reserveAsset = dataSource.context().getBytes('reserveAsset')
    let context = new DataSourceContext()
    context.setBytes('indexAddress', indexAddress)
    context.setBytes('reserveAsset', reserveAsset)
    Messenger.createWithContext(event.params.param0, context)
}

export function handleStartRebalancing(event: StartRebalancingEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let indexEntity = createOrLoadIndexEntity(indexAddress)
    indexEntity.isRebalancing = true
    indexEntity.save()
}

export function handleCurrencyRegistered(event: CurrencyRegisteredEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let indexAssetEntity = createOrLoadIndexAssetEntity(indexAddress, event.params.currency, event.params.chainId)
    let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(indexAddress, event.params.chainId)
    indexAssetEntity.name = event.params.name
    indexAssetEntity.symbol = event.params.symbol
    indexAssetEntity.decimals = event.params.decimals
    indexAssetEntity.currencyID = chainIDToAssetMappingEntity.registeredAssets

    chainIDToAssetMappingEntity.registeredAssets = chainIDToAssetMappingEntity.registeredAssets!.plus(BigInt.fromI32(1))

    chainIDToAssetMappingEntity.save()
    indexAssetEntity.save()
}

export function handleFinishChainRebalancing(event: FinishChainRebalancingEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let reserveAsset = dataSource.context().getBytes('reserveAsset')
    let indexEntity = createOrLoadIndexEntity(indexAddress)
    let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(indexAddress, event.params.chainId)
    chainIDToAssetMappingEntity.latestSnapshot = event.params.snapshot
    if (event.params.currencies.length == 0) {
        for (let i = 0; i < chainIDToAssetMappingEntity.assets.length; i++) {
            let indexAssetEntity = loadIndexAssetEntity(chainIDToAssetMappingEntity.assets[i])
            indexAssetEntity.balance = BigDecimal.zero()
            indexAssetEntity.weight = BigInt.zero()
            indexAssetEntity.save()
        }
        let emptyAssetArray: string[] = []
        if (event.params.chainId == indexEntity.chainID) {
            emptyAssetArray.push(createOrLoadIndexAssetEntity(indexAddress, reserveAsset, indexEntity.chainID).id)
        }
        chainIDToAssetMappingEntity.assets = emptyAssetArray
        chainIDToAssetMappingEntity.save()

        if (event.params.chainId != indexEntity.chainID) {
            let indexAssets = indexEntity.assets
            let idx = indexAssets.indexOf(chainIDToAssetMappingEntity.id)
            indexAssets.splice(idx, 1)
            indexEntity.assets = indexAssets
            indexEntity.save()
        }

    } else {
        let chainIDAssetArray: string[] = []
        let reserveAssetEntity = createOrLoadIndexAssetEntity(indexAddress, reserveAsset, indexEntity.chainID)
        if (event.params.chainId == indexEntity.chainID) {
            reserveAssetEntity.balance = BigDecimal.zero()
            reserveAssetEntity.save()
            chainIDAssetArray.push(reserveAssetEntity.id)
        }
        for (let i = 0; i < event.params.currencies.length; i++) {
            let balance = new BigDecimal(event.params.currencies[i].rightShift(160))
            let asset = event.params.currencies[i].bitAnd(BigInt.fromI32(2).pow(160).minus(BigInt.fromI32(1))).toHex()
            let assetConverted: Bytes
            if (asset.length == 3) {
                assetConverted = Address.fromString("0x0000000000000000000000000000000000000000")
            }
            else {
                assetConverted = Address.fromHexString('0x'.concat("0".repeat(42 - asset.length)).concat(asset.slice(2)))
            }
            let indexAssetEntity = createOrLoadIndexAssetEntity(indexAddress, assetConverted, event.params.chainId)
            let scalar = new BigDecimal(BigInt.fromI32(10).pow(u8(indexAssetEntity.decimals)))
            indexAssetEntity.balance = balance.div(scalar)
            indexAssetEntity.save()
            if (indexAssetEntity.id != reserveAssetEntity.id) {
                chainIDAssetArray.push(indexAssetEntity.id)
            }

        }
        for (let i = 0; i < chainIDToAssetMappingEntity.assets.length; i++) {
            let id = chainIDToAssetMappingEntity.assets[i]
            if (!chainIDAssetArray.includes(id)) {
                let indexAssetEntity = loadIndexAssetEntity(id)
                indexAssetEntity.balance = BigDecimal.zero()
                indexAssetEntity.weight = BigInt.zero()
                indexAssetEntity.save()
            }
        }
        chainIDToAssetMappingEntity.assets = chainIDAssetArray


        if (!indexEntity.assets.includes(chainIDToAssetMappingEntity.id)) {
            let indexAssetArray = indexEntity.assets
            indexAssetArray.push(chainIDToAssetMappingEntity.id)
            indexEntity.assets = indexAssetArray
            indexEntity.save()
        }
    }
    chainIDToAssetMappingEntity.save()
    indexEntity.k = BigInt.fromI32(1).times(BigInt.fromI32(10).pow(18))
    indexEntity.save()
    saveHistoricalData(indexAddress, event.block.timestamp)
}

export function handleRegisterChain(event: RegisterChainEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(indexAddress, event.params.chainId)
    chainIDToAssetMappingEntity.chainIndex = event.params.chainIndex
    chainIDToAssetMappingEntity.latestSnapshot = BigInt.zero()
    chainIDToAssetMappingEntity.registeredAssets = BigInt.zero()
    chainIDToAssetMappingEntity.save()

}

export function saveHistoricalData(index: Bytes, timestamp: BigInt): void {
    let indexEntity = createOrLoadIndexEntity(index)
    let historicalIndexBalanceEntity = createOrLoadHistoricalIndexBalanceEntity(index, timestamp)
    historicalIndexBalanceEntity.totalSupply = indexEntity.totalSupply
    let historicalIndexAssetArray: string[] = []
    for (let i = 0; i < indexEntity.assets.length; i++) {
        let chainIDToAssetMappingEntity = loadChainIDToAssetMappingEntity(indexEntity.assets[i])
        let chainID = chainIDToAssetMappingEntity.chainID
        for (let y = 0; y < chainIDToAssetMappingEntity.assets.length; y++) {
            let indexAssetEntity = loadIndexAssetEntity(chainIDToAssetMappingEntity.assets[y])
            let historicalIndexAssetEntity = createOrLoadHistoricalIndexAssetEntity(index, indexAssetEntity.asset, chainID, timestamp)
            historicalIndexAssetEntity.balance = indexAssetEntity.balance
            if (indexAssetEntity.weight) {
                historicalIndexAssetEntity.weight = indexAssetEntity.weight
            }
            historicalIndexAssetEntity.save()
            historicalIndexAssetArray.push(historicalIndexAssetEntity.id)
        }
    }
    historicalIndexBalanceEntity.assets = historicalIndexAssetArray
    historicalIndexBalanceEntity.save()
}

export function handleFinishRebalancing(event: FinishRebalancingEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let indexEntity = createOrLoadIndexEntity(indexAddress)
    let anatomyEntity = createOrLoadAnatomyEntity(indexAddress)
    let anatomyArray: string[] = []
    let chainIndexArray = convertBitSetToIDs(convertBigIntsToBitArray(event.params.newAnatomy.chainIdSet))
    let count = 0
    for (let i = 0; i < chainIndexArray.length; i++) {
        let currencySetEntity = createOrLoadCurrencySetEntity(indexAddress, chainIndexArray[i])
        currencySetEntity.sets = event.params.newAnatomy.currencyIdSets[i]
        currencySetEntity.save()
        anatomyArray.push(currencySetEntity.id)

        let currencyIndexArray = convertBitSetToIDs(convertBigIntsToBitArray(event.params.newAnatomy.currencyIdSets[i]))
        for (let y = 0; y < indexEntity.assets.length; y++) {
            let chainIDToAssetMappingEntity = loadChainIDToAssetMappingEntity(indexEntity.assets[y])
            let chainIndex = chainIDToAssetMappingEntity.chainIndex
            if (chainIndex && chainIndex == chainIndexArray[i]) {
                while (currencyIndexArray.length > 0) {
                    for (let x = 0; x < chainIDToAssetMappingEntity.assets.length; x++) {
                        let indexAssetEntity = loadIndexAssetEntity(chainIDToAssetMappingEntity.assets[x])
                        let currencyID = indexAssetEntity.currencyID
                        if (currencyIndexArray.length == 0) {
                            break
                        }
                        if (currencyID && currencyID == currencyIndexArray[0]) {
                            indexAssetEntity.weight = event.params.weights[count]
                            currencyIndexArray.splice(0, 1)
                            indexAssetEntity.save()
                            count++
                        }
                    }
                }
                break
            }
        }
    }
    indexEntity.isRebalancing = false
    anatomyEntity.chainIdSet = event.params.newAnatomy.chainIdSet
    anatomyEntity.currencyIdSets = anatomyArray
    anatomyEntity.save()
    indexEntity.save()
}

export function convertBitSetToIDs(array: BigInt[]): BigInt[] {
    let IDArray: BigInt[] = []
    for (let i = 0; i < array.length; i++) {
        if (array[i] == BigInt.fromI32(1)) {
            IDArray.push(BigInt.fromI32(i))
        }
    }
    return IDArray
}

export function convertBigIntsToBitArray(array: BigInt[]): BigInt[] {
    let expandedBitArray: BigInt[] = []
    for (let i = 0; i < array.length; i++) {
        let bitArray: BigInt[] = []
        let chainBitSet = array[i]
        while (chainBitSet > BigInt.zero()) {
            bitArray.push(chainBitSet.bitAnd(BigInt.fromI32(1)))
            chainBitSet = chainBitSet.rightShift(1)
        }
        expandedBitArray = expandedBitArray.concat(bitArray)
    }
    return expandedBitArray
}


