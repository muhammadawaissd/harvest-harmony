import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSeason } from "@/lib/season";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtPKR } from "@/lib/format";
import { exportSeasonGrandPDF } from "@/lib/pdf";
import { Wallet, TrendingUp, Scale, Coins, FileDown } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

function Dashboard() {
  const { current } = useSeason();

  const { data } = useQuery({
    queryKey: ["dashboard", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const sid = current!.id;
      const [exp, inc, tr, owners] = await Promise.all([
        supabase.from("expenses").select("amount_pkr, owner_id").eq("season_id", sid),
        supabase.from("incomes").select("total_acre, rate_per_acre, received_amount").eq("season_id", sid),
        supabase.from("owner_transfers").select("amount_pkr, from_owner_id, to_owner_id").eq("season_id", sid),
        supabase.from("owners").select("id, name").order("name"),
      ]);
      if (exp.error) throw exp.error;
      if (inc.error) throw inc.error;
      if (tr.error) throw tr.error;
      if (owners.error) throw owners.error;
      return { exp: exp.data, inc: inc.data, tr: tr.data, owners: owners.data };
    },
  });

  const totals = useMemo(() => {
    if (!data) return null;
    const income = data.inc.reduce((s, r) => s + Number(r.total_acre) * Number(r.rate_per_acre), 0);
    const received = data.inc.reduce((s, r) => s + Number(r.received_amount), 0);
    const expenses = data.exp.reduce((s, r) => s + Number(r.amount_pkr), 0);
    const balance = income - received;
    const grandNet = income - expenses;
    const ownerCount = Math.max(data.owners.length, 1);
    const share = income / ownerCount;
    const perOwner = data.owners.map((o) => {
      const ownerExp = data.exp.filter((e) => e.owner_id === o.id).reduce((s, r) => s + Number(r.amount_pkr), 0);
      const inT = data.tr.filter((t) => t.to_owner_id === o.id).reduce((s, r) => s + Number(r.amount_pkr), 0);
      const outT = data.tr.filter((t) => t.from_owner_id === o.id).reduce((s, r) => s + Number(r.amount_pkr), 0);
      return { id: o.id, name: o.name, expenses: ownerExp, incomeShare: share, transfersIn: inT, transfersOut: outT, net: share - ownerExp + inT - outT };
    });
    return { income, received, balance, expenses, grandNet, perOwner };
  }, [data]);

  if (!current) return <EmptyState message="Create a season first to start tracking." />;
  if (!totals) return <div className="text-muted-foreground">Loading…</div>;

  const cards = [
    { label: "Total Income", value: totals.income, icon: TrendingUp, color: "text-success" },
    { label: "Received", value: totals.received, icon: Coins, color: "text-primary" },
    { label: "Outstanding", value: totals.balance, icon: Scale, color: "text-warning" },
    { label: "Total Expenses", value: totals.expenses, icon: Wallet, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">{current.name}</h1>
          <p className="text-sm text-muted-foreground">Season overview & grand totals</p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportSeasonGrandPDF({
            seasonName: current.name,
            totals: { income: totals.income, received: totals.received, balance: totals.balance, expenses: totals.expenses, grandNet: totals.grandNet },
            perOwner: totals.perOwner,
          })}
        >
          <FileDown className="size-4 mr-2" /> Export season PDF
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`size-5 ${c.color}`} />
              </div>
              <div className="text-2xl font-bold mt-2">{fmtPKR(c.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Grand Net (Income − Expenses)</CardTitle></CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${totals.grandNet >= 0 ? "text-success" : "text-destructive"}`}>
            {fmtPKR(totals.grandNet)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Per Owner</CardTitle></CardHeader>
        <CardContent>
          {totals.perOwner.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add owners in Settings to see per-owner breakdown.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2">Owner</th><th>Income share</th><th>Expenses</th><th>Received from other</th><th>Paid to other</th><th>Net</th></tr>
                </thead>
                <tbody>
                  {totals.perOwner.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="py-2 font-medium">{o.name}</td>
                      <td>{fmtPKR(o.incomeShare)}</td>
                      <td>{fmtPKR(o.expenses)}</td>
                      <td>{fmtPKR(o.transfersIn)}</td>
                      <td>{fmtPKR(o.transfersOut)}</td>
                      <td className={o.net >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>{fmtPKR(o.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">{message}</CardContent></Card>
  );
}
