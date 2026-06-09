import { NextRequest, NextResponse } from "next/server";
import { createCategory, listCategories, updateCategory } from "@/modules/books/actions/category.actions";

const CATEGORY_TYPES = new Set(["income", "expense", "transfer", "asset", "liability", "equity"]);

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json({ categories });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

    const categoryType = String(body.categoryType ?? body.category_type ?? "expense");
    if (!CATEGORY_TYPES.has(categoryType)) {
      return NextResponse.json({ error: "Invalid category type" }, { status: 400 });
    }

    const category = await createCategory({
      name,
      category_type: categoryType as any,
      parent_category_id: body.parentCategoryId || body.parent_category_id || null,
      is_tax_deductible: Boolean(body.isTaxDeductible ?? body.is_tax_deductible ?? false),
    });
    const categories = await listCategories();

    return NextResponse.json({ category, categories }, { status: 201 });
  } catch (e: any) {
    const message = e.message?.includes("books_categories_user_id_name_key")
      ? "A category with that name already exists"
      : e.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    const name = String(body.name ?? "").trim();
    if (!id) return NextResponse.json({ error: "Category id is required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Category name is required" }, { status: 400 });

    const category = await updateCategory(id, { name });
    const categories = await listCategories();
    return NextResponse.json({ category, categories });
  } catch (e: any) {
    const message = e.message?.includes("books_categories_user_id_name_key")
      ? "A category with that name already exists"
      : e.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
