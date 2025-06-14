// Helper utilities for converting between chain identifiers and
// native asset metadata. These utilities allow handlers to remain
// agnostic of the underlying chain while still retrieving symbol
// and decimal information for the native token of that chain.
import { BigInt, TypedMap } from "@graphprotocol/graph-ts";

let chainIDMap = new TypedMap<BigInt, Array<string>>()
chainIDMap.set(BigInt.fromI32(43114), ["Avalanche", "AVAX", "18"])
chainIDMap.set(BigInt.fromI32(43113), ["Avalanche", "AVAX", "18"])
chainIDMap.set(BigInt.fromI32(80001), ["Matic", "MATIC", "18"])
chainIDMap.set(BigInt.fromI32(137), ["Matic", "MATIC", "18"])
chainIDMap.set(BigInt.fromI32(97), ["Binance Coin", "BNB", "18"])
chainIDMap.set(BigInt.fromI32(56), ["Binance Coin", "BNB", "18"])
chainIDMap.set(BigInt.fromI32(1), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(42161), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(10), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(8453), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(100), ["XDAI", "XDAI", "18"])
chainIDMap.set(BigInt.fromI32(10200), ["XDAI", "XDAI", "18"])
chainIDMap.set(BigInt.fromI32(5000), ["Mantle", "MNT", "18"])
chainIDMap.set(BigInt.fromI32(250), ["Fantom", "FTM", "18"])
chainIDMap.set(BigInt.fromI32(4002), ["Fantom", "FTM", "18"])
chainIDMap.set(BigInt.fromI32(1088), ["Metis", "METIS", "18"])
chainIDMap.set(BigInt.fromI32(59144), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(40), ["Telos", "TLOS", "18"])
chainIDMap.set(BigInt.fromI32(1313161554), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(204), ["Binance Coin", "BNB", "18"])
chainIDMap.set(BigInt.fromI32(41), ["Telos", "TLOS", "18"])
chainIDMap.set(BigInt.fromI32(5003), ["Mantle", "MNT", "18"])
chainIDMap.set(BigInt.fromI32(84532), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(421614), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(11155111), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(11155420), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(7700), ["Canto", "CANTO", "18"])
chainIDMap.set(BigInt.fromI32(59140), ["Ethereum", "ETH", "18"])
chainIDMap.set(BigInt.fromI32(5611), ["Binance Coin", "tBNB", "18"])

// Returns information about the native asset for a given chain ID.
// The returned array has the form [name, symbol, decimals].
export function selectNativeAsset(chainID: BigInt): Array<string> | null {
  return chainIDMap.get(chainID)
}