import { fetchSolanaPrice } from "../api/coingecko";

(async () => {
    let price = await fetchSolanaPrice();
    console.log((25 / price).toFixed(9));
})();