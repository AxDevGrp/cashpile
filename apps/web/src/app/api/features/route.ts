import { NextResponse } from "next/server";
import { getTaxModuleAccess } from "@/lib/tax-access";

export async function GET() {
  const { canUseTax } = await getTaxModuleAccess();
  return NextResponse.json({ canUseTax });
}
