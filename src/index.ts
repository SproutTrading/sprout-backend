import dotenv from 'dotenv';
dotenv.config();

import cors from "cors";
import errorHandler from "errorhandler";
import xmlparser from "express-xml-bodyparser";
import express from "express";
import { loginUser, getNonce, checkUsernameAvailability, registerUser, updateSocials, getSocials } from "./http/user";
import { isEmptyOrNull, logDetails } from './utils/utils';
import io_instance from './websocket';
import { verifyData } from './utils/jwt-helper';
import { isAuthorized } from './utils/security';
import { getUserResources, getUserClaimableResourcesData, claimResources, contributeResources, getResourcesEpochs } from './http/resources';
import { getLeaderboard } from './http/leaderboard';
import { getSproutAddress, getSproutStatistics } from './http/token';
import { UserSocket } from './models/socket.model';
import { getPumfunTokens, launchPumpfun } from './http/pumpfun';

(async () => {
    const app = express();
    app.use(xmlparser());
    app.use(cors());
    app.set('port', process.env.PORT || 3000);
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({
        extended: true
    }));
    app.post('/oauth', loginUser);
    app.post('/oauth/nonce', getNonce);
    app.post('/oauth/register', registerUser);
    app.post('/oauth/username/check', checkUsernameAvailability);
    app.post(`/users/self/socials`, isAuthorized, updateSocials);

    app.get(`/users/self/socials`, isAuthorized, getSocials);

    app.get(`/resources/data`, isAuthorized, getUserResources);
    app.get(`/resources/claim`, isAuthorized, getUserClaimableResourcesData);
    app.get(`/resources/epochs`, getResourcesEpochs);

    app.post(`/resources/claim`, isAuthorized, claimResources);
    app.post(`/resources/contribute`, isAuthorized, contributeResources);

    app.get(`/leaderboard`, getLeaderboard);
    app.get(`/token/sprout/address`, getSproutAddress);
    app.get(`/token/sprout/statistics`, getSproutStatistics);

    app.post(`/pumpfun`, isAuthorized, launchPumpfun);
    app.get(`/pumpfun/farm`, getPumfunTokens);

    app.use(errorHandler());
    const server = app.listen(app.get('port'), () => {
        logDetails(`[INIT] App is running at http://localhost:${app.get('port')}`);
    });

    io_instance.use(function (socket, next) {
        if (!isEmptyOrNull(socket.handshake.auth) && !isEmptyOrNull(socket.handshake.auth.token)) {
            const token = socket.handshake.auth.token;
            verifyData(token, (err: any, decoded: any) => {
                if (!err) {
                    (socket as UserSocket).decoded = decoded;
                }
            });
        }
        next();
    }).on('connection', async function (socket) {
        let user_socket = socket as UserSocket;
        let id = user_socket.id;
        let userId: number;
        if (user_socket && user_socket.decoded && user_socket.decoded.id) {
            userId = user_socket.decoded.id;
            console.log(`User ${id} - ${userId} joined`);
            socket.join(`room_${userId}`);
        }

        socket.on('disconnect', (data) => {
            console.log(`User ${id} - ${userId ?? 'unknown'} dced`);
        })
    })
})();