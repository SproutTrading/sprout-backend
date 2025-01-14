import { fetchSolanaPrice } from "../api/coingecko";

(async () => {
    let price = await fetchSolanaPrice();
    console.log((125 / price).toFixed(9));
})();