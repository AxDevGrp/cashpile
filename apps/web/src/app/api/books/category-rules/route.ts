import { NextRequest, NextResponse } from "next/server";
import {
  createCategoryRule,
  deleteCategoryRule,
  listCategoryRules,
  seedSystemCategoryRules,
  updateCategoryRule,
} from "@/modules/books/actions/category-rule.actions";

export async function GET() {
  try {
    await seedSystemCategoryRules().catch(() => null);
    const rules = await listCategoryRules();
    return NextResponse.json({ rules });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patterns = String(body.pattern ?? "")
      .split(",")
      .map((pattern) => pattern.trim())
      .filter(Boolean);

    if (patterns.length === 0) {
      return NextResponse.json({ error: "Rule pattern is required" }, { status: 400 });
    }

    const rules = [];
    for (const pattern of patterns) {
      rules.push(await createCategoryRule({
        pattern,
        categoryId: body.categoryId,
        matchType: body.matchType,
        source: "manual",
        priority: body.priority,
        accountId: body.accountId ?? null,
      }));
    }

    return NextResponse.json({ rule: rules[0], rules, created: rules.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
    const rule = await updateCategoryRule(body.id, body);
    return NextResponse.json({ rule });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
    await deleteCategoryRule(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
