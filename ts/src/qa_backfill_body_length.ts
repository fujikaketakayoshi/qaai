import { prisma } from "./config.ts";

async function main() {
  const questions = await prisma.question.findMany({
    where: {
      body: { not: null },
      bodyLength: null
    },
    select: {
      id: true,
      body: true
    }
  });

  console.log(`対象件数: ${questions.length}`);

  for (const q of questions) {
    await prisma.question.update({
      where: {
        id: q.id
      },
      data: {
        bodyLength: q.body!.length
      }
    });

    console.log(`updated: ${q.id}`);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });