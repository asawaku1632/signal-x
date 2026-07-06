import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "DEBUG_TABLE_SCHEMA_0706";

function isSafeTableName(name: string) {
  return /^[a-zA-Z0-9_]+$/.test(name);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get("name");

    if (!tableName) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          error: "Missing query parameter: name",
          example: "/api/debug/table-schema?name=ai_power_weight_rules",
        },
        { status: 400 }
      );
    }

    if (!isSafeTableName(tableName)) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          error: "Invalid table name.",
        },
        { status: 400 }
      );
    }

    const columnsResult = await pool.query(
      `
      SELECT
        ordinal_position,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
      `,
      [tableName]
    );

    if (columnsResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          tableName,
          error: "Table not found or no columns found.",
        },
        { status: 404 }
      );
    }

    const sampleResult = await pool.query(`
      SELECT *
      FROM public.${tableName}
      LIMIT 3
    `);

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      tableName,
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
