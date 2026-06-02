import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDate } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/seasons")({ component: SeasonsPage });

function SeasonsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const list = useQuery({ queryKey: ["seasons"], queryFn: async () => (await supabase.from("seasons").select("*").order("start_date", { ascending: false })).data ?? [] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("seasons").insert({ name, start_date: start, end_date: end });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Season added"); setName(""); setStart(""); setEnd(""); qc.invalidateQueries({ queryKey: ["seasons"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("seasons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seasons"] }),
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Seasons</h1><p className="text-sm text-muted-foreground">All data is scoped to a season</p></div>
      <Card><CardHeader><CardTitle>Add season</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid md:grid-cols-4 gap-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wheat 2026" required /></div>
            <div><Label>Start date</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            <div><Label>End date</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
            <div className="self-end"><Button type="submit" disabled={add.isPending}>Add</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>All seasons</CardTitle></CardHeader>
        <CardContent>
          {(list.data ?? []).length === 0 ? <p className="text-muted-foreground">No seasons yet.</p> :
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-2">Name</th><th>Start</th><th>End</th><th></th></tr></thead>
              <tbody>{list.data!.map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2 font-medium">{s.name}</td><td>{fmtDate(s.start_date)}</td><td>{fmtDate(s.end_date)}</td>
                  <td className="text-right"><Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
                </tr>
              ))}</tbody>
            </table>}
        </CardContent>
      </Card>
    </div>
  );
}
