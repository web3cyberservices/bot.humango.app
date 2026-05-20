
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { takeTaskInWork, getAvailableTasks, getMyTasks, updateTaskStatusAction } from '@/app/actions/crm-actions';
import { logoutAction, getSession } from '@/app/actions/auth-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Globe, CheckCircle2, LogOut, ChevronRight, UserCheck, ShieldAlert, User, TrendingUp, Copy, Eye, Download, DollarSign, Mail, StickyNote, BarChart3 
} from "lucide-react";
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function ManagerDashboard() {
  const [session, setSession] = useState<any>(null);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [closingPrice, setClosingPrice] = useState("");
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<any>(null);
  
  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) { router.push('/login'); return; }
      setSession(s);
      
      const [available, mine] = await Promise.all([getAvailableTasks(), getMyTasks()]);
      // Manager only sees 'ready_for_sales'
      setAvailableTasks(available.filter(t => t.crm_status === 'ready_for_sales'));
      setMyTasks(mine);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    return {
      total: myTasks.length,
      won: myTasks.filter(t => t.crm_status === 'won').length,
      lost: myTasks.filter(t => t.crm_status === 'lost').length,
      revenue: myTasks.reduce((acc, t) => acc + (parseFloat(t.closing_price) || 0), 0)
    };
  }, [myTasks]);

  const handleTakeTask = async (taskId: number) => {
    const res = await takeTaskInWork(taskId);
    if (res.success) { toast({ title: "Lead Assigned" }); fetchData(); } 
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    if (newStatus === 'won') {
        setPendingStatus({id: taskId, status: newStatus});
        setShowPriceDialog(true);
        return;
    }
    const res = await updateTaskStatusAction(taskId, newStatus);
    if (res.success) { toast({ title: "Status Updated" }); fetchData(); }
  };

  const confirmDeal = async () => {
    const res = await updateTaskStatusAction(pendingStatus.id, pendingStatus.status, parseFloat(closingPrice));
    if (res.success) {
        toast({ title: "Deal Closed!" });
        setShowPriceDialog(false);
        setClosingPrice("");
        fetchData();
        setSelectedTask(null);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col">
      <header className="h-16 border-b border-white/5 bg-[#0b1120]/50 backdrop-blur-xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span className="font-bold text-lg">Sales CRM</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/analyst" className="text-xs font-bold text-amber-500 hover:underline">Analyst Hub</Link>
          <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
            <User className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-slate-300 uppercase">{session?.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await logoutAction(); router.push('/login'); }} className="text-rose-400"><LogOut className="w-4 h-4 mr-2" /> Logout</Button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Statistics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-primary/20 p-2 rounded-lg"><BarChart3 className="w-5 h-5 text-primary" /></div>
               <div><p className="text-[10px] uppercase font-bold text-slate-500">Pipeline</p><p className="text-2xl font-bold">{stats.total}</p></div>
             </CardContent>
           </Card>
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-emerald-500/20 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
               <div><p className="text-[10px] uppercase font-bold text-slate-500">Won</p><p className="text-2xl font-bold text-emerald-500">{stats.won}</p></div>
             </CardContent>
           </Card>
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-rose-500/20 p-2 rounded-lg"><ShieldAlert className="w-5 h-5 text-rose-500" /></div>
               <div><p className="text-[10px] uppercase font-bold text-slate-500">Lost</p><p className="text-2xl font-bold text-rose-500">{stats.lost}</p></div>
             </CardContent>
           </Card>
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-amber-500/20 p-2 rounded-lg"><DollarSign className="w-5 h-5 text-amber-500" /></div>
               <div><p className="text-[10px] uppercase font-bold text-slate-500">Revenue</p><p className="text-2xl font-bold text-amber-500">€{stats.revenue.toLocaleString()}</p></div>
             </CardContent>
           </Card>
        </div>

        <Tabs defaultValue="qualified" className="w-full space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="qualified" className="text-xs font-bold gap-2">Ready to Claim ({availableTasks.length})</TabsTrigger>
            <TabsTrigger value="active" className="text-xs font-bold gap-2">My Active Pipeline ({myTasks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="qualified">
            <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px] uppercase font-bold">Domain</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-center">Score</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-center">Issues</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.01]">
                      <TableCell className="text-xs font-medium">{task.url?.replace(/^https?:\/\//, '')}</TableCell>
                      <TableCell className="text-center font-bold text-amber-500">{task.priority}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline" className="text-rose-500 border-rose-500/20">{task.violations_count}</Badge></TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] text-primary" onClick={() => setSelectedTask(task)}><Eye className="w-3 h-3 mr-1" /> View Report</Button>
                        <Button size="sm" onClick={() => handleTakeTask(task.id)} className="h-8 text-[10px] bg-primary font-bold">Claim Lead</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="active">
            <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px] uppercase font-bold">Site</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-center">Status</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-center">Deal Size</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/5 cursor-pointer hover:bg-white/[0.01]" onClick={() => setSelectedTask(task)}>
                      <TableCell className="text-xs">{task.url?.replace(/^https?:\/\//, '')}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] uppercase ${task.crm_status === 'won' ? 'bg-emerald-500' : 'bg-primary'}`}>
                          {task.crm_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-[10px] font-bold text-emerald-500">
                        {task.closing_price ? `${task.closing_price} €` : '-'}
                      </TableCell>
                      <TableCell className="text-right"><ChevronRight className="w-4 h-4 ml-auto" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-5xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <div className="w-full md:w-1/3 border-r border-white/5 p-8 space-y-6 bg-white/[0.01] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold truncate">{selectedTask?.url?.replace(/^https?:\/\//, '')}</DialogTitle>
              </DialogHeader>

              {selectedTask?.assigned_to === parseInt(session?.id) && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Lead Status</label>
                  <Select defaultValue={selectedTask?.crm_status} onValueChange={(v) => handleStatusChange(selectedTask.id, v)}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0b1120] border-white/10 text-white">
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="won">Deal Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTask?.analyst_notes && (
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-bold text-amber-500 flex items-center gap-2 uppercase"><StickyNote className="w-3 h-3" /> Analyst Notes</h4>
                  <p className="text-xs text-slate-400 italic">"{selectedTask.analyst_notes}"</p>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">Violations Found</h3>
                <div className="space-y-3">
                  {(selectedTask?.audit_findings || []).map((f: any, i: number) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                      <div className="flex items-center gap-2"><ShieldAlert className="w-3 h-3 text-rose-500" /><span className="text-[10px] font-bold text-rose-400 uppercase">{f.type || 'Violation'}</span></div>
                      <p className="text-[11px] text-slate-300">{f.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 p-8 space-y-8 bg-[#020617] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2 border-white/10" asChild>
                  <a href={`/api/admin/report-pdf?domain=${selectedTask?.url}`} target="_blank">
                    <Download className="w-6 h-6 text-emerald-500" /><span className="text-[10px] font-bold uppercase">View PDF Report</span>
                  </a>
                </Button>
                <Button className="h-20 flex-col gap-2 bg-primary" disabled={selectedTask?.assigned_to !== parseInt(session?.id)}>
                  <Mail className="w-6 h-6 text-white" /><span className="text-[10px] font-bold uppercase">Send to Client</span>
                </Button>
              </div>

              <div className="space-y-6">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400 uppercase tracking-widest"><UserCheck className="w-4 h-4" /> Validated Contacts</h3>
                <div className="space-y-4">
                  {(selectedTask?.extracted_emails || []).map((e: any, i: number) => (
                    <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2">
                      <div className="flex justify-between items-center"><span className="text-sm font-mono text-primary">{e.value}</span><Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => navigator.clipboard.writeText(e.value)}><Copy className="w-3 h-3 mr-1" /> Copy</Button></div>
                      {e.context && <p className="text-[10px] text-slate-500 italic bg-black/20 p-2 rounded">...{e.context}...</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Won Deal Price Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-white max-w-md p-8">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-500"><DollarSign className="w-5 h-5" /> Lock Won Deal</DialogTitle></DialogHeader>
            <div className="space-y-6 pt-4">
                <p className="text-sm text-slate-400">Enter final contract value to close this lead and record your commission.</p>
                <Input type="number" placeholder="500" value={closingPrice} onChange={(e) => setClosingPrice(e.target.value)} className="bg-white/5 border-white/10 h-12 text-lg font-bold" />
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold h-12" onClick={confirmDeal}>Complete Sale</Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
