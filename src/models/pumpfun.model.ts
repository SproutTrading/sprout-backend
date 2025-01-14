export type PumpfunIpfsResponse = {
    metadataUri: string,
    metadata: {
        name: string,
        symbol: string,
        description: String,
        image: string,
        showName: boolean,
        createdOn: string
    }
}