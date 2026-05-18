
'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { assignTaskToManager, getAvailableTasks, getManagerTasks } from '@/app/actions/crm-actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Briefcase, Globe, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import Image from 'next/image';
import Link from 'next/link';

export default function ManagerDashboard() {
  const { user, loading: authLoading } = useFirebase();
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    if (!user) return;
    try {
      const [available, mine] = await Promise.all([
        getAvailableTasks(),
        getManagerTasks(user.uid)
      ]);
      setAvailableTasks(available);
      setMyTasks(mine);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [user, authLoading]);

  const handleTakeTask = async (taskId: string) => {
    if (!user) return;
    setProcessingId(taskId);
    
    const formData = new FormData();
    formData.append('taskId', taskId);
    formData.append('managerId', user.uid);
    formData.append('managerEmail', user.email || 'unknown');

    const result = await assignTaskToManager(formData);

    if (result.success) {
      toast({ title: "Задача принята", description: "Сайт добавлен в ваш список работы." });
      fetchData();
    } else {
      toast({ variant: "destructive", title: "Ошибка", description: result.error });
      fetchData(); // Refresh to see if it was already taken
    }
    setProcessingId(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
        <Card className="bg-white/5 border-white/10 p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">You must be logged in as a manager to access this portal.</p>
          <Button asChild className="w-full"><Link href="/login">Login to Terminal</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 flex flex-col">
      <header className="h-16 border-b border-white/5 bg-[#0b1120]/50 backdrop-blur-xl sticky top-0 z-50 px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={24} height={24} />
          <span className="font-bold">Manager <span className="text-primary">CRM</span></span>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-[10px] text-slate-500">{user.email}</Badge>
          <Button variant="ghost" size="sm" asChild><Link href="/admin">Admin Panel</Link></Button>
        </div>
      </header>

      <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
        <div className="grid md:grid-cols-2 gap-8">
          {/* My Tasks Section */}
          <Card className="bg-white/[0.03] border-white/10">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" /> Мои задачи в работе ({myTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px]">DOMAIN</TableHead>
                    <TableHead className="text-[10px]">ASSIGNED AT</TableHead>
                    <TableHead className="text-right text-[10px]">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTasks.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 text-xs">У вас пока нет активных задач</TableCell></TableRow>
                  ) : myTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-xs font-medium">{task.url.replace(/^https?:\/\//, '')}</TableCell>
                      <TableCell className="text-[10px] text-slate-500">
                        {task.assignedAt?.toDate ? task.assignedAt.toDate().toLocaleString() : 'Just now'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" asChild>
                          <a href={`/api/admin/report-pdf?domain=${task.url}`} target="_blank">Report</a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Available Tasks Section */}
          <Card className="bg-white/[0.03] border-white/10">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" /> Доступные сайты для обработки ({availableTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5">
                  <TableRow className="border-white/5">
                    <TableHead className="text-[10px]">DOMAIN</TableHead>
                    <TableHead className="text-[10px]">STATUS</TableHead>
                    <TableHead className="text-right text-[10px]">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableTasks.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500 text-xs">Нет свободных задач</TableCell></TableRow>
                  ) : availableTasks.map((task) => (
                    <TableRow key={task.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="text-xs font-medium">{task.url.replace(/^https?:\/\//, '')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[8px] border-emerald-500/20 text-emerald-400">READY</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleTakeTask(task.id)}
                          disabled={processingId === task.id}
                          className="h-7 text-[10px] bg-primary hover:bg-primary/90"
                        >
                          {processingId === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Взять в работу"}
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
