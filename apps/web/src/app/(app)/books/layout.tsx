import { TopNav } from "@cashpile/ui";
export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <TopNav title="Books" />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
