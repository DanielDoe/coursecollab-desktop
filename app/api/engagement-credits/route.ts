import { type NextRequest, NextResponse } from "next/server";
import { calculateEngagementCredits } from "@/lib/grades";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const session = searchParams.get("session") || "ALL";

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    const studentIdNum = parseInt(studentId, 10);
    if (isNaN(studentIdNum)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const credits = await calculateEngagementCredits(studentIdNum, session);

    return NextResponse.json({ credits });
  } catch (error) {
    console.error("Error fetching engagement credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch engagement credits" },
      { status: 500 }
    );
  }
}

