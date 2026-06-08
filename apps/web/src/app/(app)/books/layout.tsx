"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@cashpile/ui";

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = pathname.startsWith("/books/tax") ? "Taxes" : "Books";

  return (
    <div className="flex flex-col h-full">
      <TopNav title={title} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
