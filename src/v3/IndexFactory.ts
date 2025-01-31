import {
	Address,
	BigDecimal,
	DataSourceContext,
	dataSource,
} from "@graphprotocol/graph-ts";

import type { Deployed as DeployedEvent } from "../../generated/IndexFactoryV3/IndexFactoryV3";
import { IndexTokenV3 as indexTemplate } from "../../generated/templates";
import {
	createOrLoadChainIDToAssetMappingEntity,
	createOrLoadIndexAssetEntity,
	createOrLoadIndexEntity,
} from "../EntityCreation";

import { ONE, WAD, ZERO } from "../constants";
import { getTokenInfo } from "../v1/IndexFactory";

export function handleIndexDeployed(event: DeployedEvent): void {
	const indexContext = new DataSourceContext();
	indexContext.setBytes("reserveAsset", event.params.reserve);
	indexContext.setBytes("indexAddress", event.params.index);
	indexTemplate.createWithContext(event.params.index, indexContext);

	const indexFactoryContext = dataSource.context();
	const chainID = indexFactoryContext.getBigInt("chainID");
	const index = createOrLoadIndexEntity(event.params.index);
	index.name = event.params.name;
	index.symbol = event.params.symbol;
	index.decimals = 18;
	index.chainID = chainID;
	index.version = "v3";
	index.creationDate = event.block.timestamp;
	index.k = WAD;
	index.totalFees = BigDecimal.zero();

	const indexAssetEntity = createOrLoadIndexAssetEntity(
		event.params.index,
		event.params.reserve,
		chainID,
	);
	if (
		event.params.reserve ==
		Address.fromString("0x0000000000000000000000000000000000000000")
	) {
		const nativeAssetInfo = dataSource.context().get("nativeAsset")!;
		indexAssetEntity.name = nativeAssetInfo.toArray()[0].toString();
		indexAssetEntity.symbol = nativeAssetInfo.toArray()[1].toString();
		indexAssetEntity.decimals = nativeAssetInfo.toArray()[2].toI32();
	} else {
		getTokenInfo(indexAssetEntity, event.params.reserve);
	}

	const chainIDAssetArray: string[] = [];
	const chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(
		event.params.index,
		chainID,
	);
	chainIDAssetArray.push(indexAssetEntity.id);
	chainIDToAssetMappingEntity.assets = chainIDAssetArray;
	chainIDToAssetMappingEntity.chainIndex = ZERO;
	chainIDToAssetMappingEntity.latestSnapshot = ZERO;
	chainIDToAssetMappingEntity.registeredAssets = ZERO;

	indexAssetEntity.currencyID = chainIDToAssetMappingEntity.registeredAssets;
	chainIDToAssetMappingEntity.registeredAssets =
		chainIDToAssetMappingEntity.registeredAssets!.plus(ONE);

	const indexAssetArray: string[] = [];
	indexAssetArray.push(chainIDToAssetMappingEntity.id);
	index.assets = indexAssetArray;
	chainIDToAssetMappingEntity.save();
	indexAssetEntity.save();
	index.save();
}
