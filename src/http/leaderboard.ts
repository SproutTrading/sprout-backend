import { Request, Response } from 'express';
import { get_users_leaderboard, get_resources_contributions, get_total_contributors } from '../db';
import { GameObjects } from '../models/enums';
import { build_response } from '../utils/http_helper';
import { logDetails } from '../utils/utils';

export const getLeaderboardData = async () => {
    let leaderboard_users = await get_users_leaderboard();
    let resources_contributions = await get_resources_contributions();
    let total_contributors = await get_total_contributors();

    let water = 0;
    let fertilizer = 0;
    let sunshine = 0;
    let total_actions = 0;
    let gardeners = 0;
    let highest = 0;

    for (let resources_contribution of resources_contributions) {
        if (resources_contribution.object_id === GameObjects.WATER) {
            water = +resources_contribution.count;
        }
        if (resources_contribution.object_id === GameObjects.FERTILIZER) {
            fertilizer = +resources_contribution.count;
        }
        if (resources_contribution.object_id === GameObjects.SUNSHINE) {
            sunshine = +resources_contribution.count;
        }
    }
    gardeners = total_contributors.length > 0 ? +total_contributors[0].count : 0;
    total_actions = water + fertilizer + sunshine;
    if (leaderboard_users.length > 0) {
        highest = +leaderboard_users[0].contributions;
    }

    let leaderboard_data = {
        users: leaderboard_users,
        statistics: {
            highest,
            water,
            fertilizer,
            sunshine,
            total_actions,
            gardeners
        }
    }

    return leaderboard_data;
}

export const getLeaderboard = async (req: Request, res: Response) => {
    try {
        let leaderboard_data = await getLeaderboardData();
        return res.status(200).json(build_response(true, leaderboard_data));
    } catch (err) {
        logDetails(`Error get socials: ${err}`);
        return res.status(200).json(build_response(false, null, err as string));
    }
}