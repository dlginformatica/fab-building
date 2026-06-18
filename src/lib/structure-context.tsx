import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  activeStructureId: string | null;
  setActiveStructureId: (id: string | null) => void;
};
const C = createContext<Ctx>({ activeStructureId: null, setActiveStructureId: () => {} });

const KEY = "hotelops.activeStructureId";

export function StructureProvider({ children }: { children: ReactNode }) {
  const [activeStructureId, setActiveStructureId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveStructureId(localStorage.getItem(KEY));
  }, []);
  const set = (id: string | null) => {
    setActiveStructureId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    }
  };
  return <C.Provider value={{ activeStructureId, setActiveStructureId: set }}>{children}</C.Provider>;
}

export function useActiveStructure() {
  return useContext(C);
}