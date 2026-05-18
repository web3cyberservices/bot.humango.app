
'use client';

import { useState, useEffect, useCallback } from 'react';
import { takeTaskInWork, getAvailableTasks, getMyTasks, updateTaskStatusAction } from '@/app/actions/crm-actions';
import { logoutAction, getSession } from '@/app/actions/auth-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  ExternalLink, Phone, Mail, ChevronRight, AlertCircle, UserCheck
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

      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-4xl p-0 overflow-hidden">
          <div className="flex h-[600px]">
            <div className="w-1/3 border-r border-white/5 p-6 space-y-8 bg-white/[0.01]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold truncate">{selectedTask?.url?.replace(/^https?:\/\//, '')}</DialogTitle>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-rose-500/20 text-rose-500 text-[9px]">{selectedTask?.violations_count} Нарушений</Badge>
                  {selectedTask?.auto_message_sent && (
                    <Badge className="bg-amber-500/20 text-amber-500 text-[9px]">Авто-письмо: Да</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Воронка продаж</label>
                <Select 
                  defaultValue={selectedTask?.status} 
                  onValueChange={(val) => handleStatusChange(selectedTask.id, val)}
                >
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-xs">
                    <SelectValue placeholder="Сменить статус" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1120] border-white/10 text-white">
                    <SelectItem value="in_work">В работе</SelectItem>
                    <SelectItem value="negotiation">В переговорах</SelectItem>
                    <SelectItem value="in_progress">В процессе</SelectItem>
                    <SelectItem value="done">Выполнено</SelectItem>
                    <SelectItem value="rejected">Отклонено</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedTask?.auto_message_sent && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                    <AlertCircle className="w-4 h-4" /> Внимание
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">Этой компании уже было отправлено автоматическое уведомление {new Date(selectedTask.auto_message_sent_at).toLocaleDateString()}.</p>
                </div>
              )}
            </div>

            <div className="flex-1 p-8 space-y-8 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-16 flex-col gap-1 border-white/10 hover:bg-white/5" onClick={() => toast({ title: "VoIP Интеграция", description: "Функция вызова временно недоступна." })}>
                  <Phone className="w-5 h-5 text-emerald-500" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Позвонить (VoIP)</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1 border-white/10 hover:bg-white/5" onClick={() => toast({ title: "Email Модуль", description: "Открытие редактора шаблонов..." })}>
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="text-[10px] uppercase font-bold tracking-widest">Отправить письмо</span>
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400"><UserCheck className="w-4 h-4" /> Контактные данные (Extract)</h3>
                  <div className="space-y-3">
                    {selectedTask?.contacts?.emails?.length > 0 ? selectedTask.contacts.emails.map((email: string, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-xs text-white">{email}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] hover:text-primary">Copy</Button>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-500 italic">Emails не обнаружены</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4 text-slate-400"><Phone className="w-4 h-4" /> Телефоны</h3>
                  <div className="space-y-3">
                    {selectedTask?.contacts?.phones?.length > 0 ? selectedTask.contacts.phones.map((phone: string, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                        <span className="text-xs text-white">{phone}</span>
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] hover:text-primary">Call</Button>
                      </div>
                    )) : (
                      <p className="text-xs text-slate-500 italic">Номера не обнаружены</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
