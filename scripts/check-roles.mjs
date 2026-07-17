import { openDb, createSchema, ensureAuthAccounts } from '../server/src/db.js'

const db = openDb()
createSchema(db)
ensureAuthAccounts(db)

// mirror ensureFormChannelOwners insert
const map = [
  ['工信部', 'u_ch_miit', '梁承泽'],
  ['科技部', 'u_ch_most', '纪清岚'],
  ['发改委', 'u_ch_ndrc', '唐砚秋'],
  ['市科委', 'u_ch_shkc', '许怀川'],
  ['ZGSF', 'u_ch_zgsf', '韩叙白'],
]
const upsert = db.prepare(`INSERT INTO transition_channel_owners (source_channel,owner_user_id,owner_name,can_import,can_export)
  VALUES (?,?,?,1,1)
  ON CONFLICT(source_channel) DO UPDATE SET owner_user_id=excluded.owner_user_id, owner_name=excluded.owner_name`)
for (const [ch, id, name] of map) upsert.run(ch, id, name)

const owners = db.prepare('SELECT * FROM transition_channel_owners ORDER BY source_channel').all()
const users = db.prepare(`SELECT id,name,role,scope,title FROM users
  WHERE role='leader' OR (role='mgmt' AND scope IN ('hq','channel','unit')) OR role='admin'
  ORDER BY scope, id`).all()
console.log('channel_owners', owners.length)
for (const o of owners) console.log(' -', o.source_channel, '→', o.owner_name)
console.log('key_users')
for (const u of users) console.log(' -', u.id, u.name, u.role, u.scope, '|', u.title)
