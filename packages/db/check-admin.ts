import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@2cconseil.com';
  const password = 'admin@2cconseil.com';
  
  console.log('Checking admin user in database...');
  
  // Check if admin exists
  const existing = await prisma.user.findUnique({ where: { email } });
  
  if (existing) {
    console.log('✓ Admin user exists:', { id: existing.id, email: existing.email, role: existing.role });
    console.log('✓ Password hash exists:', !!existing.password);
    
    // Test password
    if (existing.password) {
      const valid = await bcrypt.compare(password, existing.password);
      console.log('✓ Password valid:', valid);
      if (!valid) {
        console.log('! Password mismatch. Updating...');
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { email }, data: { password: hashedPassword } });
        console.log('✓ Password updated');
      }
    } else {
      console.log('! No password. Setting...');
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { email }, data: { password: hashedPassword } });
      console.log('✓ Password set');
    }
  } else {
    console.log('! Admin user does NOT exist. Creating...');
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Admin CRC',
        role: 'ADMIN',
        password: hashedPassword,
      }
    });
    console.log('✓ Admin created:', { id: user.id, email: user.email, role: user.role });
  }
}

main()
  .then(() => {
    console.log('Done!');
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error('Error:', e);
    prisma.$disconnect();
    process.exit(1);
  });
