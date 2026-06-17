import { NextRequest, NextResponse } from "next/server";
import {
  getFavorites,
  addFavorite,
  removeFavorite,
} from "@/app/lib/favorites";

export async function GET() {
  try {
    const favorites = await getFavorites();

    return NextResponse.json({
      success: true,
      count: favorites.length,
      favorites,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await addFavorite(
      body.code,
      body.name
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "code required",
        },
        { status: 400 }
      );
    }

    const favorites = await removeFavorite(code);

    return NextResponse.json({
      success: true,
      favorites,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}