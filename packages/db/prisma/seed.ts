import { prisma } from "../src/index.js";
import { bootstrapRequestedReportTemplates } from "../../../scripts/bootstrap-requested-services.ts";

async function main() {
  await bootstrapRequestedReportTemplates(prisma);
  console.log(
    "MediLab Nexus seed task completed without demo patient data.",
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
