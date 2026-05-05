'use client';

import { useState, useEffect } from 'react';
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
  LayoutDashboard, 
  LogOut, 
  Terminal, 
  Search,
  AlertTriangle,
  Lock,
  Gavel,
  Info,
  ShieldCheck,
  Zap,
  Globe
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [detectedIssues, setDetectedIssues] = useState<DetectedIssue[]>([]);
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const [metrics, setMetrics] = useState({
    pagesScanned: 0,
    issuesFound: 0,
    serverLoad: 12,
  });

  // Auth check
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_authenticated');
    if (auth === 'true') setIsAuthenticated(true);
  }, []);

  // Fetch status and stats
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      try {
        // Get bot status
        const statusRes = await fetch('/api/admin/control');
        const statusData = await statusRes.json();
        setIsActive(statusData.isActive);

        // Get metrics and issues
        const statsRes = await fetch('/api/admin/stats');
        const statsData = await statsRes.json();
        setMetrics(prev => ({
          ...prev,
          pagesScanned: statsData.pagesScanned,
          issuesFound: statsData.issuesFound
        }));
        setDetectedIssues(statsData.recentIssues);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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
          description: "Настройка успешно синхронизирована с базой данных." 
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Ошибка API", description: "Не удалось изменить статус бота." });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase === "humango-admin-2025") {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      toast({ title: "Доступ разрешен", description: "Добро пожаловать в терминал управления." });
    } else {
      toast({ variant: "destructive", title: "Доступ запрещен", description: "Неверный пароль." });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-body">
        <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <Image src="/logo.png" alt="Logo" width={64} height={64} priority />
            <h1 className="text-2xl font-bold tracking-tight">Терминал Комплаенса</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Админ-пароль" 
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="bg-white/5 border-white/10 h-12 text-center"
            />
            <Button type="submit" className="w-full h-12 bg-primary">Разблокировать систему</Button>
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
          <span className="font-bold text-lg">HumangoBot</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-3 bg-primary/10 text-primary border-primary/20">
            <LayoutDashboard className="w-4 h-4" /> Дашборд
          </Button>
          <Button variant="ghost" onClick={() => setShowIssuesDialog(true)} className="w-full justify-start gap-3 text-slate-400 hover:text-white">
            <Search className="w-4 h-4" /> Аудит политик
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 opacity-50 cursor-not-allowed">
            <Gavel className="w-4 h-4" /> Юридический контроль
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
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Compliance Engine v1.1</Badge>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <Globe className="w-3 h-3 animate-pulse" /> {isActive ? 'SCANNING ACTIVE' : 'SYSTEM PAUSED'}
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
                <div className="text-3xl font-bold">{metrics.pagesScanned.toLocaleString()}</div>
                <p className="text-[10px] text-emerald-400 mt-2 font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Статистика из Postgres</p>
              </CardContent>
            </Card>
            
            <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
              <DialogTrigger asChild>
                <Card className="bg-white/[0.03] border-white/10 border-amber-500/20 hover:border-amber-500/50 cursor-pointer transition-all">
                  <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Нарушения в БД</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-500">{metrics.issuesFound}</div>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold flex items-center gap-1"><Info className="w-3 h-3" /> Нажмите для отчета</p>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="p-4 border-b border-white/5">
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="text-amber-500" /> Реальные нарушения из PostgreSQL</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Данные, полученные в ходе последнего сканирования инфраструктуры.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-6 scrollbar-hide">
                  {detectedIssues.length === 0 ? (
                    <div className="text-center py-20 text-slate-600">База данных пуста. Запустите воркер для сбора данных.</div>
                  ) : (
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
                                {new Date(issue.created_at).toLocaleTimeString()}
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
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Статус системы</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isActive ? 'ONLINE' : 'PAUSED'}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> Управление через БД</p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-[#0b1120] rounded-2xl border border-white/10 p-6 font-mono text-[11px] h-[450px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audit Terminal (Live Sync)</span>
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide text-slate-400">
              {isLoading ? (
                <div className="h-full flex items-center justify-center italic">Синхронизация с PostgreSQL...</div>
              ) : (
                <>
                  <div>[SYSTEM] Connected to PostgreSQL cluster</div>
                  <div>[SYSTEM] Bot Activity Status: {isActive ? 'RUNNING' : 'STOPPED'}</div>
                  <div>[METRICS] Total scanned domains: {metrics.pagesScanned}</div>
                  <div>[METRICS] Compliance alerts found: {metrics.issuesFound}</div>
                  {detectedIssues.slice(0, 10).map((issue, i) => (
                    <div key={i} className="text-amber-400/80">
                      [ALERT] {issue.issue_type} detected on {issue.domain}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
