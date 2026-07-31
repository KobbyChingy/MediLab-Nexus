import { prisma } from "../src/index.js";

async function main() {
  console.log(
    "MediLab Nexus seed: no demo or sample data is inserted by default.",
  );
  console.log(
    "Use first-run sign up for the initial administrator, then add live operational data from the app.",
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
