import { z } from "zod";
import { getOpenAIClient, DEFAULT_MODEL } from "../client";

export interface BooksInstructionOption {
  id: string | number;
  name: string;
  aliases?: string[];
}

export interface ParsedBooksInstruction {
  accountId: string | null;
  pattern: string | null;
  categoryId: string | number | null;
  taxEntityId: string | null;
  confidence: number;
  reason: string;
}

const ParsedBooksInstructionSchema = z.object({
  accountId: z.string().nullable(),
  pattern: z.string().nullable(),
  categoryId: z.union([z.string(), z.number()]).nullable(),
  taxEntityId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(300),
});

export async function parseBooksInstruction(input: {
  instruction: string;
  accounts: BooksInstructionOption[];
  categories: BooksInstructionOption[];
  taxEntities: BooksInstructionOption[];
}): Promise<ParsedBooksInstruction | null> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          "You parse user bookkeeping instructions into existing Cashpile IDs. Use only IDs from the provided options. If unsure, return null for that field. Pattern should be a concise merchant/payee phrase when the instruction targets a merchant; otherwise null.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction: input.instruction,
          accounts: input.accounts,
          categories: input.categories,
          taxEntities: input.taxEntities,
          outputSchema: {
            accountId: "string|null",
            pattern: "string|null",
            categoryId: "string|number|null",
            taxEntityId: "string|null",
            confidence: "number 0-1",
            reason: "short explanation",
          },
        }),
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const validated = ParsedBooksInstructionSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}
