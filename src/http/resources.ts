import dotenv from 'dotenv';
dotenv.config();

import { Request, Response } from 'express';
import { get_user_resources, get_user_claims, insert_user_claim, insert_user_inventory, get_first_resource, update_resource, get_resources_by_epoch, get_user_rank } from '../db';
import { GameObjects } from '../models/enums';
import { build_response } from '../utils/http_helper';
import { checkField, getTimeWithOffset, logDetails } from '../utils/utils';
import { Connection } from '@solana/web3.js';
import { getLeaderboardData } from './leaderboard';
import io_instance from '../websocket';

export const getUserResources = async (req: Request, res: Response) => {
    try {
        let id = res.locals['authorizedUser'].id;
        const user_resources = await get_user_resources(id);
        const user_rank = await get_user_rank(id);
        let water_contributed = 0;
        let water_non_contributed = 0;
        let fertilizer_contributed = 0;
        let fertilizer_non_contributed = 0;
        let sunshine_contributed = 0;
        let sunshine_non_contributed = 0;
        let contributions = 0;
        let rank = -1;
        for (let user_resource of user_resources) {
            if (user_resource.object_id === GameObjects.WATER) {
                if (user_resource.contributed) {
                    water_contributed = +user_resource.count;
                } else {
                    water_non_contributed = +user_resource.count;
                }
            }
            if (user_resource.object_id === GameObjects.FERTILIZER) {
                if (user_resource.contributed) {
                    fertilizer_contributed = +user_resource.count;
                } else {
                    fertilizer_non_contributed = +user_resource.count;
                }
            }
            if (user_resource.object_id === GameObjects.SUNSHINE) {
                if (user_resource.contributed) {
                    sunshine_contributed = +user_resource.count;
                } else {
                    sunshine_non_contributed = +user_resource.count;
                }
            }
            if (user_resource.contributed) {
                contributions += +user_resource.count
            }
        }
        if (user_rank.length > 0) {
            rank = +user_rank[0].rank;
        }
        return res.status(200).json(build_response(true, {
            water: {
                contributed: water_contributed,
                non_contributed: water_non_contributed
            },
            fertilizer: {
                contributed: fertilizer_contributed,
                non_contributed: fertilizer_non_contributed
            },
            sunshine: {
                contributed: sunshine_contributed,
                non_contributed: sunshine_non_contributed
            },
            contributions,
            rank
        }));
    } catch (err) {
        logDetails(`Error get socials: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const getUserClaimableResourcesData = async (req: Request, res: Response) => {
    try {
        let id = res.locals['authorizedUser'].id;
        const user_claims = await get_user_claims(id);
        if (user_claims.length > 0) {
            let diff = Math.floor((getTimeWithOffset() - new Date(user_claims[0].date_added as Date).getTime()) / (1000 * 60));
            if (diff >= 60) {
                return res.status(200).json(build_response(true, {
                    date: null,
                    canClaim: true
                }));
            } else {
                return res.status(200).json(build_response(true, {
                    date: new Date(user_claims[0].date_added),
                    canClaim: false
                }));
            }
        } else {
            return res.status(200).json(build_response(true, {
                date: null,
                canClaim: true
            }));
        }
    } catch (err) {
        logDetails(`Error get user claimable resources: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const claimResources = async (req: Request, res: Response) => {
    try {
        let id = res.locals['authorizedUser'].id;
        const user_claims = await get_user_claims(id);
        if (user_claims.length > 0) {
            let diff = Math.floor((getTimeWithOffset() - new Date(user_claims[0].date_added as Date).getTime()) / (1000 * 60));
            if (diff >= 60) {
                await insert_user_claim(id);
                await insert_resources(id);
                return res.status(200).json(build_response(true, {
                    message: 'Successfully claimed resources'
                }));
            } else {
                throw new Error(`You can claim resources in ${60 - diff} minute${(60 - diff) > 1 ? 's' : ''}`);
            }
        } else {
            await insert_user_claim(id);
            await insert_resources(id);
            return res.status(200).json(build_response(true, {
                message: 'Successfully claimed resources'
            }));
        }
    } catch (err) {
        logDetails(`Error claiming resources: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const contributeResources = async (req: Request, res: Response) => {
    try {
        let { object_id } = req.body;
        checkField(object_id, "Object id cannot be empty!");
        if (isNaN(object_id) || object_id < 1 || object_id > 3) {
            throw new Error("Wrong object id!");
        }
        let id = res.locals['authorizedUser'].id;
        const user_resources = await get_first_resource(id, object_id);
        if (user_resources.length > 0) {
            let connection = new Connection(process.env.NODE_SOLANA_HTTP!, 'confirmed');
            let epoch = (await connection.getEpochInfo()).epoch;
            let updated = await update_resource(id, user_resources[0].id, true, epoch, new Date());
            if (!updated) {
                throw new Error(`Failed to update item`);
            }

            {
                let resourcesEpochsData = await getResourcesEpochsData();
                let leaderboardData = await getLeaderboardData();
                io_instance.emit('updateStatistics', {
                    epochs: resourcesEpochsData.epochs,
                    leaderboard: leaderboardData
                })
            }
            return res.status(200).json(build_response(true, {
                message: 'Successfully contributed item'
            }));
        } else {
            throw new Error(`No resources can be contributed for the current item`);
        }
    } catch (err) {
        logDetails(`Error getting contribution resources: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const getResourcesEpochsData = async () => {
    let connection = new Connection(process.env.NODE_SOLANA_HTTP!, 'confirmed');
    let { epoch, slotIndex, slotsInEpoch } = await connection.getEpochInfo();

    let resources_epochs: { epoch: number, water: number, fertilizer: number, sunshine: number }[] = await get_resources_by_epoch();
    let start_epoch = +process.env.SOLANA_EPOCH!;

    let resources_epochs_final: { epoch: number, water: number, fertilizer: number, sunshine: number, percentage: number, selected: boolean }[] = [];
    for (let i = start_epoch; i < start_epoch + 3; i++) {
        let found = resources_epochs.find(x => x.epoch === i);
        let data = {
            epoch: i,
            water: 0,
            fertilizer: 0,
            sunshine: 0,
            percentage: 0,
            selected: i === epoch
        };
        if (found) {
            data.water = +found.water;
            data.fertilizer = +found.fertilizer;
            data.sunshine = +found.sunshine;
        }
        resources_epochs_final.push(data);
        if (i < epoch) {
            data.percentage = 100;
        } else if (i == epoch) {
            data.percentage = +(slotIndex / slotsInEpoch * 100).toFixed(2);
        } else {
            data.percentage = 0;
        }
    }

    return {
        epochs: resources_epochs_final
    };
}

export const getResourcesEpochs = async (req: Request, res: Response) => {
    try {
        let resourcesEpochsData = await getResourcesEpochsData();
        return res.status(200).json(build_response(true, resourcesEpochsData));
    } catch (err) {
        logDetails(`Error get resources epochs: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}

export const insert_resources = async (user_id: number) => {
    for (let i = 0; i < 5; i++) {
        await insert_user_inventory(user_id, GameObjects.WATER);
    }
    for (let i = 0; i < 2; i++) {
        await insert_user_inventory(user_id, GameObjects.FERTILIZER);
    }
    for (let i = 0; i < 2; i++) {
        await insert_user_inventory(user_id, GameObjects.SUNSHINE);
    }
}