import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportServerError } from "@/lib/server-logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const packages = await prisma.testPackage.findMany();
    const testPackages = packages.map((item) => item.name);

    return NextResponse.json({
      success: true,
      data: testPackages,
    });
  } catch (error) {
    const incidentId = crypto.randomUUID();
    reportServerError("api.ping.database_error", error, {
      incidentId,
      route: "/api/ping",
    });

    return NextResponse.json(
      {
        success: false,
        error: "Service unavailable",
        incidentId,
      },
      { status: 503 },
    );
  }
}
