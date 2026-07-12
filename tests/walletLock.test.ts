import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "VirtualWallet" (
    id BIGSERIAL PRIMARY KEY,
    "user_id" BIGINT UNIQUE
  );`);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION lock_wallet(p_user_id BIGINT)
RETURNS BIGINT AS $$
  SELECT id FROM "VirtualWallet" WHERE "user_id" = p_user_id FOR UPDATE;
$$ LANGUAGE SQL;`);
  await prisma.$executeRawUnsafe(`INSERT INTO "VirtualWallet" ("user_id") VALUES (1) ON CONFLICT DO NOTHING;`);
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "VirtualWallet";`);
  await prisma.$disconnect();
});

test("lock_wallet serializes concurrent txns", async () => {
  const prisma2 = new PrismaClient();
  const order: string[] = [];
  const tx1 = prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT lock_wallet(${1})`;
    await new Promise(r => setTimeout(r, 500));
    order.push("first");
  });
  const tx2 = prisma2.$transaction(async tx => {
    await tx.$executeRaw`SELECT lock_wallet(${1})`;
    order.push("second");
  });
  await Promise.all([tx1, tx2]);
  await prisma2.$disconnect();
  expect(order).toEqual(["first", "second"]);
});
