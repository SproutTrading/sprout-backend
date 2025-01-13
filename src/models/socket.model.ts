import { Socket } from "socket.io";
import { DefaultEventsMap } from "@socket.io/component-emitter";

export type UserSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> & {
    decoded: {
        id: number
    }
}   