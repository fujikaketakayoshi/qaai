import { PrismaClient } from "@prisma/client";
import { FILTER_WORDS } from "./filtering_words.js";

const prisma = new PrismaClient();

/**
 * フィルタリング判定
 */
function isFiltered(title: string | null, body: string | null): boolean {
  const text = `${title ?? ""} ${body ?? ""}`.toLowerCase();

  return FILTER_WORDS.some((word) =>
    text.includes(word.toLowerCase())
  );
}

async function main() {
  const questions = await prisma.question.findMany({
    where: {
      filtering: false,
    },
    select: {
      id: true,
      title: true,
      body: true,
    },
  });

  console.log(`対象件数: ${questions.length}`);

  let updateCount = 0;

  for (const question of questions) {
    const hit = isFiltered(question.title, question.body);

    if (hit) {
      await prisma.question.update({
        where: {
          id: question.id,
        },
        data: {
          filtering: true,
        },
      });

      updateCount++;
      console.log(`filtered: ${question.id}`);
    }
  }

  console.log(`更新件数: ${updateCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });