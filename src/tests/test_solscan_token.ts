import dotenv from 'dotenv';
dotenv.config();

import axios from "axios";

(async () => {
    let { data: { data, success } } = await axios.get(`https://pro-api.solscan.io/v2.0/token/meta?address=${process.env.TOKEN_ADDRESS!}`, {
        headers: {
            "token": process.env.SOLSCAN_API_KEY!
        }
    });
    console.log(data)
    console.log(success);
})();