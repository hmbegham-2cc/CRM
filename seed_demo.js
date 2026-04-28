const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data for the last 14 days...');
  
  const user = await prisma.user.findFirst({
    where: { email: { endsWith: '@2cconseil.com' } }
  });

  if (!user) {
    console.error('No valid user found to attach reports to. Please log in first.');
    return;
  }

  const campaign = await prisma.campaign.findFirst({
    where: { active: true }
  });

  if (!campaign) {
    console.error('No active campaign found. Please create one first.');
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reports = [];
  for (let i = 14; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Random but realistic data
    const incoming = Math.floor(Math.random() * 50) + 20;
    const handled = Math.floor(incoming * (0.8 + Math.random() * 0.2));
    const missed = incoming - handled;
    const outgoing = Math.floor(Math.random() * 30) + 10;
    const rdv = Math.floor(handled * (0.1 + Math.random() * 0.2));
    const sms = Math.floor(rdv * 1.5);

    reports.push({
      date,
      campaignId: campaign.id,
      userId: user.id,
      incomingTotal: incoming,
      outgoingTotal: outgoing,
      handled: handled,
      missed: missed,
      rdvTotal: rdv,
      smsTotal: sms,
      observations: `Rapport automatique pour le ${date.toLocaleDateString()}`,
      status: 'VALIDATED',
      submittedAt: date,
      validatedAt: date,
      validatedById: user.id
    });
  }

  for (const report of reports) {
    await prisma.dailyReport.upsert({
      where: {
        date_campaignId_userId: {
          date: report.date,
          campaignId: report.campaignId,
          userId: report.userId
        }
      },
      update: report,
      create: report
    });
  }

  console.log('Successfully seeded 15 days of data!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
