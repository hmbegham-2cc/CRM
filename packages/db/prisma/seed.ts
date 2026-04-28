import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = [
    { email: "admin@2cconseil.com", name: "Admin CRC", role: Role.ADMIN, password: "admin@2cconseil.com" },
    { email: "superviseur@2cconseil.com", name: "Superviseur CRC", role: Role.SUPERVISEUR, password: "crc2026" },
    { email: "teleconseiller@2cconseil.com", name: "Téléconseiller CRC", role: Role.TELECONSEILLER, password: "crc2026" },
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, password: hashedPassword },
      create: { email: user.email, name: user.name, role: user.role, password: hashedPassword },
    });
  }

  await prisma.campaign.upsert({
    where: { name: "Campagne Demo" },
    update: { active: true },
    create: { name: "Campagne Demo", active: true },
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
