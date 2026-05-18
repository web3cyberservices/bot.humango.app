
'use client';

import { useState, useEffect, useCallback } from 'react';
import { assignTaskToManager, getAvailableTasks, getManagerTasks } from '@/app/actions/crm-actions';
import { logoutAction, getSession } from '@/app/actions/auth-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, Globe, Clock, CheckCircle2, AlertCircle, LogOut } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ManagerDashboard() {
  const [session, setSession] = useState<any>(null);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
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
        getManagerTasks()
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

  const handleTakeTask = async (taskId: string) => {
    setProcessingId(taskId);
    
    const formData = new FormData();
    formData.append('taskId', taskId);

    try {
      const result = await assignTaskToManager(formData);
      if (result.success) {
        toast({ title: "Задача принята", description: "Сайт добавлен в ваш список работы." });
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
          <span className="font-bold text-lg">Manager <span className="text-primary">CRM</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-[10px] text-slate-500 border-white/10">{session?.email}</Badge>
          <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white"><Link href="/admin">Admin Panel</Link></Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"><LogOut className="w-4 h-4 mr-2" /> Выход</Button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-white/[0.03] border-white/10 shadow-2xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> Мои задачи в работе ({myTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Домен</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Взято в</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTasks.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 text-xs">У вас пока нет активных задач</TableCell></TableRow>
                  ) : myTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="text-xs font-medium text-white">{task.url?.replace(/^https?:\/\//, '')}</TableCell>
                      <TableCell className="text-[10px] text-slate-400">
                        {new Date(task.assigned_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-white/10 hover:bg-white/5" asChild>
                          <a href={`/api/admin/report-pdf?domain=${task.url}`} target="_blank">PDF Отчет</a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.03] border-white/10 shadow-2xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" /> Доступные сайты ({availableTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Домен</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Статус</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest text-slate-500">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableTasks.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 text-xs">Нет свободных задач</TableCell></TableRow>
                  ) : availableTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                      <TableCell className="text-xs font-medium text-white">{task.url?.replace(/^https?:\/\//, '')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[8px] border-emerald-500/20 text-emerald-400 bg-emerald-500/5 uppercase font-bold">Готов</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleTakeTask(task.id)}
                          disabled={processingId === task.id.toString()}
                          className="h-7 text-[10px] bg-primary hover:bg-primary/90 font-bold"
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
        </div>
      </main>
    </div>
  );
}
