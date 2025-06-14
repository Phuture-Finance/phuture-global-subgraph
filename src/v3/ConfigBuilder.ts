import {
        BigDecimal,
        BigInt,
        Bytes,
        dataSource,
        ethereum,
        log
} from "@graphprotocol/graph-ts";

import {
	ConfigUpdated as ConfigUpdatedEvent,
	CurrencyRegistered as CurrencyRegisteredEvent,
	FinishRebalancing as FinishRebalancingEvent,
	FinishVaultRebalancing as FinishVaultRebalancingEvent,
	StartRebalancing as StartRebalancingEvent,
} from "../../generated/templates/ConfigBuilderV3/ConfigBuilderV3";
import {
	createOrLoadAnatomyEntity,
	createOrLoadChainIDToAssetMappingEntity,
	createOrLoadConfigEntity,
	createOrLoadCurrencySetEntity,
	createOrLoadHistoricalIndexAssetEntity,
	createOrLoadHistoricalIndexBalanceEntity,
	createOrLoadIndexAssetEntity,
	createOrLoadIndexEntity,
	loadChainIDToAssetMappingEntity,
	loadIndexAssetEntity,
} from "../EntityCreation";

import { BP, ONE, TEN, WAD, ZERO } from "../constants";
import { convertAUMFeeRate } from "../v1/FeePool";

export function handleConfigUpdate(event: ConfigUpdatedEvent): void {
	const indexAddress = dataSource.context().getBytes("indexAddress");
	const indexEntity = createOrLoadIndexEntity(indexAddress);
	const configEntity = createOrLoadConfigEntity(indexAddress);
	const decoded = ethereum
		.decode(
			"((uint256,bool,address),(uint16,bool),(uint16,bool))",
			event.params.encodedConfig,
		)!
		.toTuple();
	configEntity.AUMDilutionPerSecond = decoded[0].toTuple()[0].toBigInt();
	configEntity.useCustomAUMFee = decoded[0].toTuple()[1].toBoolean();
	configEntity.metadata = decoded[0].toTuple()[2].toAddress();
	configEntity.depositFeeInBP = decoded[1].toTuple()[0].toBigInt();
	configEntity.depositCustomCallback = decoded[1].toTuple()[1].toBoolean();
	configEntity.redemptionFeeInBP = decoded[2].toTuple()[0].toBigInt();
	configEntity.redemptionCustomCallback = decoded[2].toTuple()[1].toBoolean();
	const aumFee = decoded[0].toTuple()[0].toBigInt();
	const scalar = new BigDecimal(BP);
	const mintingFee = new BigDecimal(decoded[1].toTuple()[0].toBigInt()).div(
		scalar,
	);
	const redemptionFee = new BigDecimal(decoded[2].toTuple()[0].toBigInt()).div(
		scalar,
	);
	indexEntity.mintingFee = mintingFee;
	indexEntity.redemptionFee = redemptionFee;
	indexEntity.save();
	configEntity.save();
	convertAUMFeeRate(indexAddress, aumFee);
}

export function handleStartRebalancing(event: StartRebalancingEvent): void {
	const indexAddress = dataSource.context().getBytes("indexAddress");
	const indexEntity = createOrLoadIndexEntity(indexAddress);
	indexEntity.isRebalancing = true;
	indexEntity.save();
}

export function handleCurrencyRegistered(event: CurrencyRegisteredEvent): void {
        const builderContext = dataSource.context()
        const indexAddress = builderContext.getBytes("indexAddress");
        const chainID = builderContext.getBigInt("chainID");

	const indexAssetEntity = createOrLoadIndexAssetEntity(
		indexAddress,
		event.params.currency,
		chainID,
	);
	const chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(
		indexAddress,
		chainID,
	);
	indexAssetEntity.name = event.params.name;
	indexAssetEntity.symbol = event.params.symbol;
	indexAssetEntity.decimals = event.params.decimals;
	indexAssetEntity.currencyID = chainIDToAssetMappingEntity.registeredAssets;

	chainIDToAssetMappingEntity.registeredAssets =
		chainIDToAssetMappingEntity.registeredAssets!.plus(ONE);

	chainIDToAssetMappingEntity.save();
	indexAssetEntity.save();
}

export function handleFinishChainRebalancing(
	event: FinishVaultRebalancingEvent,
): void {
	const indexAddress = dataSource.context().getBytes("indexAddress");
	const reserveAsset = dataSource.context().getBytes("reserveAsset");
	const indexEntity = createOrLoadIndexEntity(indexAddress);
	const chainID = dataSource.context().getBigInt("chainID");
	const chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(
		indexAddress,
		chainID,
	);
	chainIDToAssetMappingEntity.latestSnapshot = event.params.snapshot;
	if (event.params.currencies.length == 0) {
		for (let i = 0; i < chainIDToAssetMappingEntity.assets.length; i++) {
			const indexAssetEntity = loadIndexAssetEntity(
				chainIDToAssetMappingEntity.assets[i],
			);
			indexAssetEntity.balance = BigDecimal.zero();
			indexAssetEntity.weight = ZERO;
			indexAssetEntity.save();
		}
		const emptyAssetArray: string[] = [];
		if (chainID == indexEntity.chainID) {
			emptyAssetArray.push(
				createOrLoadIndexAssetEntity(
					indexAddress,
					reserveAsset,
					indexEntity.chainID,
				).id,
			);
		}
		chainIDToAssetMappingEntity.assets = emptyAssetArray;
		chainIDToAssetMappingEntity.save();

		const indexAssets = indexEntity.assets;
		const idx = indexAssets.indexOf(chainIDToAssetMappingEntity.id);
		indexAssets.splice(idx, 1);
		indexEntity.assets = indexAssets;
		indexEntity.save();
	} else {
		const chainIDAssetArray: string[] = [];
		const reserveAssetEntity = createOrLoadIndexAssetEntity(
			indexAddress,
			reserveAsset,
			indexEntity.chainID,
		);
		if (chainID == indexEntity.chainID) {
			reserveAssetEntity.balance = BigDecimal.zero();
			reserveAssetEntity.save();
			chainIDAssetArray.push(reserveAssetEntity.id);
		}
		for (let i = 0; i < event.params.currencies.length; i++) {
			const balance = new BigDecimal(event.params.balances[i]);
			const asset = event.params.currencies[i];
			log.warning('FinishVaultRebalancingEvent currencies[i] = {}', [asset.toHexString()])
			const indexAssetEntity = createOrLoadIndexAssetEntity(
				indexAddress,
				asset,
				chainID,
			);
			const scalar = new BigDecimal(TEN.pow(u8(indexAssetEntity.decimals)));
			indexAssetEntity.balance = balance.div(scalar);
			indexAssetEntity.save();
			if (indexAssetEntity.id != reserveAssetEntity.id) {
				chainIDAssetArray.push(indexAssetEntity.id);
			}
		}
		for (let i = 0; i < chainIDToAssetMappingEntity.assets.length; i++) {
			const id = chainIDToAssetMappingEntity.assets[i];
			if (!chainIDAssetArray.includes(id)) {
				const indexAssetEntity = loadIndexAssetEntity(id);
				indexAssetEntity.balance = BigDecimal.zero();
				indexAssetEntity.weight = ZERO;
				indexAssetEntity.save();
			}
		}
		chainIDToAssetMappingEntity.assets = chainIDAssetArray;
		chainIDToAssetMappingEntity.save();

                if (!indexEntity.assets.includes(chainIDToAssetMappingEntity.id)) {
                        const indexAssetArray = indexEntity.assets;
                        indexAssetArray.push(chainIDToAssetMappingEntity.id);
                        indexEntity.assets = indexAssetArray;
                        indexEntity.save();
                }
	}
	chainIDToAssetMappingEntity.save();
	indexEntity.k = WAD;
	indexEntity.save();
	saveHistoricalData(indexAddress, event.block.timestamp);
}

export function saveHistoricalData(index: Bytes, timestamp: BigInt): void {
	const indexEntity = createOrLoadIndexEntity(index);
	const historicalIndexBalanceEntity = createOrLoadHistoricalIndexBalanceEntity(
		index,
		timestamp,
	);
	historicalIndexBalanceEntity.totalSupply = indexEntity.totalSupply;
	const historicalIndexAssetArray: string[] = [];
	for (let i = 0; i < indexEntity.assets.length; i++) {
		const chainIDToAssetMappingEntity = loadChainIDToAssetMappingEntity(
			indexEntity.assets[i],
		);
		const chainID = chainIDToAssetMappingEntity.chainID;
		for (let y = 0; y < chainIDToAssetMappingEntity.assets.length; y++) {
			const indexAssetEntity = loadIndexAssetEntity(
				chainIDToAssetMappingEntity.assets[y],
			);
			const historicalIndexAssetEntity = createOrLoadHistoricalIndexAssetEntity(
				index,
				indexAssetEntity.asset,
				chainID,
				timestamp,
			);
			historicalIndexAssetEntity.balance = indexAssetEntity.balance;
			if (indexAssetEntity.weight) {
				historicalIndexAssetEntity.weight = indexAssetEntity.weight;
			}
			historicalIndexAssetEntity.save();
			historicalIndexAssetArray.push(historicalIndexAssetEntity.id);
		}
	}
	historicalIndexBalanceEntity.assets = historicalIndexAssetArray;
	historicalIndexBalanceEntity.save();
}

export function handleFinishRebalancing(event: FinishRebalancingEvent): void {
	let indexAddress = dataSource.context().getBytes('indexAddress')
	const chainID = dataSource.context().getBigInt('chainID')
	let indexEntity = createOrLoadIndexEntity(indexAddress)
	let anatomyEntity = createOrLoadAnatomyEntity(indexAddress)
	let anatomyArray: string[] = []
	let chainIndexArray = [chainID]
	for (let i = 0; i < chainIndexArray.length; i++) {
		let currencySetEntity = createOrLoadCurrencySetEntity(indexAddress, chainIndexArray[i])
		currencySetEntity.sets = [event.params.newCurrencyIdSet[i]]
		currencySetEntity.save()
		anatomyArray.push(currencySetEntity.id)
		let chainIDToAssetMappingEntity = createOrLoadChainIDToAssetMappingEntity(indexAddress, chainID)

		for (let x = 0; x < chainIDToAssetMappingEntity.assets.length; x++) {
			const indexAssetEntity = loadIndexAssetEntity(chainIDToAssetMappingEntity.assets[x])
			indexAssetEntity.weight = event.params.weights[x]
			indexAssetEntity.save()
		}

	}
	indexEntity.isRebalancing = false
	anatomyEntity.chainIdSet = event.params.newCurrencyIdSet
	anatomyEntity.currencyIdSets = anatomyArray
	anatomyEntity.save()
	indexEntity.save()
}

export function convertBitSetToIDs(array: BigInt[]): BigInt[] {
	const IDArray: BigInt[] = [];
	for (let i = 0; i < array.length; i++) {
		if (array[i] == ONE) {
			IDArray.push(BigInt.fromI32(i));
		}
	}
	return IDArray;
}

export function convertBigIntsToBitArray(array: BigInt[]): BigInt[] {
	let expandedBitArray: BigInt[] = [];
	for (let i = 0; i < array.length; i++) {
		const bitArray: BigInt[] = [];
		let chainBitSet = array[i];
		while (chainBitSet > ZERO) {
			bitArray.push(chainBitSet.bitAnd(ONE));
			chainBitSet = chainBitSet.rightShift(1);
		}
		expandedBitArray = expandedBitArray.concat(bitArray);
	}
	return expandedBitArray;
}
