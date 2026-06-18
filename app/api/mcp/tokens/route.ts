import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/mcp/tokens";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  const label = name?.trim() || "Default";
  const { token, tokenHash } = generateToken();
  const row = await prisma.mcpToken.create({
    data: { userId: session.user.id, name: label, tokenHash },
  });
  return NextResponse.json({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    token,
  });
}
