import { TopNav } from "@cashpile/ui";
export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <TopNav title="Pulse" />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
