import { prisma } from "@medilab/db";

try {
  const count = await prisma.appSession.count();
  console.log(JSON.stringify({ ok: true, count }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}