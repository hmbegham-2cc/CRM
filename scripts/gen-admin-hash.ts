import bcrypt from "bcryptjs";

const password = "admin@2cconseil.com";
bcrypt.hash(password, 10).then((hash) => {
  console.log("Hash:", hash);
  console.log("\nSQL:");
  console.log(`INSERT INTO "User" ("id","email","name","role","password")
VALUES ('admin_seed_001','admin@2cconseil.com','Admin CRC','ADMIN','${hash}')
ON CONFLICT ("email")
DO UPDATE SET
  "role"='ADMIN',
  "password"=EXCLUDED."password",
  "name"=EXCLUDED."name";`);
});
