#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log("Reading SQL migration file...");
    const sqlFile = path.join(process.cwd(), "migrations", "001_create_aif_tables.sql");
    const sql = fs.readFileSync(sqlFile, "utf-8");
    
    // Split by semicolons and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length > 0) {
        console.log(`  [${i + 1}/${statements.length}] Executing statement...`);
        await prisma.$executeRawUnsafe(stmt);
      }
    }
    
    console.log("\n✅ Migration completed successfully!");
    console.log("\nTables created:");
    console.log("  - AifNode (with 4 indexes)");
    console.log("  - AifEdge (with 4 indexes)");
    console.log("  - DialogueMove.aifRepresentation column added");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
