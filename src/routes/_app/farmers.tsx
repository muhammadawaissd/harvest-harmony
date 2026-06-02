import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/lib/season";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtPKR, fmtDate } from "@/lib/format";
import { exportFarmerPDF } from "@/lib/pdf";
import { FileDown } from "lucide-react";

export const Route = createFileRoute("/_app/farmers")({ component: FarmersPage });

function FarmersPage() {
  const { current } = useSeason();

  const data = useQuery({
    queryKey: ["farmers-detail", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const [f, i] = await Promise.all([
        supabase.from("farmers").select("*").order("name"),
        supabase.from("incomes").select("*").eq("season_id", current!.id).order("entry_date", { ascending: false }),
      ]);
      if (f.error) throw f.error;
      if (i.error) throw i.error;
      return { farmers: f.data, incomes: i.data };
    },
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Farmers</h1><p className="text-sm text-muted-foreground">Per-farmer statements for this season</p></div>

      {!current ? <p className="text-muted-foreground">Select a season.</p> :
      (data.data?.farmers ?? []).map((f: any) => {
        const rows = (data.data?.incomes ?? []).filter((r: any) => r.farmer_id === f.id);
        if (rows.length === 0) return null;
        const total = rows.reduce((s, r: any) => s + Number(r.total_acre) * Number(r.rate_per_acre), 0);
        const rec = rows.reduce((s, r: any) => s + Number(r.received_amount), 0);
        const bal = total - rec;
        return (
          <Card key={f.id}>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div><CardTitle>{f.name}</CardTitle>
                <div className="text-sm text-muted-foreground">Total {fmtPKR(total)} · Received {fmtPKR(rec)} · <span className={bal > 0 ? "text-warning" : "text-success"}>Balance {fmtPKR(bal)}</span></div>
              </div>
              <Button variant="outline" size="sm" onClick={() => exportFarmerPDF({
                farmerName: f.name, seasonName: current.name,
                rows: rows.map((r: any) => ({ entry_date: r.entry_date, total_acre: Number(r.total_acre), rate_per_acre: Number(r.rate_per_acre), received_amount: Number(r.received_amount), note: r.note })),
              })}><FileDown className="size-4 mr-2" /> Export PDF</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground"><tr><th className="py-2">Date</th><th>Acres</th><th>Rate</th><th>Total</th><th>Received</th><th>Balance</th><th>Note</th></tr></thead>
                  <tbody>
                    {rows.map((r: any) => {
                      const t = Number(r.total_acre) * Number(r.rate_per_acre);
                      const b = t - Number(r.received_amount);
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="py-2">{fmtDate(r.entry_date)}</td>
                          <td>{r.total_acre}</td><td>{fmtPKR(r.rate_per_acre)}</td><td>{fmtPKR(t)}</td>
                          <td>{fmtPKR(r.received_amount)}</td><td>{fmtPKR(b)}</td>
                          <td className="text-muted-foreground">{r.note}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
