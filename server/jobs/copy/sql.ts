import { PrismaClient } from '@prisma/client';
import { qident } from './types';

export async function getOrderedColumns(prisma: PrismaClient, table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
      AND (is_generated = 'NEVER' OR is_generated IS NULL)
    ORDER BY ordinal_position
  `, table);
  return rows.map(r => r.column_name);
}

export async function insertSelectWhere(prisma: PrismaClient, targetSchema: string, table: string, whereSql: string, bind: any) {
  const cols = await getOrderedColumns(prisma, table);
  const colList = cols.map(qident).join(', ');
  const src = `"public".${qident(table)}`;
  const dst = `${qident(targetSchema)}.${qident(table)}`;
  const sql = `
    INSERT INTO ${dst} (${colList})
    SELECT ${colList} FROM ${src}
    WHERE ${whereSql}
    ON CONFLICT DO NOTHING
  `;
  await prisma.$executeRawUnsafe(sql, bind);
}

export async function insertSelectWhereSubquery(prisma: PrismaClient, targetSchema: string, table: string, subWhere: string, bind: any) {
  const cols = await getOrderedColumns(prisma, table);
  const colList = cols.map(qident).join(', ');
  const src = `"public".${qident(table)}`;
  const dst = `${qident(targetSchema)}.${qident(table)}`;
  const sql = `
    INSERT INTO ${dst} (${colList})
    SELECT ${colList} FROM ${src}
    WHERE ${subWhere}
    ON CONFLICT DO NOTHING
  `;
  await prisma.$executeRawUnsafe(sql, bind);
}
