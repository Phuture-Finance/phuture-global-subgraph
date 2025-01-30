import { DataSourceContext, dataSource } from "@graphprotocol/graph-ts"
import { ConfigBuilderV3 as ConfigBuilderTemplate } from "../../generated/templates/ConfigBuilderV3/ConfigBuilderV3"
import { SetConfigBuilder as SetConfigbuilderEvent } from "../../generated/templates/AutoGovernanceV3/AutoGovernanceV3"


export function handleSetConfigBuilder(event: SetConfigbuilderEvent): void {
    let indexAddress = dataSource.context().getBytes('indexAddress')
    let reserveAsset = dataSource.context().getBytes('reserveAsset')
    let context = new DataSourceContext()
    context.setBytes('indexAddress', indexAddress)
    context.setBytes('reserveAsset', reserveAsset)
    ConfigBuilderTemplate.createWithContext(event.params.param0, context)
}