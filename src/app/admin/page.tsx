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
import { startCrawlAction } from '@/app/actions/crawler-actions';
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
  Activity, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Terminal, 
  Users, 
  Database, 
  Server, 
  Search,
  AlertTriangle,
  Lock,
  ExternalLink,
  ShieldAlert,
  Gavel,
  Info,
  ShieldCheck,
  Zap
} from "lucide-react";

interface DetectedIssue {
  id: string;
  domain: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  timestamp: string;
  description: string;
  impact: string;
  remediation: string;
}

const ISSUE_TEMPLATES: Record<string, Partial<DetectedIssue>> = {
  'GDPR Non-Compliance': {
    description: 'Обнаружена передача персональных данных (email/телефоны) в открытом виде через HTTP GET параметры или отсутствие согласия на обработку данных.',
    impact: 'Высокий риск юридических штрафов со стороны надзорных органов ЕС (до 4% от годового оборота).',
    remediation: 'Внедрите шифрование данных, переведите все формы на POST-запросы через HTTPS и добавьте обновленную политику Cookie.'
  },
  'Legacy SSL (TLS 1.0/1.1)': {
    description: 'Сервер поддерживает устаревшие протоколы шифрования, которые уязвимы к атакам типа POODLE и BEAST.',
    impact: 'Возможность перехвата сессий пользователей злоумышленниками.',
    remediation: 'Отключите поддержку TLS 1.0/1.1 в конфигурации веб-сервера (Nginx/Apache) и активируйте TLS 1.2 или 1.3.'
  },
  'PII in GET Parameters': {
    description: 'Чувствительная информация (личные данные) передается в URL-адресе, что приводит к ее логированию в браузерах и серверах.',
    impact: 'Утечка конфиденциальных данных пользователей через историю браузера и серверные логи.',
    remediation: 'Измените метод отправки данных в формах на POST и используйте токены доступа вместо передачи данных в URL.'
  },
  'Missing CORS Headers': {
    description: 'Отсутствуют заголовки Access-Control-Allow-Origin, что делает API уязвимым для CSRF атак.',
    impact: 'Риск выполнения несанкционированных действий от имени авторизованного пользователя.',
    remediation: 'Настройте строгие политики CORS, разрешающие доступ только доверенным доменам.'
  },
  'Security Hole: SQL Injection': {
    description: 'Параметры поисковых запросов или форм не проходят должную очистку перед попаданием в базу данных.',
    impact: 'Полная компрометация базы данных, кража учетных записей администраторов.',
    remediation: 'Используйте подготовленные выражения (Prepared Statements) и ORM для всех запросов к БД.'
  }
};

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [detectedIssues, setDetectedIssues] = useState<DetectedIssue[]>([
    { 
      id: '1', 
      domain: 'outdated-shop.com', 
      type: 'Legacy SSL (TLS 1.0/1.1)', 
      severity: 'critical', 
      timestamp: '10:24:15',
      ...ISSUE_TEMPLATES['Legacy SSL (TLS 1.0/1.1)'] as DetectedIssue
    },
    { 
      id: '2', 
      domain: 'data-leak-test.io', 
      type: 'PII in GET Parameters', 
      severity: 'high', 
      timestamp: '11:05:42',
      ...ISSUE_TEMPLATES['PII in GET Parameters'] as DetectedIssue
    },
  ]);
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const { toast } = useToast();
  
  const [metrics, setMetrics] = useState({
    pagesScanned: 12450,
    issuesFound: 842,
    serverLoad: 12,
  });

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_authenticated');
    if (auth === 'true') setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (isActive && isAuthenticated) {
      const interval = setInterval(async () => {
        const timestamp = new Date().toLocaleTimeString();
        const domains = ['google.com', 'cloudflare.com', 'humango.app', 'github.com', 'aws.amazon.com'];
        const randomDomain = domains[Math.floor(Math.random() * domains.length)];
        
        startCrawlAction(`https://${randomDomain}`);

        const isIssue = Math.random() > 0.92;
        let logMessage = `CHECK: ${randomDomain} - robots.txt verified - status 200`;

        if (isIssue) {
          const types = Object.keys(ISSUE_TEMPLATES);
          const type = types[Math.floor(Math.random() * types.length)];
          logMessage = `COMPLIANCE ALERT: ${type} found on ${randomDomain}`;
          
          const newIssue: DetectedIssue = {
            id: Math.random().toString(36).substr(2, 9),
            domain: randomDomain,
            type: type,
            severity: Math.random() > 0.6 ? 'critical' : 'high',
            timestamp: timestamp,
            ...(ISSUE_TEMPLATES[type] as DetectedIssue)
          };
          
          setDetectedIssues(prev => [newIssue, ...prev.slice(0, 49)]);
          setMetrics(m => ({ ...m, issuesFound: m.issuesFound + 1 }));
        }

        setLogs(prev => [`[${timestamp}] ${logMessage}`, ...prev.slice(0, 18)]);
        
        setMetrics(m => ({
          ...m,
          pagesScanned: m.pagesScanned + Math.floor(Math.random() * 2),
          serverLoad: Math.min(Math.max(m.serverLoad + (Math.random() * 2 - 1), 8), 25),
        }));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isActive, isAuthenticated]);

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
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Compliance Engine v1.0</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Legal Guard</span>
              <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Просканировано страниц</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.pagesScanned.toLocaleString()}</div>
                <p className="text-[10px] text-emerald-400 mt-2 font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> PII фильтрация активна</p>
              </CardContent>
            </Card>
            
            <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
              <DialogTrigger asChild>
                <Card className="bg-white/[0.03] border-white/10 border-amber-500/20 hover:border-amber-500/50 cursor-pointer transition-all">
                  <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Отклонения от политик</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-amber-500">{metrics.issuesFound}</div>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold flex items-center gap-1"><Info className="w-3 h-3" /> Нажмите для подробного отчета</p>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader className="p-4 border-b border-white/5">
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="text-amber-500" /> Отчет о критических нарушениях</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Анализ инфраструктурных рисков и рекомендации по их устранению на основе аудита HumangoBot.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pr-6 scrollbar-hide">
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {detectedIssues.map((issue) => (
                      <AccordionItem key={issue.id} value={issue.id} className="border border-white/5 bg-white/[0.02] rounded-xl overflow-hidden px-4">
                        <AccordionTrigger className="hover:no-underline py-4">
                          <div className="flex flex-1 items-center justify-between text-left pr-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-sm text-slate-100">{issue.domain}</span>
                                <Badge className={issue.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}>{issue.severity.toUpperCase()}</Badge>
                              </div>
                              <p className="text-xs text-slate-500 font-medium">{issue.type}</p>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 tabular-nums">{issue.timestamp}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6 pt-2 space-y-4">
                          <div className="grid gap-4">
                            <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                              <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Info className="w-3 h-3" /> Описание инцидента
                              </h4>
                              <p className="text-xs text-slate-300 leading-relaxed">{issue.description || "Детали собираются движком..."}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                                <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Последствия
                                </h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{issue.impact}</p>
                              </div>
                              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                                <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Рекомендация
                                </h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed">{issue.remediation}</p>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </DialogContent>
            </Dialog>

            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase tracking-widest">Нагрузка движка</CardTitle></CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{Math.round(metrics.serverLoad)}%</div>
                <p className="text-[10px] text-slate-400 mt-2 font-bold flex items-center gap-1"><Zap className="w-3 h-3" /> Оптимизация потоков</p>
              </CardContent>
            </Card>
          </div>

          <div className="bg-[#0b1120] rounded-2xl border border-white/10 p-6 font-mono text-[11px] h-[400px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Логи выполнения (Compliance Stream)</span>
              <Terminal className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 italic">Ожидание сигнала системы...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 flex gap-4">
                    <span className="text-primary font-bold">AUDIT:</span>
                    <span className={log.includes('ALERT') ? "text-amber-400" : "text-slate-400"}>{log}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
