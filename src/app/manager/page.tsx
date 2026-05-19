
'use client';

import { useState, useEffect, useCallback } from 'react';
import { takeTaskInWork, getAvailableTasks, getMyTasks, updateTaskStatusAction } from '@/app/actions/crm-actions';
import { sendAuditEmailAction } from '@/app/actions/crm-email-actions';
import { logoutAction, getSession } from '@/app/actions/auth-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
  ExternalLink, Phone, Mail, ChevronRight, AlertCircle, UserCheck, ShieldAlert
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

  const handleStatusChange = async (taskId: number, newStatus: string) => {
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
    if (!selectedTask || !selectedTask.user_email) return;
    setIsSendingEmail(true);
    try {
      const res = await sendAuditEmailAction(selectedTask.id, session.email, selectedTask.user_email, emailBody);
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
          <Badge variant="outline" className="text-[10px] text-slate-500 border-white/10 uppercase font-mono tracking-widest">{session?.email}</Badge>
          <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white"><Link href="/admin">Admin Hub</Link></Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"><LogOut className="w-4 h-4 mr-2" /> Выход</Button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-12 max-w-7xl mx-auto w-full">
        <Card className="bg-white/[0.03] border-white/10 shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4 bg-emerald-500/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" /> Свободные задачи с нарушениями ({availableTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/[0.02]">
                <TableRow className="border-white/5">
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Домен</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500 text-center">Нарушений</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Обнаружено</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500 text-xs">Нет доступных задач с нарушениями</TableCell></TableRow>
                ) : availableTasks.map((task) => (
                  <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.01] transition-colors">
                    <TableCell className="text-xs font-medium text-white">{task.url?.replace(/^https?:\/\//, '')}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/20">{task.violations_count}</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] text-slate-400">
                      {new Date(task.created_at).toLocaleString()}
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

        <Card className="bg-white/[0.03] border-white/10 shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4 bg-primary/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-primary" /> Мои активные задачи ({myTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-white/[0.02]">
                <TableRow className="border-white/5">
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Сайт</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Взято</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Статус</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Управление</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500 text-xs">У вас нет активных задач</TableCell></TableRow>
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
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-white/10">
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
      </main>

      {/* LEAD CARD DIALOG */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-5xl p-0 overflow-hidden">
          <div className="flex flex-col md:flex-row h-[750px]">
            {/* LEFT SIDE: General info and Status */}
            <div className="w-full md:w-1/3 border-r border-white/5 p-8 space-y-8 bg-white/[0.01] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold truncate">{selectedTask?.url?.replace(/^https?:\/\//, '')}/</DialogTitle>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className="bg-rose-500/20 text-rose-500 text-[10px] font-bold border-rose-500/20">{selectedTask?.violations_count} Нарушений</Badge>
                  {selectedTask?.auto_message_sent && (
                    <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px] font-bold border-emerald-500/20">Email Отправлен</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Воронка продаж</label>
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

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">Детали нарушений</h3>
                <div className="space-y-4">
                  {selectedTask?.audit_findings?.length > 0 ? selectedTask.audit_findings.map((f: any, i: number) => (
                    <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2 group hover:border-rose-500/30 transition-all">
                      <div className="flex items-center gap-2">
                         <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                         <span className="text-[10px] font-bold text-rose-400 uppercase">{f.type}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{f.summary}</p>
                      <p className="text-[9px] text-slate-500 italic">Штраф: {f.liability}</p>
                    </div>
                  )) : (
                    <p className="text-xs text-slate-500 italic">Нарушения не детализированы</p>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Actions and Contacts */}
            <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-[#020617]">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2 border-white/10 hover:bg-white/5 transition-all" onClick={() => toast({ title: "VoIP Интеграция", description: "Функция вызова временно недоступна." })}>
                  <Phone className="w-6 h-6 text-emerald-500" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">ПОЗВОНИТЬ (VOIP)</span>
                </Button>
                <Button className="h-20 flex-col gap-2 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20" onClick={() => openEmailModal(selectedTask)}>
                  <Mail className="w-6 h-6 text-white" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">ОТПРАВИТЬ ПИСЬМО</span>
                </Button>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400"><UserCheck className="w-4 h-4" /> Контактные данные (Extract)</h3>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all">
                    <span className="text-sm font-mono text-white">{selectedTask?.user_email || 'Email не найден'}</span>
                    {selectedTask?.user_email && (
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-bold text-slate-500 hover:text-primary">Copy</Button>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400"><Phone className="w-4 h-4" /> Телефоны</h3>
                  <div className="space-y-3">
                    {selectedTask?.contacts?.phones?.length > 0 ? selectedTask.contacts.phones.map((phone: string, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-sm text-white font-mono">{phone}</span>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] hover:text-primary">Call</Button>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-500 italic px-2">Номера не обнаружены</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EMAIL COMPOSER MODAL */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-2xl p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <Mail className="w-6 h-6 text-primary" /> Отправка отчета (Reply-To: {session?.email})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Получатель:</label>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5 text-sm text-slate-300 font-mono">
                {selectedTask?.user_email}
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

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsEmailModalOpen(false)}>Отмена</Button>
            <Button 
              disabled={isSendingEmail || !selectedTask?.user_email}
              onClick={handleSendEmail}
              className="bg-primary hover:bg-primary/90 px-8 font-bold"
            >
              {isSendingEmail ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Отправка...</> : "Отправить письмо"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
