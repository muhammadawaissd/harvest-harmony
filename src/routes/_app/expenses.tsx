import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/lib/season";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtPKR, fmtDate, todayISO } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/expenses")({ component: ExpensesPage });

function ExpensesPage() {
  const { current } = useSeason();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [ownerId, setOwnerId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const owners = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await supabase.from("owners").select("*").order("name")).data ?? [],
  });

  const expenses = useQuery({
    queryKey: ["expenses", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses").select("*, owners(name)")
        .eq("season_id", current!.id).order("entry_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Select a season first");
      if (!ownerId) throw new Error("Select an owner");
      const { error } = await supabase.from("expenses").insert({
        season_id: current.id, owner_id: ownerId, entry_date: date,
        amount_pkr: Number(amount), note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added"); setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const total = (expenses.data ?? []).reduce((s, r: any) => s + Number(r.amount_pkr), 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Expenses</h1><p className="text-sm text-muted-foreground">Record expenses paid by each owner</p></div>

      <Card>
        <CardHeader><CardTitle>Add expense</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid md:grid-cols-5 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><Label>Owner paid</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                <SelectContent>{(owners.data ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (PKR)</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div className="md:col-span-2"><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Diesel, repairs, etc." /></div>
            <div className="md:col-span-5"><Button type="submit" disabled={add.isPending}>Add expense</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All expenses</CardTitle>
          <div className="text-sm">Total: <span className="font-bold">{fmtPKR(total)}</span></div>
        </CardHeader>
        <CardContent>
          {!current ? <p className="text-muted-foreground">Select a season.</p> :
            (expenses.data ?? []).length === 0 ? <p className="text-muted-foreground">No expenses yet.</p> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2">Date</th><th>Owner</th><th>Amount</th><th>Note</th><th></th></tr>
                </thead>
                <tbody>
                  {expenses.data!.map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2">{fmtDate(r.entry_date)}</td>
                      <td>{r.owners?.name}</td>
                      <td className="font-medium">{fmtPKR(r.amount_pkr)}</td>
                      <td className="text-muted-foreground">{r.note}</td>
                      <td className="text-right"><Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
