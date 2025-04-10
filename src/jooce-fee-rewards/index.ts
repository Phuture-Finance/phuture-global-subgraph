import { log, Address } from "@graphprotocol/graph-ts"
import { Transfer as TransferEvent } from "../../generated/ERC20/ERC20"
import { JooceFeeReward as TransferEntity } from "../../generated/schema"

export function handleJooceTransfer(event: TransferEvent): void {
    log.debug("HandleJooceTransfer event hash: {} from: {} logIndex: {} to: {}", [event.transaction.hash.toHexString(), event.params.from.toHexString(), event.logIndex.toHexString(), event.params.to.toHexString()])
    const id = `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
    if (event.params.to == Address.fromString("0x004fd4bcc4c9989c18a1a1463241b7ccec9f7051")) {
        const reward = new TransferEntity(id)
        reward.from = event.params.from
        reward.to = event.params.to
        reward.value = event.params.value
        reward.timestamp = event.block.timestamp
        reward.save()
    }
}