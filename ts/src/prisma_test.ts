import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Question テーブルから1件取得
    const q = await prisma.question.findFirst({
        where: {
        title: { not: null },
        body: { not: null },
        publishedAt: null
        }
    });

    console.log(q);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
