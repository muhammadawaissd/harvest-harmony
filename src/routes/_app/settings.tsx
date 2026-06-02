import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", cnic: "", address: "", note: "" });

  const owners = useQuery({ queryKey: ["owners"], queryFn: async () => (await supabase.from("owners").select("*").order("name")).data ?? [] });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("owners").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Owner added"); setForm({ name: "", phone: "", cnic: "", address: "", note: "" }); qc.invalidateQueries({ queryKey: ["owners"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("owners").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owners"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div><h1 className="text-2xl font-bold">Settings</h1><p className="text-sm text-muted-foreground">Manage business owners</p></div>
      <Card><CardHeader><CardTitle>Add owner</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>CNIC</Label><Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Note</Label><Textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={add.isPending}>Add owner</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Owners</CardTitle></CardHeader>
        <CardContent>
          {(owners.data ?? []).length === 0 ? <p className="text-muted-foreground">No owners yet. Add the 2 business owners to start.</p> :
            <div className="space-y-3">{owners.data!.map((o: any) => (
              <div key={o.id} className="flex items-start justify-between border rounded-md p-3">
                <div>
                  <div className="font-semibold">{o.name}</div>
                  <div className="text-sm text-muted-foreground">{o.phone} {o.cnic && `· ${o.cnic}`}</div>
                  {o.address && <div className="text-sm">{o.address}</div>}
                  {o.note && <div className="text-sm text-muted-foreground italic">{o.note}</div>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del.mutate(o.id)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            ))}</div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
