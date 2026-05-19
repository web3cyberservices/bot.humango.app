
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { takeTaskInWork, getAvailableTasks, getMyTasks, updateTaskStatusAction } from '@/app/actions/crm-actions';
import { sendAuditEmailAction } from '@/app/actions/crm-email-actions';
import { logoutAction, getSession } from '@/app/actions/auth-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Briefcase, Globe, Clock, CheckCircle2, LogOut, 
  ExternalLink, Phone, Mail, ChevronRight, AlertCircle, UserCheck, ShieldAlert, User, History, TrendingUp, Copy, Zap, Eye, Download, DollarSign
} from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ManagerDashboard() {
  const [session, setSession] = useState<any>(null);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [closingPrice, setClosingPrice] = useState<string>("");
  const [showClosingPriceDialog, setShowClosingPriceDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{id: number, status: string} | null>(null);

  const { toast } = useToast();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const s = await getSession();
      if (!s) {
        router.push('/login');
        return;
      }
      setSession(s);
      
      const [available, mine] = await Promise.all([
        getAvailableTasks(),
        getMyTasks()
      ]);
      setAvailableTasks(available);
      setMyTasks(mine);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTakeTask = async (taskId: number) => {
    setProcessingId(taskId.toString());
    try {
      const result = await takeTaskInWork(taskId);
      if (result.success) {
        toast({ title: "Задача принята", description: "Сайт добавлен в вашу воронку." });
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: result.error });
        fetchData();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Критическая ошибка", description: e.message });
    } finally {
      setProcessingId(null);
    }
  };

  const confirmStatusUpdate = async () => {
    if (!pendingStatusChange) return;
    
    const price = parseFloat(closingPrice);
    if (isNaN(price) || price <= 0) {
        toast({ variant: "destructive", title: "Ошибка", description: "Введите корректную сумму сделки." });
        return;
    }

    try {
        const res = await updateTaskStatusAction(pendingStatusChange.id, pendingStatusChange.status, price);
        if (res.success) {
            toast({ title: "Статус обновлен, сделка закрыта!" });
            setShowClosingPriceDialog(false);
            setClosingPrice("");
            setPendingStatusChange(null);
            fetchData();
            if (selectedTask?.id === pendingStatusChange.id) {
                setSelectedTask({ ...selectedTask, status: pendingStatusChange.status, closing_price: price });
            }
        } else {
            toast({ variant: "destructive", title: "Ошибка", description: res.error });
        }
    } catch (e: any) {
        toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    if (newStatus === 'completed' || newStatus === 'done') {
        setPendingStatusChange({id: taskId, status: newStatus});
        setShowClosingPriceDialog(true);
        return;
    }

    try {
      const res = await updateTaskStatusAction(taskId, newStatus);
      if (res.success) {
        toast({ title: "Статус обновлен" });
        fetchData();
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, status: newStatus });
        }
      } else {
        toast({ variant: "destructive", title: "Ошибка", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    }
  };

  const openEmailModal = (task: any) => {
    const domain = new URL(task.url).hostname;
    setEmailBody(`Dear owner of ${domain},\n\nOur automated compliance engine has detected potential GDPR violations on your website. Please find the attached audit report detailing the critical risks and potential statutory liabilities.\n\nBest regards,\nHumango Compliance Team`);
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    const targetEmail = selectedTask?.extracted_emails?.[0]?.value || selectedTask?.user_email;
    if (!selectedTask || !targetEmail) {
      toast({ variant: "destructive", title: "Email not found" });
      return;
    }
    setIsSendingEmail(true);
    try {
      const res = await sendAuditEmailAction(selectedTask.id, session.email, targetEmail, emailBody);
      if (res.success) {
        toast({ title: "Email отправлен", description: "Отчет успешно доставлен клиенту." });
        setIsEmailModalOpen(false);
        fetchData();
      } else {
        toast({ variant: "destructive", title: "Ошибка отправки", description: res.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Ошибка", description: e.message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    router.push('/login');
  };

  const myStats = useMemo(() => {
    const completed = myTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
    const active = myTasks.filter(t => ['in_work', 'negotiation', 'in_progress'].includes(t.status)).length;
    return {
      total: myTasks.length,
      completed,
      active,
      conversion: myTasks.length > 0 ? Math.round((completed / myTasks.length) * 100) : 0
    };
  }, [myTasks]);

  const findings = useMemo(() => {
    if (!selectedTask?.audit_findings) return [];
    if (Array.isArray(selectedTask.audit_findings)) return selectedTask.audit_findings;
    try {
      return typeof selectedTask.audit_findings === 'string' 
        ? JSON.parse(selectedTask.audit_findings) 
        : selectedTask.audit_findings;
    } catch (e) { return []; }
  }, [selectedTask]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col font-body">
      <header className="h-16 border-b border-white/5 bg-[#0b1120]/50 backdrop-blur-xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span className="font-bold text-lg">Manager CRM</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            <User className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{session?.email}</span>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white"><Link href="/admin">Admin Hub</Link></Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"><LogOut className="w-4 h-4 mr-2" /> Выход</Button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-primary/20 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-primary" /></div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-slate-500">Всего заказов</p>
                 <p className="text-2xl font-bold">{myStats.total}</p>
               </div>
             </CardContent>
           </Card>
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-emerald-500/20 p-2 rounded-lg"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-slate-500">Выполнено</p>
                 <p className="text-2xl font-bold text-emerald-500">{myStats.completed}</p>
               </div>
             </CardContent>
           </Card>
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-amber-500/20 p-2 rounded-lg"><Clock className="w-5 h-5 text-amber-500" /></div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-slate-500">В процессе</p>
                 <p className="text-2xl font-bold text-amber-500">{myStats.active}</p>
               </div>
             </CardContent>
           </Card>
           <Card className="bg-white/[0.03] border-white/10">
             <CardContent className="pt-6 flex items-center gap-4">
               <div className="bg-blue-500/20 p-2 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-500" /></div>
               <div>
                 <p className="text-[10px] uppercase font-bold text-slate-500">Конверсия</p>
                 <p className="text-2xl font-bold text-blue-500">{myStats.conversion}%</p>
               </div>
             </CardContent>
           </Card>
        </div>

        <Tabs defaultValue="available" className="w-full space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="available" className="data-[state=active]:bg-primary rounded-lg text-xs font-bold gap-2">
              <Globe className="w-3.5 h-3.5" /> Свободные задачи
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary rounded-lg text-xs font-bold gap-2">
              <History className="w-3.5 h-3.5" /> Мои заказы (Все)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="available">
            <Card className="bg-white/[0.03] border-white/10 shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 pb-4 bg-emerald-500/5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500" /> Свободные задачи (Сортировка по весу)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-white/[0.02]">
                    <TableRow className="border-white/5">
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Домен</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 text-center">Приоритет</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 text-center">Нарушений</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 text-right">Предпросмотр</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Действие</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableTasks.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500 text-xs">Нет доступных задач с нарушениями</TableCell></TableRow>
                    ) : availableTasks.map((task) => (
                      <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.01] transition-colors">
                        <TableCell className="text-xs font-medium text-white">
                          <div className="flex items-center gap-2">
                            {task.url?.replace(/^https?:\/\//, '')}
                            {task.priority >= 100 && <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/20 text-[8px] animate-pulse"><Zap className="w-2 h-2 mr-1" /> HOT</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                           <span className={`text-xs font-bold ${task.priority >= 100 ? 'text-orange-500' : task.priority >= 50 ? 'text-amber-500' : 'text-slate-500'}`}>
                             {task.priority}
                           </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/20">{task.violations_count}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-[10px] gap-2 text-primary"
                              onClick={() => setSelectedTask(task)}
                            >
                              <Eye className="w-3 h-3" /> Проверить отчет
                            </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => handleTakeTask(task.id)}
                            disabled={processingId === task.id.toString()}
                            className="h-8 text-[10px] bg-primary hover:bg-primary/90 font-bold px-6 rounded-lg"
                          >
                            {processingId === task.id.toString() ? <Loader2 className="w-3 h-3 animate-spin" /> : "Взять в работу"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-white/[0.03] border-white/10 shadow-2xl overflow-hidden">
              <CardHeader className="border-b border-white/5 pb-4 bg-primary/5">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" /> История всех моих заказов ({myTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-white/[0.02]">
                    <TableRow className="border-white/5">
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Сайт</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Взято</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Сумма</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Статус</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Управление</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myTasks.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500 text-xs">У вас нет активных задач</TableCell></TableRow>
                    ) : myTasks.map((task) => (
                      <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.01] transition-colors group cursor-pointer" onClick={() => setSelectedTask(task)}>
                        <TableCell className="text-xs font-medium text-white">
                          <div className="flex items-center gap-2">
                            {task.url?.replace(/^https?:\/\//, '')}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] text-slate-400">
                          {new Date(task.assigned_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-[10px] font-bold text-emerald-500">
                           {task.closing_price ? `${task.closing_price} €` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] uppercase tracking-tighter border-white/10 ${
                              task.status === 'done' || task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                              task.status === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-2">Открыть карточку <ChevronRight className="w-3 h-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* LEAD CARD DIALOG */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-5xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
            {/* LEFT SIDE: General info and Status */}
            <div className="w-full md:w-1/3 border-r border-white/5 p-8 space-y-8 bg-white/[0.01] overflow-y-auto scrollbar-hide">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold truncate">{selectedTask?.url?.replace(/^https?:\/\//, '')}/</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className="bg-rose-500/20 text-rose-500 text-[10px] font-bold border-rose-500/20">{selectedTask?.violations_count || findings.length} Нарушений</Badge>
                  {selectedTask?.auto_message_sent && (
                    <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px] font-bold border-emerald-500/20">Auto-Email Sent</Badge>
                  )}
                  {selectedTask?.priority >= 100 && (
                    <Badge className="bg-orange-500/20 text-orange-500 text-[10px] font-bold border-orange-500/20">High Priority</Badge>
                  )}
                </div>
              </DialogHeader>

              {selectedTask?.crm_status === 'in_work' && (
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Статус</label>
                  <Select 
                    defaultValue={selectedTask?.status} 
                    onValueChange={(val) => handleStatusChange(selectedTask.id, val)}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 h-11 text-xs">
                      <SelectValue placeholder="Сменить статус" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0b1120] border-white/10 text-white">
                      <SelectItem value="in_work">Взят в работу</SelectItem>
                      <SelectItem value="negotiation">В переговорах</SelectItem>
                      <SelectItem value="in_progress">В процессе</SelectItem>
                      <SelectItem value="done">Успешно (Выполнено)</SelectItem>
                      <SelectItem value="rejected">Отказ / Слив</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">Детали нарушений</h3>
                <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 scrollbar-hide">
                  {findings && findings.length > 0 ? findings.map((f: any, i: number) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2 group hover:border-rose-500/30 transition-all">
                      <div className="flex items-center gap-2">
                         <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                         <span className="text-[10px] font-bold text-rose-400 uppercase">{f.type?.replace(/_/g, ' ') || 'Violation'}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{f.summary || f.description}</p>
                      <div className="pt-2 border-t border-white/5 space-y-1">
                        <p className="text-[9px] text-slate-500 font-bold uppercase">Закон: {f.basis || f.law_name}</p>
                        {f.liability && (
                          <p className="text-[9px] text-rose-400 font-bold">Штраф: {f.liability}</p>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-slate-500 italic">Нарушения не детализированы</p>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Actions and Contacts */}
            <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-[#020617] scrollbar-hide">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2 border-white/10 hover:bg-white/5 transition-all" asChild>
                    <a href={`/api/admin/report-pdf?domain=${selectedTask?.url}`} target="_blank">
                        <Download className="w-6 h-6 text-emerald-500" />
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">СКАЧАТЬ ОТЧЕТ</span>
                    </a>
                </Button>
                <Button className="h-20 flex-col gap-2 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20" onClick={() => openEmailModal(selectedTask)} disabled={selectedTask?.crm_status !== 'in_work'}>
                  <Mail className="w-6 h-6 text-white" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">ОТПРАВИТЬ ПИСЬМО</span>
                </Button>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400"><UserCheck className="w-4 h-4" /> Контактные данные (Extract)</h3>
                  <div className="space-y-3">
                    {/* Primary Email */}
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between group hover:border-primary/30 transition-all">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Target Email (Seed)</span>
                        <span className="text-sm font-mono text-white">{selectedTask?.user_email || 'Email не найден'}</span>
                      </div>
                      {selectedTask?.user_email && (
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-slate-500 hover:text-primary" onClick={() => { navigator.clipboard.writeText(selectedTask.user_email); toast({ title: "Скопировано" }); }}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                      )}
                    </div>

                    {/* Extracted Emails with Context */}
                    {selectedTask?.extracted_emails && selectedTask.extracted_emails.length > 0 && selectedTask.extracted_emails.map((emailObj: any, i: number) => (
                      <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 group hover:border-emerald-500/30 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                            <span className="text-[9px] text-emerald-500 uppercase font-bold mb-1">Found on site</span>
                            <span className="text-sm font-mono text-white">{emailObj.value}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-slate-500 hover:text-primary" onClick={() => { navigator.clipboard.writeText(emailObj.value); toast({ title: "Скопировано" }); }}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                            </Button>
                        </div>
                        {emailObj.context && (
                            <p className="text-[10px] text-slate-500 italic bg-black/20 p-2 rounded leading-relaxed">
                                ...{emailObj.context}...
                            </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400"><Phone className="w-4 h-4" /> Телефоны (Found on site)</h3>
                  <div className="space-y-3">
                    {selectedTask?.extracted_phones && selectedTask.extracted_phones.length > 0 && selectedTask.extracted_phones.map((phoneObj: any, i: number) => (
                      <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 group hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-mono">{phoneObj.value}</span>
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] hover:text-primary" onClick={() => { navigator.clipboard.writeText(phoneObj.value); toast({ title: "Скопировано" }); }}>
                                <Copy className="w-3 h-3 mr-1" /> Copy
                            </Button>
                        </div>
                        {phoneObj.context && (
                            <p className="text-[10px] text-slate-500 italic bg-black/20 p-2 rounded leading-relaxed">
                                ...{phoneObj.context}...
                            </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CLOSING PRICE DIALOG */}
      <Dialog open={showClosingPriceDialog} onOpenChange={setShowClosingPriceDialog}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-md p-8">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" /> Фиксация сделки
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 pt-4">
                <p className="text-sm text-slate-400">Укажите финальную сумму заказа для закрытия задачи. Это необходимо для статистики менеджера.</p>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Сумма заказа (€)</label>
                    <Input 
                        type="number" 
                        placeholder="например, 500" 
                        value={closingPrice}
                        onChange={(e) => setClosingPrice(e.target.value)}
                        className="bg-white/5 border-white/10 h-12 text-lg font-bold"
                    />
                </div>
                <div className="flex gap-3 pt-2">
                    <Button variant="ghost" className="flex-1" onClick={() => { setShowClosingPriceDialog(false); setPendingStatusChange(null); }}>Отмена</Button>
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 font-bold" onClick={confirmStatusUpdate}>Подтвердить</Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* EMAIL COMPOSER MODAL */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="p-8 space-y-6 overflow-y-auto scrollbar-hide">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                <Mail className="w-6 h-6 text-primary" /> Отправка отчета (Reply-To: {session?.email})
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Получатель:</label>
                <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-sm text-slate-300 font-mono">
                  {selectedTask?.extracted_emails?.[0]?.value || selectedTask?.user_email || 'Email не найден'}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Текст письма:</label>
                <Textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="min-h-[250px] bg-white/5 border-white/10 text-sm leading-relaxed"
                />
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-4">
                <div className="bg-primary/20 p-2 rounded-lg">
                  <ShieldAlert className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Вложение: PDF Отчет</p>
                  <p className="text-[10px] text-slate-500">Humango_Audit_{selectedTask?.url?.replace(/^https?:\/\//, '')}.pdf</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-[#0b1120] pb-2">
              <Button variant="ghost" onClick={() => setIsEmailModalOpen(false)}>Отмена</Button>
              <Button 
                disabled={isSendingEmail || (!selectedTask?.user_email && (!selectedTask?.extracted_emails || selectedTask.extracted_emails.length === 0))}
                onClick={handleSendEmail}
                className="bg-primary hover:bg-primary/90 px-8 font-bold"
              >
                {isSendingEmail ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Отправка...</> : "Отправить письмо"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
