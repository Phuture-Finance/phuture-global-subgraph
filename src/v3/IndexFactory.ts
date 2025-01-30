import { Deployed as DeployedEvent } from "../../generated/IndexFactoryV3/IndexFactoryV3"
import { createOrLoadChainIDToAssetMappingEntity, createOrLoadIndexAssetEntity, createOrLoadIndexEntity } from "../EntityCreation"
import { Governance as GovernanceTemplate, IndexTokenV3 as indexTemplate } from "../../generated/templates"
import { Address, BigDecimal, BigInt, Bytes, DataSourceContext, dataSource, log } from "@graphprotocol/graph-ts"
import { IndexTokenV3 } from "../../generated/IndexFactoryV3/IndexTokenV3"
import { getTokenInfo } from "../v1/IndexFactory"


export function handleIndexDeployed(event: DeployedEvent): void {
    let chainID = dataSource.context().getBigInt('chainID')
    let context = new DataSourceContext()
    context.setBytes('reserveAsset', event.params.reserve)
    indexTemplate.createWithContext(event.params.index, context)
    context.setBytes('indexAddress', event.params.index)
    GovernanceTemplate.createWithContext(event.params.governance, context)

    let index = createOrLoadIndexEntity(event.params.index)
    let indexContract = IndexTokenV3.bind(event.params.index)
    index.name = event.params.name
    index.symbol = event.params.symbol
    index.decimals = indexContract.decimals()
    index.chainID = chainID
    index.version = "v3"
    index.creationDate = event.block.timestamp
    index.k = BigInt.fromI32(1).times(BigInt.fromI32(10).pow(18))
    index.totalFees = BigDecimal.zero()
    let indexAssetEntity = createOrLoadIndexAssetEntity(event.params.index, event.params.reserve, chainID)
    if (event.params.reserve != Address.fromString('0x0000000000000000000000000000000000000000')) {
        getTokenInfo(indexAssetEntity, event.params.reserve)
    }
    else {
        let nativeAssetInfo = dataSource.context().get("nativeAsset")!
        indexAssetEntity.name = nativeAssetInfo.toArray()[0].toString()
        indexAssetEntity.symbol = nativeAssetInfo.toArray()[1].toString()
        indexAssetEntity.decimals = nativeAssetInfo.toArray()[2].toI32()
    }

    let chainIDAssetArray: string[] = []
    let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(event.params.index, chainID)
    chainIDAssetArray.push(indexAssetEntity.id)
    chainIDToAssetMappingEntity.assets = chainIDAssetArray
    chainIDToAssetMappingEntity.chainIndex = BigInt.zero()
    chainIDToAssetMappingEntity.latestSnapshot = BigInt.zero()
    chainIDToAssetMappingEntity.registeredAssets = BigInt.zero()

    indexAssetEntity.currencyID = chainIDToAssetMappingEntity.registeredAssets
    chainIDToAssetMappingEntity.registeredAssets = chainIDToAssetMappingEntity.registeredAssets!.plus(BigInt.fromI32(1))

    let indexAssetArray: string[] = []
    indexAssetArray.push(chainIDToAssetMappingEntity.id)
    index.assets = indexAssetArray
    chainIDToAssetMappingEntity.save()
    indexAssetEntity.save()
    index.save()
}