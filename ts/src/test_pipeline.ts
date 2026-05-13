import { prisma } from "./config.ts";
import { runPublishPipeline } from "./jobs.ts";

async function main() {
  try {
    await runPublishPipeline();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);