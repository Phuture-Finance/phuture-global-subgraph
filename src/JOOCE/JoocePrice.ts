// Periodically samples the JOOCE/USDC price from Uniswap V3 pools and
// stores it so historical price charts can be generated.
import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { UniV3Pool, Swap } from "../../generated/joocePool/UniV3Pool"
import { createOrLoadJoocePriceEntity } from "../EntityCreation";

export function handleJoocePrice(block: ethereum.Block): void {
    const jooceEthPoolAddress = Address.fromString("0xa491C1F081f3c44047b5711f883d20342EdeF5e1")
    const ethUsdcPoolAddress = Address.fromString("0xd0b53D9277642d899DF5C87A3966A349A798F224")
    const jooceEthPoolContract = UniV3Pool.bind(jooceEthPoolAddress)
    const ethUsdcPoolContract = UniV3Pool.bind(ethUsdcPoolAddress)
    const jooceEthPrice = getPrice(jooceEthPoolContract, 18, 18)
    const ethUsdcPrice = getPrice(ethUsdcPoolContract, 18, 6)
    const jooceUsdcPrice = jooceEthPrice.times(ethUsdcPrice)

    let joocePriceEntity = createOrLoadJoocePriceEntity(block.timestamp)
    joocePriceEntity.price = jooceUsdcPrice
    joocePriceEntity.save()
}

// Record JOOCE price whenever a swap occurs in the JOOCE/ETH pool.
export function handleJooceSwap(event: Swap): void {
    const ethUsdcPoolAddress = Address.fromString("0xd0b53D9277642d899DF5C87A3966A349A798F224")
    const ethUsdcPoolContract = UniV3Pool.bind(ethUsdcPoolAddress)

    const jooceEthPrice = getPriceFromSqrtPrice(event.params.sqrtPriceX96, 18, 18)
    const ethUsdcPrice = getPrice(ethUsdcPoolContract, 18, 6)
    const jooceUsdcPrice = jooceEthPrice.times(ethUsdcPrice)

    let joocePriceEntity = createOrLoadJoocePriceEntity(event.block.timestamp)
    joocePriceEntity.price = jooceUsdcPrice
    joocePriceEntity.save()
}


// Helper that reads the current price from a Uniswap V3 pool and
// returns it as a decimal adjusted for token decimals.
function getPrice(pool: UniV3Pool, decimalsToken0: u8, decimalsToken1: u8,): BigDecimal {
    const slot0Call = pool.try_slot0()
    if (slot0Call.reverted) {
        log.warning('slot0 call reverted', [])
        return BigDecimal.zero()
    }

    const sqrtPrice = slot0Call.value.getSqrtPriceX96()

    return getPriceFromSqrtPrice(sqrtPrice, decimalsToken0, decimalsToken1)

}

// Converts a sqrtPriceX96 value from a swap event into a decimal price.
function getPriceFromSqrtPrice(sqrtPrice: BigInt, decimalsToken0: u8, decimalsToken1: u8): BigDecimal {
    const sqrtPriceBD = sqrtPrice.toBigDecimal()
    const priceRaw = sqrtPriceBD.times(sqrtPriceBD).div(BigInt.fromI32(2).pow(192).toBigDecimal())
    const scaledPrice = priceRaw.times(BigInt.fromI32(10).pow(decimalsToken0 - decimalsToken1).toBigDecimal())

    return scaledPrice
}
