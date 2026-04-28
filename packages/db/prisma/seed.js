import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    const users = [
        { email: "admin@2cconseil.com", name: "Admin CRC", role: Role.ADMIN },
        { email: "superviseur@2cconseil.com", name: "Superviseur CRC", role: Role.SUPERVISEUR },
        { email: "teleconseiller@2cconseil.com", name: "Téléconseiller CRC", role: Role.TELECONSEILLER },
    ];
    for (const user of users) {
        await prisma.user.upsert({
            where: { email: user.email },
            update: { name: user.name, role: user.role },
            create: { ...user, password: "crc2026" },
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
