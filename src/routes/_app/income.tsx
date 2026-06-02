import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/lib/season";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtPKR, fmtDate, todayISO } from "@/lib/format";
import { Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/income")({ component: IncomePage });

function IncomePage() {
  const { current } = useSeason();
  const qc = useQueryClient();
  const [farmerName, setFarmerName] = useState("");
  const [date, setDate] = useState(todayISO());
  const [acres, setAcres] = useState("");
  const [rate, setRate] = useState("");
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");

  const farmers = useQuery({
    queryKey: ["farmers"],
    queryFn: async () => (await supabase.from("farmers").select("*").order("name")).data ?? [],
  });

  const incomes = useQuery({
    queryKey: ["incomes", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomes").select("*, farmers(name)")
        .eq("season_id", current!.id).order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const existingMatch = useMemo(() => {
    const name = farmerName.trim().toLowerCase();
    if (!name) return null;
    return (farmers.data ?? []).find((f: any) => f.name.toLowerCase() === name) ?? null;
  }, [farmerName, farmers.data]);

  const suggestions = useMemo(() => {
    const name = farmerName.trim().toLowerCase();
    if (!name) return [];
    return (farmers.data ?? []).filter((f: any) => f.name.toLowerCase().includes(name)).slice(0, 5);
  }, [farmerName, farmers.data]);

  const add = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Select a season first");
      if (!farmerName.trim()) throw new Error("Farmer name required");
      let farmerId = existingMatch?.id;
      if (!farmerId) {
        const { data, error } = await supabase.from("farmers").insert({ name: farmerName.trim() }).select().single();
        if (error) throw error;
        farmerId = data.id;
      }
      const { error } = await supabase.from("incomes").insert({
        season_id: current.id, farmer_id: farmerId, entry_date: date,
        total_acre: Number(acres), rate_per_acre: Number(rate),
        received_amount: Number(received || 0), note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Income entry added");
      setAcres(""); setRate(""); setReceived(""); setNote("");
      qc.invalidateQueries({ queryKey: ["incomes"] });
      qc.invalidateQueries({ queryKey: ["farmers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("incomes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["incomes"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const totals = useMemo(() => {
    const list = incomes.data ?? [];
    const total = list.reduce((s, r: any) => s + Number(r.total_acre) * Number(r.rate_per_acre), 0);
    const rec = list.reduce((s, r: any) => s + Number(r.received_amount), 0);
    return { total, rec, bal: total - rec };
  }, [incomes.data]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Income</h1><p className="text-sm text-muted-foreground">Record farmer entries — cutting acres, rate and received amount</p></div>

      <Card>
        <CardHeader><CardTitle>Add income entry</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid md:grid-cols-6 gap-3">
            <div className="md:col-span-2 relative">
              <Label>Farmer name</Label>
              <Input value={farmerName} onChange={(e) => setFarmerName(e.target.value)} placeholder="Type or pick existing" required />
              {existingMatch && (
                <div className="mt-1 text-xs flex items-center gap-1 text-success"><Check className="size-3" /> Using existing farmer</div>
              )}
              {!existingMatch && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-md">
                  {suggestions.map((s: any) => (
                    <button key={s.id} type="button" className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => setFarmerName(s.name)}>{s.name}</button>
                  ))}
                </div>
              )}
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><Label>Acres cut</Label><Input type="number" step="0.01" min="0" value={acres} onChange={(e) => setAcres(e.target.value)} required /></div>
            <div><Label>Rate / acre</Label><Input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required /></div>
            <div><Label>Received</Label><Input type="number" step="0.01" min="0" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
            <div className="md:col-span-5"><Label>Note</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="md:col-span-6 flex items-center gap-3">
              <Button type="submit" disabled={add.isPending}>Add entry</Button>
              {acres && rate && (
                <span className="text-sm text-muted-foreground">
                  Total: <b>{fmtPKR(Number(acres) * Number(rate))}</b>
                  {received && <> · Balance: <b>{fmtPKR(Number(acres) * Number(rate) - Number(received))}</b></>}
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle>All entries</CardTitle>
          <div className="text-sm">Total {fmtPKR(totals.total)} · Received {fmtPKR(totals.rec)} · Balance <b>{fmtPKR(totals.bal)}</b></div>
        </CardHeader>
        <CardContent>
          {!current ? <p className="text-muted-foreground">Select a season.</p> :
            (incomes.data ?? []).length === 0 ? <p className="text-muted-foreground">No entries yet.</p> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2">Date</th><th>Farmer</th><th>Acres</th><th>Rate</th><th>Total</th><th>Received</th><th>Balance</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {incomes.data!.map((r: any) => {
                    const t = Number(r.total_acre) * Number(r.rate_per_acre);
                    const b = t - Number(r.received_amount);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="py-2">{fmtDate(r.entry_date)}</td>
                        <td className="font-medium">{r.farmers?.name}</td>
                        <td>{r.total_acre}</td>
                        <td>{fmtPKR(r.rate_per_acre)}</td>
                        <td>{fmtPKR(t)}</td>
                        <td>{fmtPKR(r.received_amount)}</td>
                        <td className={b > 0 ? "text-warning" : b < 0 ? "text-success" : ""}>{fmtPKR(b)}</td>
                        <td className="text-muted-foreground">{r.note}</td>
                        <td className="text-right"><Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
