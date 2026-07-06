import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "DEBUG_DB_TABLES_0706";

export async function GET() {
  try {
    const tablesResult = await pool.query(`
      SELECT
        table_schema,
        table_name,
        table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    const learningTables = tablesResult.rows.filter((row: any) => {
      const name = String(row.table_name).toLowerCase();
      return (
        name.includes("learning") ||
        name.includes("experience") ||
        name.includes("weight") ||
        name.includes("result") ||
        name.includes("pattern") ||
        name.includes("sector") ||
        name.includes("market")
      );
    });

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      totalCount: tablesResult.rows.length,
      learningRelatedCount: learningTables.length,
      learningRelatedTables: learningTables,
      tables: tablesResult.rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
