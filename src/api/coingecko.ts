import axios from "axios";

export async function fetchSolanaPrice() {
    let url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum%2Cbitcoin%2Cbinancecoin%2Csolana&order=market_cap_desc&per_page=100&page=1&sparkline=false&locale=en`;
    try {
        let resp = await axios.get(url);
        if (resp && resp.data && Array.isArray(resp.data) && resp.data.length > 0) {
            let data = resp.data;
            const foundSolana = data.find(x => x.id === "solana");
            if (foundSolana) {
                return foundSolana.current_price;
            } else {
                return 0;
            }
        }
    } catch (err) {
        return 0;
    }
}