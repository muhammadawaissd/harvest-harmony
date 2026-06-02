import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Season = { id: string; name: string; start_date: string; end_date: string; is_active: boolean };

type Ctx = {
  seasons: Season[];
  current: Season | null;
  setCurrentId: (id: string) => void;
  loading: boolean;
};

const SeasonCtx = createContext<Ctx>({ seasons: [], current: null, setCurrentId: () => {}, loading: true });

export function SeasonProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["seasons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seasons").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data as Season[];
    },
  });

  const [currentId, setCurrentIdState] = useState<string | null>(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("currentSeasonId") : null;
    const found = stored && data.find((s) => s.id === stored);
    setCurrentIdState((found ?? data.find((s) => s.is_active) ?? data[0]).id);
  }, [data]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    if (typeof window !== "undefined") localStorage.setItem("currentSeasonId", id);
  };

  const current = data?.find((s) => s.id === currentId) ?? null;

  return (
    <SeasonCtx.Provider value={{ seasons: data ?? [], current, setCurrentId, loading: isLoading }}>
      {children}
    </SeasonCtx.Provider>
  );
}

export const useSeason = () => useContext(SeasonCtx);
