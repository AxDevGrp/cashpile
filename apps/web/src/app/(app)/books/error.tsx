"use client";
import { AlertTriangle } from "lucide-react";
export default function BooksError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-12 text-center">
      <AlertTriangle className="h-8 w-8 text-yellow-500" />
      <div>
        <p className="font-semibold">Something went wrong in Books</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
      <button onClick={reset} className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90">
        Try again
      </button>
    </div>
  );
}
