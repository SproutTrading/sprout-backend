import { db_pool } from "../constants";

export async function insert_user(public_key: string, group_id: number, role_id: number, nonce: string, display_name: string, username: string) {
    const query = 'INSERT INTO users(public_key, group_id, role_id, nonce, display_name, username) VALUES($1, $2, $3, $4, $5, $6) RETURNING *'
    const values = [public_key, group_id, role_id, nonce, display_name, username];
    const result = await db_pool.query(query, values);
    return result && result.rows.length > 0 ? result.rows[0] : null
}

export async function select_users(public_key?: string) {
    const query = public_key ? `SELECT * FROM users WHERE public_key = $1` : `SELECT * FROM users`;
    const values = public_key ? [public_key] : [];
    const result = await db_pool.query(query, values);
    return result.rows;
}

export async function check_username(username: string): Promise<number> {
    const query = `SELECT COUNT(*) FROM users where username = $1`;
    const values = [username];
    const result = await db_pool.query(query, values);
    return result.rows.length > 0 ? +(result.rows[0].count as number) : 0;
}

export async function update_user_nonce(public_key: string, nonce: string) {
    const query = `UPDATE users SET nonce = $2 WHERE public_key = $1`;
    const values = [public_key, nonce];
    const result = await db_pool.query(query, values);
    return result && result.rowCount && result.rowCount > 0 ? true : false;
}

export async function update_user_socials(public_key: string, twitter: string, telegram: string, discord: string, github: string) {
    const query = `UPDATE users SET twitter = $2, telegram = $3, discord = $4, github = $5 WHERE public_key = $1`;
    const values = [public_key, twitter, telegram, discord, github];
    const result = await db_pool.query(query, values);
    return result && result.rowCount && result.rowCount > 0 ? true : false;
}

export async function get_users_resources() {
    const query = `select count(*), object_id, contributed from users_inventory group by object_id, contributed`;
    const result = await db_pool.query(query, []);
    return result.rows;
}

export async function get_user_resources(user_id: number) {
    const query = `select count(*), object_id, contributed from users_inventory where user_id = $1 group by object_id, contributed`;
    const values = [user_id];
    const result = await db_pool.query(query, values);
    return result.rows;
}

export async function get_user_claims(user_id: number) {
    const query = `select * FROM users_claims where user_id = $1 order by date_added desc limit 1;`;
    const values = [user_id];
    const result = await db_pool.query(query, values);
    return result.rows;
}

export async function insert_user_claim(user_id: number) {
    const query = 'INSERT INTO users_claims(user_id) VALUES($1) RETURNING *'
    const values = [user_id];
    const result = await db_pool.query(query, values);
    return result && result.rows.length > 0 ? result.rows[0] : null
}

export async function insert_user_inventory(user_id: number, object_id: number, contributed: boolean = false, epoch?: number, date_contributed?: Date, pumpfun_contract_id?: number) {
    const query = 'INSERT INTO users_inventory(user_id, object_id, contributed, epoch, date_contributed, pumpfun_contract_id) VALUES($1, $2, $3, $4, $5, $6) RETURNING *'
    const values = [user_id, object_id, contributed, epoch, date_contributed, pumpfun_contract_id];
    const result = await db_pool.query(query, values);
    return result && result.rows.length > 0 ? result.rows[0] : null
}

export async function get_users_leaderboard() {
    const query = `SELECT inner_user_id as user_id, display_name, public_key,  water, fertilizer, sunshine, contributions, ui.date_contributed as latest_contribution_date FROM (
SELECT i.user_id as inner_user_id,
count( CASE WHEN i.object_id = 1 then 1 end) AS water,
count( CASE WHEN i.object_id = 2 then 1 end) AS fertilizer,
count( CASE WHEN i.object_id = 3 then 1 end) AS sunshine,
count(i.object_id) as contributions,
  public_key,
  display_name
from users u join users_inventory i on u.id = i.user_id 
where i.contributed = true AND i.pumpfun_contract_id IS NULL
group by i.user_id, public_key, display_name
) AS users_leaderboard left JOIN users_inventory ui on ui.id = object_id
order by contributions DESC, date_contributed ASC
limit 50`;
    const result = await db_pool.query(query);
    return result.rows;
}


export async function get_resources_contributions() {
    const query = `SELECT count(i.object_id), i.object_id from users u join users_inventory i on u.id = i.user_id where i.contributed = true AND i.pumpfun_contract_id IS NULL group by i.object_id;`;
    const result = await db_pool.query(query);
    return result.rows;
}

export async function get_total_contributors() {
    const query = `SELECT count(DISTINCT (u.id)) from users u join users_inventory i on u.id = i.user_id where i.contributed = true AND i.pumpfun_contract_id IS NULL`;
    const result = await db_pool.query(query);
    return result.rows;
}

export async function get_first_resource(user_id: number, object_id: number) {
    const query = `SELECT * FROM users_inventory WHERE user_id = $1 AND object_id = $2 AND contributed = false ORDER BY id ASC LIMIT 1`;
    const values = [user_id, object_id];
    const result = await db_pool.query(query, values);
    return result.rows;
}

export async function update_resource(user_id: number, id: number, contributed: boolean, epoch: number, date_contributed: Date, tokenId: number) {
    const query = `UPDATE users_inventory SET contributed = $3, epoch = $4, date_contributed = $5, pumpfun_contract_id = $6 WHERE user_id = $1 AND id = $2`;
    const values = [user_id, id, contributed, epoch, date_contributed, tokenId];
    const result = await db_pool.query(query, values);
    return result && result.rowCount && result.rowCount > 0 ? true : false;
}

export async function get_resources_by_epoch() {
    const query = `SELECT 
	epoch,
	count(CASE WHEN i.object_id = 1 then 1 end) AS water,
	count(CASE WHEN i.object_id = 2 then 1 end) AS fertilizer,
	count(CASE WHEN i.object_id = 3 then 1 end) AS sunshine
from users_inventory as i where contributed = true AND pumpfun_contract_id IS NULL
group by i.epoch
order by i.epoch asc
`;
    const result = await db_pool.query(query);
    return result.rows;
}

export async function get_user_rank(user_id: number) {
    const query = `
    SELECT * FROM (
SELECT inner_user_id as user_id, display_name, public_key,  water, fertilizer, sunshine, contributions, ui.date_contributed as latest_contribution_date
, row_number() over(order by contributions DESC, date_contributed ASC) as rank
FROM (
Select i.user_id as inner_user_id,
count( CASE WHEN i.object_id = 1 then 1 end) AS water,
count( CASE WHEN i.object_id = 2 then 1 end) AS fertilizer,
count( CASE WHEN i.object_id = 3 then 1 end) AS sunshine,
count(i.object_id) as contributions,
  public_key,
  display_name
from users u join users_inventory i on u.id = i.user_id 
where i.contributed = true AND i.pumpfun_contract_id IS NULL
group by i.user_id, public_key, display_name
) AS users_ranks_inner JOIN users_inventory ui on ui.id = object_id
order by contributions DESC, date_contributed ASC
) AS user_ranks WHERE user_id = $1`
    const values = [user_id];
    const result = await db_pool.query(query, values);
    return result.rows;
}

export async function insert_pumpfun_wallet(public_key: string, private_key: string) {
    const query = 'INSERT INTO pumpfun_contracts(public_key, private_key) VALUES($1, $2) RETURNING *'
    const values = [public_key, private_key];
    const result = await db_pool.query(query, values);
    return result && result.rows.length > 0 ? result.rows[0] : null
}

export async function get_pumpfun_contract() {
    const query = `SELECT * FROM pumpfun_contracts WHERE user_id IS NULL ORDER BY id ASC LIMIT 1`;
    const result = await db_pool.query(query);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

export async function get_pumpfun_contract_by_id(id: number) {
    const query = `SELECT * FROM pumpfun_contracts WHERE id = $1`;
    const result = await db_pool.query(query, [id]);
    return result.rows && result.rows.length > 0 ? result.rows[0] : null;
}

export async function update_pumpfun_contract_user(id: number, user_id: number) {
    const query = `UPDATE pumpfun_contracts SET user_id = $2 WHERE id = $1`;
    const values = [id, user_id];
    const result = await db_pool.query(query, values);
    return result && result.rowCount && result.rowCount > 0 ? true : false;
}

export async function update_pumpfun_contract_launch(id: number, launched: boolean) {
    const query = `UPDATE pumpfun_contracts SET launched = $2 WHERE id = $1`;
    const values = [id, launched];
    const result = await db_pool.query(query, values);
    return result && result.rowCount && result.rowCount > 0 ? true : false;
}

export async function get_count_pumpfun_launched_contracts() {
    const query = `SELECT count(*) FROM pumpfun_contracts WHERE launched = true`;
    const result = await db_pool.query(query);
    return result.rows && result.rows.length > 0 ? result.rows[0].count : 0;
}

export async function get_pumpfun_launched_contracts(offset: number, limit: number) {
    const query = `SELECT 
	pc.id, 
	public_key,
	count(CASE WHEN ui.object_id = 1 then 1 end) AS water,
	count(CASE WHEN ui.object_id = 2 then 1 end) AS fertilizer,
	count(CASE WHEN ui.object_id = 3 then 1 end) AS sunshine,
	count(ui.object_id) total,
	MIN(date_contributed) as date_contributed
FROM pumpfun_contracts pc
LEFT JOIN users_inventory ui 
ON pc.id = ui.pumpfun_contract_id
WHERE launched = true
GROUP BY pc.id
ORDER BY total DESC, date_contributed ASC, pc.id ASC
LIMIT $2 OFFSET $1`;
    const result = await db_pool.query(query, [offset, limit]);
    return result.rows;
}
export async function get_pumpfun_launched_contract(id: number) {
    const query = `SELECT 
	pc.id, 
	public_key,
	count(CASE WHEN ui.object_id = 1 then 1 end) AS water,
	count(CASE WHEN ui.object_id = 2 then 1 end) AS fertilizer,
	count(CASE WHEN ui.object_id = 3 then 1 end) AS sunshine,
	count(ui.object_id) total,
	MIN(date_contributed) as date_contributed
FROM pumpfun_contracts pc
LEFT JOIN users_inventory ui 
ON pc.id = ui.pumpfun_contract_id
WHERE launched = true AND pc.id = $1
GROUP BY pc.id
ORDER BY total DESC, date_contributed ASC, pc.id ASC`;
    const result = await db_pool.query(query, [id]);
    return result && result.rows.length > 0 ? result.rows[0] : null
}