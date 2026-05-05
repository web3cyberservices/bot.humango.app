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
  Terminal, 
  Search,
  AlertTriangle,
  Info,
  ShieldCheck,
  Zap,
  Globe,
  Download,
  ExternalLink
} from "lucide-react";

interface DetectedIssue {
  id: string | number;
  domain: string;
  issue_type: string;
  severity: string;
  created_at: string;
  description: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<DetectedIssue[]>([]);
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  const [metrics, setMetrics] = useState({
    pagesScanned: 0,
    issuesFound: 0,
    serverLoad: 12,
  });

  // Проверка авторизации при загрузке
  useEffect(() => {
    const isAuth = document.cookie.includes('admin_authenticated=true');
    setIsAuthenticated(isAuth);
  }, []);

  const fetchData = useCallback(async () => {
    // Если куки нет, не пытаемся запрашивать данные, чтобы не спамить 401
    if (!document.cookie.includes('admin_authenticated=true')) {
      return;
    }

    try {
      const statusRes = await fetch('/api/admin/control');
      
      if (statusRes.status === 401) {
        // Если сервер ответил 401, значит кука невалидна
        setIsAuthenticated(false);
        document.cookie = "admin_authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        return;
      }

      if (!statusRes.ok) return;

      const statusData = await statusRes.json();
      setIsActive(statusData.isActive);

      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setMetrics(prev => ({
          ...prev,
          pagesScanned: statsData.pagesScanned,
          issuesFound: statsData.issuesFound
        }));
        setDetectedIssues(statsData.recentIssues);
      }
      
      setIsLoading(false);
    } catch (error) {
      // Молча игнорируем ошибки сети при фоновом обновлении
    }
  }, []);

  // Управление циклом опроса
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
          description: "Изменения сохранены в базе данных." 
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Ошибка API", description: "Не удалось изменить статус бота." });
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const res = await fetch('/api/admin/violations');
      const data = await res.json();
      if (!data.success) throw new Error('Failed to fetch data');

      const headers = ['ID', 'Domain', 'Issue Type', 'Severity', 'Created At', 'Description'];
      const rows = data.violations.map((v: DetectedIssue) => [
        v.id,
        v.domain,
        v.issue_type,
        v.severity,
        new Date(v.created_at).toLocaleString(),
        `"${v.description.replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `humangobot_audit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Отчет сформирован", description: "CSV файл успешно скачан." });
    } catch (error) {
      toast({ variant: "destructive", title: "Ошибка экспорта", description: "Не удалось сформировать CSV." });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase === "humango-admin-2025") {
      // Используем Lax вместо Strict для лучшей совместимости в превью
      document.cookie = "admin_authenticated=true; path=/; max-age=3600; SameSite=Lax";
      setIsAuthenticated(true);
      toast({ title: "Доступ разрешен", description: "Добро пожаловать в терминал управления." });
    } else {
      toast({ variant: "destructive", title: "Доступ запрещен", description: "Неверный пароль." });
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Терминал Комплаенса</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Админ-пароль" 
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="bg-white/5 border-white/10 h-12 text-center text-white"
            />
            <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold">Разблокировать систему</Button>
          </form>
          <div className="text-center">
            <Link href="/" className="text-xs text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-bold">Вернуться на портал</Link>
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
            <Search className="w-4 h-4" /> Аудит политик
          </Button>
          <Button variant="ghost" onClick={handleDownloadCSV} className="w-full justify-start gap-3 text-slate-400 hover:text-white">
            <Download className="w-4 h-4" /> Экспорт (CSV)
          </Button>
        </nav>
        <div className="p-4 border-t border-white/5">
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 text-rose-400 hover:bg-rose-500/10">
            <LogOut className="w-4 h-4" /> Завершить сессию
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1120]/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Compliance Engine v1.2</Badge>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <Globe className={`w-3 h-3 ${isActive ? 'animate-pulse text-emerald-500' : ''}`} /> {isActive ? 'SCANNING ACTIVE' : 'SYSTEM PAUSED'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Switch</span>
              <Switch 
                checked={isActive} 
                onCheckedChange={handleToggleBot} 
                className="data-[state=checked]:bg-emerald-500" 
              />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Просканировано БД</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{metrics.pagesScanned.toLocaleString()}</div>
                <p className="text-[10px] text-emerald-400 mt-2 font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Статистика PostgreSQL</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/[0.03] border-white/10 border-amber-500/20">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Нарушения в БД</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-500">{metrics.issuesFound}</div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold flex items-center gap-1"><Info className="w-3 h-3" /> Выявленные инциденты</p>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Статус системы</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isActive ? 'ONLINE' : 'PAUSED'}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> Live Control Active</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between bg-white/[0.02] border-b border-white/5 py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Последние нарушения
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase tracking-widest" onClick={() => setShowIssuesDialog(true)}>
                Показать все
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-white/5 hover:bg-transparent">
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Домен</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Тип</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Важность</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold text-slate-500">Дата</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold text-slate-500">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedIssues.slice(0, 8).map((issue) => (
                    <TableRow key={issue.id} className="border-white/5 hover:bg-white/[0.02]">
                      <TableCell className="font-medium text-xs py-3">{issue.domain}</TableCell>
                      <TableCell className="text-xs text-slate-400">{issue.issue_type}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-bold ${issue.severity === 'critical' ? 'border-rose-500/50 text-rose-500 bg-rose-500/5' : 'border-amber-500/50 text-amber-500 bg-amber-500/5'}`}>
                          {issue.severity.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-slate-500">
                        {new Date(issue.created_at).toLocaleTimeString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-white">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50">
                            <DialogHeader>
                              <DialogTitle className="text-white">Детали инцидента: {issue.domain}</DialogTitle>
                              <DialogDescription className="text-slate-400">Технический лог нарушения комплаенса.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Тип нарушения</div>
                                  <div className="text-sm font-medium">{issue.issue_type}</div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                                  <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Уровень угрозы</div>
                                  <Badge className={issue.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}>{issue.severity.toUpperCase()}</Badge>
                                </div>
                              </div>
                              <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                                <div className="text-[10px] text-primary font-bold uppercase mb-2">Описание проблемы</div>
                                <p className="text-xs text-slate-300 leading-relaxed">{issue.description}</p>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detectedIssues.length === 0 && (
                <div className="py-12 text-center text-slate-600 italic text-sm">В базе данных PostgreSQL пока нет записей о нарушениях.</div>
              )}
            </CardContent>
          </Card>

          <div className="bg-[#0b1120] rounded-2xl border border-white/10 p-6 font-mono text-[11px] h-[300px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audit Terminal (Live Console)</span>
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide text-slate-400">
              {isLoading ? (
                <div className="h-full flex items-center justify-center italic">Установка соединения с PostgreSQL...</div>
              ) : (
                <>
                  <div>[SYSTEM] PostgreSQL node connection: OK</div>
                  <div>[SYSTEM] Crawler Engine Status: {isActive ? 'ACTIVE' : 'STANDBY'}</div>
                  <div>[AUDIT] Pages analyzed: {metrics.pagesScanned}</div>
                  <div>[AUDIT] Vulnerabilities stored: {metrics.issuesFound}</div>
                  {detectedIssues.slice(0, 5).map((issue, i) => (
                    <div key={i} className="text-amber-400/80">
                      [ALERT] New {issue.issue_type} logged for {issue.domain}
                    </div>
                  ))}
                  <div>[SYSTEM] Ready for next batch. Waiting for worker heartbeat...</div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white"><AlertTriangle className="text-amber-500" /> Полный список нарушений</DialogTitle>
              <DialogDescription className="text-slate-400">Данные синхронизированы с PostgreSQL кластером.</DialogDescription>
            </div>
            <Button onClick={handleDownloadCSV} variant="outline" className="h-9 gap-2">
              <Download className="w-4 h-4" /> CSV Экспорт
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
             <Accordion type="single" collapsible className="w-full space-y-2">
                {detectedIssues.map((issue) => (
                  <AccordionItem key={issue.id} value={String(issue.id)} className="border border-white/5 bg-white/[0.02] rounded-xl overflow-hidden px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex flex-1 items-center justify-between text-left pr-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm text-slate-100">{issue.domain}</span>
                            <Badge className={issue.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}>{issue.severity.toUpperCase()}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 font-medium">{issue.issue_type}</p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                          {new Date(issue.created_at).toLocaleString()}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 pt-2">
                      <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                        <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Описание инцидента
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{issue.description}</p>
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
