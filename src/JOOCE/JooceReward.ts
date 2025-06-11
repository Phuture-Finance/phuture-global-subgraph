import { Address } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent } from "../../generated/ERC20/ERC20"
import { createOrLoadJooceRewardEntity } from "../EntityCreation"

export function handleJooceTransfer(event: TransferEvent): void {
    if (event.params.to.equals(Address.fromString("0x004fd4bcc4c9989c18a1a1463241b7ccec9f7051"))) {
    createOrLoadJooceRewardEntity(event.transaction.hash,event.logIndex,event.block.timestamp,event.params.from, event.params.to,event.params.value)
    }
}