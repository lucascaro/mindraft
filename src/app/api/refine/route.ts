import { NextRequest, NextResponse } from "next/server";
import { refineIdea } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const { title, body } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const suggestions = await refineIdea(title, body || "");
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Refine API error:", error);
    return NextResponse.json(
      { error: "Failed to refine idea" },
      { status: 500 }
    );
  }
}
