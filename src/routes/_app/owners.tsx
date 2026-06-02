import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/lib/season";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtPKR, fmtDate, todayISO } from "@/lib/format";
import { exportOwnerPDF } from "@/lib/pdf";
import { Trash2, FileDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/owners")({ component: OwnersPage });

function OwnersPage() {
  const { current } = useSeason();
  const qc = useQueryClient();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const owners = useQuery({ queryKey: ["owners"], queryFn: async () => (await supabase.from("owners").select("*").order("name")).data ?? [] });

  const data = useQuery({
    queryKey: ["owner-detail", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const sid = current!.id;
      const [tr, exp, inc] = await Promise.all([
        supabase.from("owner_transfers").select("*, fromO:from_owner_id(name), toO:to_owner_id(name)").eq("season_id", sid).order("entry_date", { ascending: false }),
        supabase.from("expenses").select("*").eq("season_id", sid),
        supabase.from("incomes").select("total_acre, rate_per_acre, received_amount").eq("season_id", sid),
      ]);
      if (tr.error) throw tr.error;
      return { tr: tr.data, exp: exp.data ?? [], inc: inc.data ?? [] };
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("Select a season");
      if (!fromId || !toId) throw new Error("Pick both owners");
      if (fromId === toId) throw new Error("From and To must differ");
      const { error } = await supabase.from("owner_transfers").insert({
        season_id: current.id, from_owner_id: fromId, to_owner_id: toId,
        entry_date: date, amount_pkr: Number(amount), note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transfer recorded"); setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["owner-detail"] }); qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("owner_transfers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["owner-detail"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const perOwner = useMemo(() => {
    if (!data.data || !owners.data) return [];
    const income = data.data.inc.reduce((s, r: any) => s + Number(r.total_acre) * Number(r.rate_per_acre), 0);
    const share = income / Math.max(owners.data.length, 1);
    return owners.data.map((o: any) => {
      const expenses = data.data!.exp.filter((e: any) => e.owner_id === o.id);
      const exp = expenses.reduce((s, r: any) => s + Number(r.amount_pkr), 0);
      const tIn = data.data!.tr.filter((t: any) => t.to_owner_id === o.id);
      const tOut = data.data!.tr.filter((t: any) => t.from_owner_id === o.id);
      const inSum = tIn.reduce((s, r: any) => s + Number(r.amount_pkr), 0);
      const outSum = tOut.reduce((s, r: any) => s + Number(r.amount_pkr), 0);
      return { owner: o, expenses, exp, tIn, tOut, inSum, outSum, incomeShare: share, net: share - exp + inSum - outSum };
    });
  }, [data.data, owners.data]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Owners</h1><p className="text-sm text-muted-foreground">Owner-to-owner transfers and per-owner reports</p></div>

      <Card>
        <CardHeader><CardTitle>Record transfer between owners</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid md:grid-cols-5 gap-3">
            <div><Label>From owner (paid)</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>{(owners.data ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>To owner (received)</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
                <SelectContent>{(owners.data ?? []).map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div><Label>Amount (PKR)</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div className="md:col-span-5"><Button type="submit" disabled={add.isPending}>Record transfer</Button></div>
          </form>
        </CardContent>
      </Card>

      {perOwner.map((p) => (
        <Card key={p.owner.id}>
          <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle>{p.owner.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{p.owner.phone}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => current && exportOwnerPDF({
              ownerName: p.owner.name, seasonName: current.name,
              expenses: p.expenses.map((e: any) => ({ entry_date: e.entry_date, amount_pkr: Number(e.amount_pkr), note: e.note })),
              transfersIn: p.tIn.map((t: any) => ({ entry_date: t.entry_date, from_name: t.fromO?.name ?? "", amount_pkr: Number(t.amount_pkr), note: t.note })),
              transfersOut: p.tOut.map((t: any) => ({ entry_date: t.entry_date, to_name: t.toO?.name ?? "", amount_pkr: Number(t.amount_pkr), note: t.note })),
              incomeShare: p.incomeShare,
              totals: { expenses: p.exp, incomeShare: p.incomeShare, transfersIn: p.inSum, transfersOut: p.outSum, net: p.net },
            })}><FileDown className="size-4 mr-2" /> Export PDF</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <Stat label="Income share" value={fmtPKR(p.incomeShare)} />
              <Stat label="Expenses" value={fmtPKR(p.exp)} />
              <Stat label="Received from other" value={fmtPKR(p.inSum)} />
              <Stat label="Paid to other" value={fmtPKR(p.outSum)} />
              <Stat label="Net" value={fmtPKR(p.net)} highlight={p.net >= 0 ? "good" : "bad"} />
            </div>

            <Detail title="Expenses" rows={p.expenses} cols={["Date", "Amount", "Note"]} render={(r: any) => [fmtDate(r.entry_date), fmtPKR(r.amount_pkr), r.note]} />
            <Detail title="Received from other owner" rows={p.tIn} cols={["Date", "From", "Amount", "Note"]} render={(r: any) => [fmtDate(r.entry_date), r.fromO?.name, fmtPKR(r.amount_pkr), r.note]} onDelete={(r: any) => del.mutate(r.id)} />
            <Detail title="Paid to other owner" rows={p.tOut} cols={["Date", "To", "Amount", "Note"]} render={(r: any) => [fmtDate(r.entry_date), r.toO?.name, fmtPKR(r.amount_pkr), r.note]} onDelete={(r: any) => del.mutate(r.id)} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: "good" | "bad" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${highlight === "good" ? "text-success" : highlight === "bad" ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}

function Detail({ title, rows, cols, render, onDelete }: { title: string; rows: any[]; cols: string[]; render: (r: any) => any[]; onDelete?: (r: any) => void }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="font-medium text-sm mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr>{cols.map((c) => <th key={c} className="py-1">{c}</th>)}{onDelete && <th></th>}</tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                {render(r).map((v, i) => <td key={i} className="py-1">{v}</td>)}
                {onDelete && <td className="text-right"><Button size="icon" variant="ghost" onClick={() => onDelete(r)}><Trash2 className="size-4 text-destructive" /></Button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
