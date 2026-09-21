"use client";

import { createContext, useContext } from "react";

const TaxAccessContext = createContext(false);

export function TaxAccessProvider({ enabled = false, children }: { enabled?: boolean; children: React.ReactNode }) {
  return <TaxAccessContext.Provider value={enabled}>{children}</TaxAccessContext.Provider>;
}

export function useTaxAccess() {
  return useContext(TaxAccessContext);
}
