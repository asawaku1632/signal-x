import { NextResponse } from "next/server";
import db from "@/app/lib/db";

export async function GET() {
  const rows = db
    .prepare(`
      SELECT *
      FROM learning_logs
      ORDER BY id DESC
      LIMIT 10
    `)
    .all();

  return NextResponse.json({
    success: true,
    count: rows.length,
    rows,
  });
}