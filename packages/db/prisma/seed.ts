import { prisma } from "../src/index.js";
import "../../../scripts/bootstrap-requested-services.ts";

async function main() {
  console.log(
    "MediLab Nexus seed: requested services and named report templates have been bootstrapped without demo patient data.",
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
