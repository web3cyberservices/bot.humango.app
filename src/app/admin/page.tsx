
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  LayoutDashboard, 
  LogOut, 
  Terminal as TerminalIcon, 
  Search,
  AlertTriangle,
  Info,
  ShieldCheck,
  Zap,
  Globe,
  Download,
  ExternalLink,
  Bug
} from "lucide-react";

interface DetectedIssue {
  id: string | number;
  domain: string;
  type: string;
  level: string;
  date: string;
  description: string;
}

interface SystemLog {
  id: number;
  type: 'START' | 'STOP' | 'ERROR' | 'SUCCESS';
  message: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<DetectedIssue[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  const [metrics, setMetrics] = useState({
    pagesScanned: 0,
    issuesFound: 0,
  });

  useEffect(() => {
    const isAuth = document.cookie.includes('admin_authenticated=true');
    setIsAuthenticated(isAuth);
  }, []);

  const fetchData = useCallback(async () => {
    if (!document.cookie.includes('admin_authenticated=true')) {
      return;
    }

    try {
      const statusRes = await fetch('/api/admin/control');
      if (statusRes.status === 401) {
        setIsAuthenticated(false);
        document.cookie = "admin_authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        return;
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIsActive(statusData.isActive);
      }

      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setMetrics({
          pagesScanned: statsData.pagesScanned,
          issuesFound: statsData.issuesFound
        });
        setDetectedIssues(statsData.recentIssues);
      }

      const logsRes = await fetch('/api/admin/system-logs');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setSystemLogs(logsData.logs);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[Admin] Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated === true) {
      fetchData();
      pollingRef.current = setInterval(fetchData, 5000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isAuthenticated, fetchData]);

  const handleToggleBot = async (checked: boolean) => {
    try {
      const res = await fetch('/api/admin/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      const data = await res.json();
      if (data.success) {
        setIsActive(checked);
        toast({ 
          title: checked ? "Сканирование запущено" : "Сканирование приостановлено", 
          description: "Статус обновлен в базе данных." 
        });
        fetchData();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось изменить статус." });
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const res = await fetch('/api/admin/violations');
      const data = await res.json();
      if (!data.success) throw new Error('Failed');

      const headers = ['ID', 'Domain', 'Issue Type', 'Severity', 'Created At', 'Description'];
      const rows = data.violations.map((v: DetectedIssue) => [
        v.id,
        v.domain,
        v.type,
        v.level,
        new Date(v.date).toLocaleString(),
        `"${v.description.replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Успешно", description: "CSV файл скачан." });
    } catch (error) {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось создать CSV." });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase === "humango-admin-2025") {
      document.cookie = "admin_authenticated=true; path=/; max-age=3600; SameSite=Lax";
      setIsAuthenticated(true);
      toast({ title: "Доступ разрешен" });
    } else {
      toast({ variant: "destructive", title: "Неверный пароль" });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    document.cookie = "admin_authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  if (isAuthenticated === null) return null;

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-body">
        <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <Image src="/logo.png" alt="Logo" width={64} height={64} priority />
            <h1 className="text-2xl font-bold tracking-tight text-white">Вход в Терминал</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Пароль" 
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="bg-white/5 border-white/10 h-12 text-center text-white"
            />
            <Button type="submit" className="w-full h-12 bg-primary font-bold">Разблокировать</Button>
          </form>
          <div className="text-center">
            <Link href="/" className="text-xs text-slate-500 hover:text-white transition-colors">Вернуться на портал</Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-50 overflow-hidden font-body">
      <aside className="w-64 border-r border-white/5 bg-[#0b1120] hidden md:flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={32} height={32} />
          <span className="font-bold text-lg text-white">HumangoBot</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-3 bg-primary/10 text-primary border-primary/20">
            <LayoutDashboard className="w-4 h-4" /> Дашборд
          </Button>
          <Button variant="ghost" onClick={() => setShowIssuesDialog(true)} className="w-full justify-start gap-3 text-slate-400 hover:text-white">
            <AlertTriangle className="w-4 h-4" /> Все нарушения
          </Button>
          <Button variant="ghost" onClick={handleDownloadCSV} className="w-full justify-start gap-3 text-slate-400 hover:text-white">
            <Download className="w-4 h-4" /> CSV Отчет
          </Button>
        </nav>
        <div className="p-4 border-t border-white/5">
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 text-rose-400 hover:bg-rose-500/10">
            <LogOut className="w-4 h-4" /> Выйти
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1120]/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Compliance v1.6</Badge>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <Zap className={`w-3 h-3 ${isActive ? 'animate-pulse text-emerald-500' : ''}`} /> {isActive ? 'SCANNING' : 'IDLE'}
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Power</span>
            <Switch 
              checked={isActive} 
              onCheckedChange={handleToggleBot} 
              className="data-[state=checked]:bg-emerald-500" 
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase font-bold">Просканировано</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.pagesScanned}</div>
                <p className="text-[10px] text-emerald-400 mt-1 font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Live Postgres Audit</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/[0.03] border-white/10 border-amber-500/20">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase font-bold">Нарушения</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{metrics.issuesFound}</div>
                <p className="text-[10px] text-slate-400 mt-1 font-bold flex items-center gap-1"><Bug className="w-3 h-3" /> Всего найдено нарушений</p>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase font-bold">Система</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isActive ? 'ACTIVE' : 'OFF'}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> Crawler Engine</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Последние инциденты (site_violations)
                </CardTitle>
                <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold uppercase" onClick={() => setShowIssuesDialog(true)}>Все</Button>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto scrollbar-hide">
                <Table>
                  <TableHeader className="bg-white/[0.02] sticky top-0 z-10">
                    <TableRow className="border-white/5">
                      <TableHead className="text-[9px] uppercase font-bold">Домен</TableHead>
                      <TableHead className="text-[9px] uppercase font-bold">Тип</TableHead>
                      <TableHead className="text-[9px] uppercase font-bold">Уровень</TableHead>
                      <TableHead className="text-right text-[9px] uppercase font-bold">Дата</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detectedIssues.map((issue) => (
                      <TableRow key={issue.id} className="border-white/5 hover:bg-white/[0.01]">
                        <TableCell className="text-xs font-medium">{issue.domain}</TableCell>
                        <TableCell className="text-xs text-slate-400">{issue.type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[8px] font-bold ${issue.level === 'critical' ? 'border-rose-500/50 text-rose-500' : 'border-amber-500/50 text-amber-500'}`}>
                            {issue.level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-[9px] font-mono text-slate-500">
                          {new Date(issue.date).toLocaleTimeString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="bg-[#0b1120] rounded-xl border border-white/10 p-6 font-mono text-[11px] h-[450px] flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Logs (Live Terminal)</span>
                <TerminalIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide text-slate-400">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center italic">Загрузка логов...</div>
                ) : (
                  systemLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 leading-relaxed">
                      <span className="text-slate-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className={`font-bold shrink-0 ${
                        log.type === 'ERROR' ? 'text-rose-500' : 
                        log.type === 'START' ? 'text-emerald-500' : 
                        log.type === 'STOP' ? 'text-amber-500' : 'text-blue-500'
                      }`}>
                        {log.type}:
                      </span>
                      <span className={log.type === 'ERROR' ? 'text-rose-400/80' : 'text-slate-300'}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
                {systemLogs.length === 0 && !isLoading && <div className="text-slate-600 italic">Событий пока нет...</div>}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="p-6 border-b border-white/5">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="text-amber-500" /> История нарушений комплаенса</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
             <Accordion type="single" collapsible className="w-full space-y-2">
                {detectedIssues.map((issue) => (
                  <AccordionItem key={issue.id} value={String(issue.id)} className="border border-white/5 bg-white/[0.02] rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 items-center justify-between text-left pr-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{issue.domain}</span>
                            <Badge className={issue.level === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}>{issue.level}</Badge>
                          </div>
                          <p className="text-[10px] text-slate-500">{issue.type}</p>
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(issue.date).toLocaleString()}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <div className="p-3 bg-primary/5 rounded border border-primary/10 text-xs text-slate-300 leading-relaxed">
                        {issue.description}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
