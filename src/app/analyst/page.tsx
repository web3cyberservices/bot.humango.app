
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTasksForReview, updateAndReleaseTask } from '@/app/actions/analytics-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Globe, Mail, Phone, ShieldAlert } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';

export default function AnalystPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [tempEmails, setTempEmails] = useState<string>("");
  const [tempPhones, setTempPhones] = useState<string>("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/violations?t=' + Date.now());
      const data = await res.json();
      // Filter for tasks needing analyst review
      const filtered = (data.violations || []).filter((v: any) => v.crm_status === 'needs_analyst');
      setTasks(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRelease = async (taskId: number) => {
    const emails = tempEmails.split(',').map(e => ({ value: e.trim() })).filter(e => e.value);
    const phones = tempPhones.split(',').map(p => ({ value: p.trim() })).filter(p => p.value);
    
    const res = await updateAndReleaseTask(taskId, emails, phones, notes);
    if (res.success) {
      toast({ title: "Lead Released", description: "Pushed to Sales team." });
      setEditingTask(null);
      fetchData();
    }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col">
      <header className="h-16 border-b border-white/5 bg-[#0b1120]/50 backdrop-blur-xl px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span className="font-bold">Analyst Hub <Badge variant="outline" className="ml-2 border-amber-500/20 text-amber-500">Data Enrichment</Badge></span>
        </div>
        <Link href="/manager" className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white">CRM View</Link>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tasks.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500 italic">No tasks currently require enrichment.</div>
        ) : tasks.map((task) => (
          <Card key={task.id} className="bg-white/[0.03] border-white/10 hover:border-primary/30 transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 truncate">
                <Globe className="w-3 h-3 text-primary" /> {task.domain}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">Violations ({task.violation_count})</p>
                <div className="space-y-1">
                  {(task.audit_findings || []).slice(0, 2).map((f: any, i: number) => (
                    <p key={i} className="text-[10px] text-slate-300 truncate">• {f.summary}</p>
                  ))}
                </div>
              </div>
              <Button className="w-full bg-primary font-bold h-9" onClick={() => { 
                setEditingTask(task); 
                setTempEmails(""); 
                setTempPhones("");
                setNotes("");
              }}>Manual Enrich</Button>
            </CardContent>
          </Card>
        ))}
      </main>

      {editingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <Card className="w-full max-w-lg bg-[#0b1120] border-white/10 shadow-2xl animate-in zoom-in-95">
            <CardHeader><CardTitle className="text-lg font-bold">{editingTask.domain}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Mail className="w-3 h-3" /> Emails (comma separated)</label>
                  <Input value={tempEmails} onChange={(e) => setTempEmails(e.target.value)} placeholder="ceo@site.com, info@site.com" className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Phone className="w-3 h-3" /> Phones (comma separated)</label>
                  <Input value={tempPhones} onChange={(e) => setTempPhones(e.target.value)} placeholder="+49 123 456789" className="bg-white/5 border-white/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Analyst Notes</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Owner: Hans Muller. Found on LinkedIn." className="bg-white/5 border-white/10 h-24" />
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-white/10" onClick={() => setEditingTask(null)}>Cancel</Button>
                <Button className="flex-1 bg-primary font-bold" onClick={() => handleRelease(editingTask.id)}><Send className="w-4 h-4 mr-2" /> Release to Sales</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
