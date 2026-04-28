import bcrypt from 'bcryptjs';

const password = 'admin@2cconseil.com';
const hash = await bcrypt.hash(password, 10);
console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nSQL:');
console.log(`INSERT INTO "User" (id, email, name, role, password, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@2cconseil.com',
  'Admin CRC',
  'ADMIN',
  '${hash}',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password = '${hash}',
  "updatedAt" = NOW();`);
