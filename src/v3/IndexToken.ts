import {
	BigDecimal,
	DataSourceContext,
	dataSource,
} from "@graphprotocol/graph-ts";
import { ConfigBuilderV3 as ConfigBuilderTemplate } from "../../generated/templates";
import {
	Deposit as DepositEvent,
	FeeAccrued,
	SetConfigBuilder as SetConfigbuilderEvent,
	Withdraw as WithdrawEvent,
} from "../../generated/templates/IndexTokenV3/IndexTokenV3";

import {
	createOrLoadIndexAssetEntity,
	createOrLoadIndexEntity,
	loadChainIDToAssetMappingEntity,
	loadIndexAssetEntity,
} from "../EntityCreation";
import { TEN, ZERO } from "../constants";
import { saveHistoricalData } from "./ConfigBuilder";

export { handleTransfer } from "../v1/IndexToken";

export function handleDeposit(event: DepositEvent): void {
	const indexContext = dataSource.context();
	const reserveAsset = indexContext.getBytes("reserveAsset");
	const chainID = indexContext.getBigInt("chainID");

	const reserveAssetEntity = createOrLoadIndexAssetEntity(
		event.address,
		reserveAsset,
		chainID,
	);

	const scalar = new BigDecimal(TEN.pow(u8(reserveAssetEntity.decimals)));
	const amount = new BigDecimal(event.params.reserve).div(scalar);

	reserveAssetEntity.balance = reserveAssetEntity.balance.plus(amount);

	reserveAssetEntity.save();

	saveHistoricalData(event.address, event.block.timestamp);
}

export function handleWithdraw(event: WithdrawEvent): void {
	const indexContext = dataSource.context();
	const reserveAsset = indexContext.getBytes("reserveAsset");
	const chainID = indexContext.getBigInt("chainID");

	const reserveAssetEntity = createOrLoadIndexAssetEntity(
		event.address,
		reserveAsset,
		chainID,
	);
	const scalar = new BigDecimal(TEN.pow(u8(reserveAssetEntity.decimals)));
	const amount = new BigDecimal(event.params.reserve).div(scalar);
	reserveAssetEntity.balance = reserveAssetEntity.balance.minus(amount);
	reserveAssetEntity.save();

	if (event.params.k > ZERO) {
		const indexEntity = createOrLoadIndexEntity(event.address);

		const assetScalar = BigDecimal.fromString("1").minus(
			new BigDecimal(event.params.k).div(new BigDecimal(indexEntity.k!)),
		);
		const indexAssets = indexEntity.assets;
		for (let i = 0; i < indexAssets.length; i++) {
			const chainIDToAssetMappingEntity = loadChainIDToAssetMappingEntity(
				indexAssets[i],
			);
			const chainIDAssetArray = chainIDToAssetMappingEntity.assets;
			for (let y = 0; y < chainIDAssetArray.length; y++) {
				const indexAssetEntity = loadIndexAssetEntity(chainIDAssetArray[y]);
				indexAssetEntity.balance = indexAssetEntity.balance.times(assetScalar);
				indexAssetEntity.save();
			}
		}

		indexEntity.k = indexEntity.k!.minus(event.params.k);

		indexEntity.save();
	}

	saveHistoricalData(event.address, event.block.timestamp);
}

export function handleFeeAccrued(event: FeeAccrued): void {
	const indexEntity = createOrLoadIndexEntity(event.address);

	const scalar = new BigDecimal(TEN.pow(u8(indexEntity.decimals)));
	const fees = new BigDecimal(
		event.params.AUMFee.plus(event.params.depositFee).plus(
			event.params.redemptionFee,
		),
	).div(scalar);

	indexEntity.totalFees = indexEntity.totalFees!.plus(fees);

	indexEntity.save();
}

export function handleSetConfigBuilder(event: SetConfigbuilderEvent): void {
	const indexContext = dataSource.context();
	const indexAddress = indexContext.getBytes("indexAddress");
	const reserveAsset = indexContext.getBytes("reserveAsset");
	const chainID = indexContext.getBigInt("chainID");

	const configBuilderContext = new DataSourceContext();
	configBuilderContext.setBytes("indexAddress", indexAddress);
	configBuilderContext.setBytes("reserveAsset", reserveAsset);
	configBuilderContext.setBigInt("chainID", chainID);
	
	ConfigBuilderTemplate.createWithContext(
		event.params.configBuilder,
		configBuilderContext,
	);
}
