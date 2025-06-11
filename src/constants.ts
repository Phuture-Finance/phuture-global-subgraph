
// Common numeric constants used across the subgraph. These are
// intentionally kept in one place to avoid duplication and to
// make it clear what base units are used when performing
// calculations.
import { BigInt } from "@graphprotocol/graph-ts";

export const ZERO = BigInt.zero();
export const ONE = BigInt.fromI32(1);
export const TEN = BigInt.fromI32(10);
export const BP = BigInt.fromI32(10000);
export const WAD = TEN.pow(18);
// Used when checking for the null address in smart contract events
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ADDRESS_LENGTH = ZERO_ADDRESS.length
