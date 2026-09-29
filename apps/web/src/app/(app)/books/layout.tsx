"use client";

import { usePathname } from "next/navigation";
import { TopNav } from "@cashpile/ui";
import { useConsumerEnabled } from "@/components/ui-v2/consumer-context";

const CONSUMER_ROUTES = ["/books/transactions", "/books/accounts"];

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const consumer = useConsumerEnabled();
  const title = pathname.startsWith("/books/tax") ? "Taxes" : "Books";

  // Consumer routes render inside the consumer shell; drop the Books module chrome.
  if (consumer && CONSUMER_ROUTES.some((route) => pathname.startsWith(route))) {
    return <div className="flex flex-col h-full"><div className="flex-1 overflow-auto">{children}</div></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <TopNav title={title} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
