import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "DEBUG_PATTERN_SCHEMA_0706";

export async function GET() {
  try {
    const columnsResult = await pool.query(`
      SELECT
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'pattern_learning_logs'
      ORDER BY ordinal_position
    `);

    const sampleResult = await pool.query(`
      SELECT *
      FROM pattern_learning_logs
      LIMIT 3
    `);

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      tableName: "pattern_learning_logs",
      columnCount: columnsResult.rows.length,
      columns: columnsResult.rows,
      sampleCount: sampleResult.rows.length,
      samples: sampleResult.rows,
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
