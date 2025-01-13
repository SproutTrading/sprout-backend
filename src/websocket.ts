import dotenv from 'dotenv';
dotenv.config();

import { Server } from "socket.io";
const io_instance = new Server({
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});
io_instance.listen(+process.env.WS_PORT!);
export default io_instance;