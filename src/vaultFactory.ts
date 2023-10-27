import { ByteArray, Bytes, BigInt, DataSourceContext, dataSource, log } from "@graphprotocol/graph-ts"
import {
  VTokenCreated as VTokenCreatedEvent
} from "../generated/templates/vaultFactory/vaultFactory"

import { vault } from "../generated/templates"

export function handleVTokenCreated(event: VTokenCreatedEvent): void {
  let index = dataSource.context().getBytes('indexAddress')
  let context = new DataSourceContext()
  context.setBytes('assetAddress', event.params.asset)
  context.setBytes('indexAddress', index)
  vault.createWithContext(event.params.vToken, context)
  log.debug("Vault contract should be created {}", [event.params.vToken.toHexString()])
}
