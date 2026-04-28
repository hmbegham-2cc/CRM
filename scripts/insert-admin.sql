INSERT INTO "User" ("id","email","name","role","password")
VALUES ('admin_seed_001','admin@2cconseil.com','Admin CRC','ADMIN','$2b$10$R7XQmBtROFD311dDsockGudc2Ba7wSK/PbY3yxFEVb2as34LsKLra')
ON CONFLICT ("email")
DO UPDATE SET
  "role"='ADMIN',
  "password"=EXCLUDED."password",
  "name"=EXCLUDED."name";
