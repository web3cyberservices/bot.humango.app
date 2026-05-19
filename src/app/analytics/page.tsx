
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTasksForReview, updateAndReleaseTask, deleteTaskAction } from '@/app/actions/analytics-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, Send, Trash2, Mail, Phone, Plus, X, Globe, Search } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';

export default function AnalyticsDashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [tempEmails, setTempEmails] = useState<{value: string}[]>([]);
  const [tempPhones, setTempPhones] = useState<{value: string}[]>([]);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const data = await getTasksForReview();
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startEdit = (task: any) => {
    setEditingTask(task);
    setTempEmails(task.extracted_emails || []);
    setTempPhones(task.extracted_phones || []);
  };

  const handleRelease = async (taskId: number) => {
    const res = await updateAndReleaseTask(taskId, tempEmails, tempPhones);
    if (res.success) {
      toast({ title: "Lead Released", description: "This task is now available for managers." });
      setEditingTask(null);
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error });
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm("Are you sure? This will remove the audit completely.")) return;
    await deleteTaskAction(taskId);
    fetchData();
    toast({ title: "Task Deleted" });
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col font-body">
      <header className="h-16 border-b border-white/5 bg-[#0b1120]/50 backdrop-blur-xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span className="font-bold text-lg text-white">Analytics Hub</span>
          <Badge variant="outline" className="border-amber-500/20 text-amber-500 bg-amber-500/5 ml-4">Verification Queue</Badge>
        </div>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" asChild className="text-xs uppercase tracking-widest font-bold"><Link href="/admin">Dashboard</Link></Button>
          <Button variant="ghost" asChild className="text-xs uppercase tracking-widest font-bold"><Link href="/manager">CRM</Link></Button>
        </nav>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Manual Verification</h1>
          <p className="text-slate-400 text-sm">Reviewing sites where contacts were not found or require correction.</p>
        </div>

        <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/5">
                <TableHead className="text-[10px] uppercase font-bold">Domain</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-center">Issues</TableHead>
                <TableHead className="text-[10px] uppercase font-bold text-center">Priority</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-500 italic">No tasks pending manual review</TableCell></TableRow>
              ) : tasks.map((task) => (
                <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.01]">
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3 h-3 text-slate-500" />
                      {task.url?.replace(/^https?:\/\//, '')}
                    </div>
                  </TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="text-rose-500 border-rose-500/20">{task.violations_count}</Badge></TableCell>
                  <TableCell className="text-center font-bold text-amber-500">{task.priority}</TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-rose-500 hover:text-rose-400" onClick={() => handleDelete(task.id)}><Trash2 className="w-4 h-4" /></Button>
                    <Button size="sm" onClick={() => startEdit(task)} className="h-8 bg-primary font-bold">Fix Contacts</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {editingTask && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <Card className="w-full max-w-2xl bg-[#0b1120] border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
              <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">{editingTask.url?.replace(/^https?:\/\//, '')}</CardTitle>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Manual Data Entry</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditingTask(null)}><X className="w-5 h-5" /></Button>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-primary"><Mail className="w-4 h-4" /> Emails</h3>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-white/10 bg-white/5" onClick={() => setTempEmails([...tempEmails, {value: ''}])}><Plus className="w-3 h-3 mr-1" /> Add Email</Button>
                  </div>
                  <div className="space-y-2">
                    {tempEmails.map((email, i) => (
                      <div key={i} className="flex gap-2">
                        <Input 
                          value={email.value} 
                          onChange={(e) => {
                            const newArr = [...tempEmails];
                            newArr[i].value = e.target.value;
                            setTempEmails(newArr);
                          }}
                          placeholder="client@company.com" 
                          className="bg-white/5 border-white/10 h-10" 
                        />
                        <Button variant="ghost" size="icon" onClick={() => setTempEmails(tempEmails.filter((_, idx) => idx !== i))}><X className="w-4 h-4 text-slate-500" /></Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-500"><Phone className="w-4 h-4" /> Phones</h3>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] border-white/10 bg-white/5" onClick={() => setTempPhones([...tempPhones, {value: ''}])}><Plus className="w-3 h-3 mr-1" /> Add Phone</Button>
                  </div>
                  <div className="space-y-2">
                    {tempPhones.map((phone, i) => (
                      <div key={i} className="flex gap-2">
                        <Input 
                          value={phone.value} 
                          onChange={(e) => {
                            const newArr = [...tempPhones];
                            newArr[i].value = e.target.value;
                            setTempPhones(newArr);
                          }}
                          placeholder="+49..." 
                          className="bg-white/5 border-white/10 h-10" 
                        />
                        <Button variant="ghost" size="icon" onClick={() => setTempPhones(tempPhones.filter((_, idx) => idx !== i))}><X className="w-4 h-4 text-slate-500" /></Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <Button variant="outline" className="flex-1 border-white/10 h-12 font-bold" onClick={() => setEditingTask(null)}>Cancel</Button>
                  <Button className="flex-1 bg-primary h-12 font-bold" onClick={() => handleRelease(editingTask.id)}>
                    <Send className="w-4 h-4 mr-2" /> Release to Managers
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
