import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const status = {
    users: await prisma.appUser.count(),
    sessions: await prisma.appSession.count(),
    facilities: await prisma.facility.count(),
  };
  console.log(JSON.stringify(status));
} finally {
  await prisma.$disconnect();
}
