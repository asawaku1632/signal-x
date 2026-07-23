import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import {
  addFavorite,
  getFavorites,
  removeFavorite,
} from "@/app/lib/favorites";

export const dynamic = "force-dynamic";

async function getUserEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();

  return email || null;
}

export async function GET() {
  try {
    const userEmail = await getUserEmail();

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "ログインが必要です",
        },
        { status: 401 },
      );
    }

    const favorites = await getFavorites(userEmail);

    return NextResponse.json({
      success: true,
      count: favorites.length,
      favorites,
    });
  } catch (error) {
    console.error("GET /api/favorites error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "お気に入りの取得に失敗しました",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getUserEmail();

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "ログインが必要です",
        },
        { status: 401 },
      );
    }

    const body = await request.json();
    const code = String(body?.code ?? "").trim();
    const name = String(body?.name ?? "").trim();

    if (!code || !name) {
      return NextResponse.json(
        {
          success: false,
          error: "codeとnameは必須です",
        },
        { status: 400 },
      );
    }

    const favorite = await addFavorite(userEmail, code, name);

    return NextResponse.json({
      success: true,
      favorite,
    });
  } catch (error) {
    console.error("POST /api/favorites error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "お気に入りの追加に失敗しました",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userEmail = await getUserEmail();

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "ログインが必要です",
        },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const code = String(searchParams.get("code") ?? "").trim();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "codeは必須です",
        },
        { status: 400 },
      );
    }

    await removeFavorite(userEmail, code);

    return NextResponse.json({
      success: true,
      code,
    });
  } catch (error) {
    console.error("DELETE /api/favorites error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "お気に入りの削除に失敗しました",
      },
      { status: 500 },
    );
  }
}