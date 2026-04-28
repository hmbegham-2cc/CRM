import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.mssihzqvxdndovvohqch:rUaCylwq3Ags0F3N@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
});

const hash = '$2b$10$R7XQmBtROFD311dDsockGudc2Ba7wSK/PbY3yxFEVb2as34LsKLra';

const sql = `
INSERT INTO "User" ("id","email","name","role","password")
VALUES ('admin_seed_001','admin@2cconseil.com','Admin CRC','ADMIN','${hash}')
ON CONFLICT ("email")
DO UPDATE SET
  "role"='ADMIN',
  "password"=EXCLUDED."password",
  "name"=EXCLUDED."name";
`;

await client.connect();
const result = await client.query(sql);
console.log('Inserted/Updated rows:', result.rowCount);
await client.end();
