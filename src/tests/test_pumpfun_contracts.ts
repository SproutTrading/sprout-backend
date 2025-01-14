import { get_pumpfun_contract } from "../db";

(async () => {
    let contracts = await get_pumpfun_contract();
    console.log(contracts)
})();