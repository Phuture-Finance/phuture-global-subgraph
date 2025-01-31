import { BigInt } from "@graphprotocol/graph-ts"; 

export const ZERO = BigInt.zero();
export const ONE = BigInt.fromI32(1);
export const TEN = BigInt.fromI32(10);
export const BP = BigInt.fromI32(10000);
export const WAD = TEN.pow(18);
