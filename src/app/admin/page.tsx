
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  AlertTriangle,
  ShieldCheck,
  Zap,
  Download,
  Bug,
  Activity,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Scale,
  Camera,
  Layers,
  Info
} from "lucide-react";

interface DetectedIssue {
  id: string | number;
  domain: string;
  type: string;
  level: string;
  date: string;
  summary: string;
  description: string;
  fine_amount?: string;
  law_name?: string;
  url?: string;
  evidence_html?: string;
  report_type: 'SaaS' | 'Manual';
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
  const [recentIssues, setRecentIssues] = useState<DetectedIssue[]>([]);
  const [allViolations, setAllViolations] = useState<DetectedIssue[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [showIssuesDialog, setShowIssuesDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const { toast } = useToast();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  
  const [metrics, setMetrics] = useState({
    pagesScanned: 0,
    issuesFound: 0,
  });

  useEffect(() => {
    const isAuth = document.cookie.includes('admin_authenticated=true');
    setIsAuthenticated(isAuth);
  }, []);

  const fetchData = useCallback(async () => {
    if (!document.cookie.includes('admin_authenticated=true')) return;
    setIsRefreshing(true);
    try {
      const timestamp = Date.now();
      const [statusRes, statsRes, logsRes] = await Promise.all([
        fetch(`/api/admin/control?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/admin/stats?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/admin/system-logs?t=${timestamp}`, { cache: 'no-store' })
      ]);
      if (statusRes.ok) setIsActive((await statusRes.json()).isActive);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setMetrics({ pagesScanned: statsData.pagesScanned || 0, issuesFound: statsData.issuesFound || 0 });
        setRecentIssues(statsData.recentIssues || []);
        setLastSync(new Date().toLocaleTimeString());
      }
      if (logsRes.ok) setSystemLogs((await logsRes.json()).logs || []);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated === true) {
      fetchData();
      pollingRef.current = setInterval(fetchData, 4000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isAuthenticated, fetchData]);

  const fetchFullHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/violations?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setAllViolations((await res.json()).violations || []);
    } finally {
      setIsHistoryLoading(false);
      setShowIssuesDialog(true);
    }
  };

  const handleToggleBot = async (checked: boolean) => {
    const res = await fetch('/api/admin/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: checked }),
    });
    if (res.ok) {
      setIsActive(checked);
      toast({ title: checked ? "Scanning active" : "Scanning paused" });
    }
  };

  const groupedViolations = useMemo(() => {
    const groups: Record<string, DetectedIssue[]> = {};
    allViolations.forEach(issue => {
      if (!groups[issue.domain]) groups[issue.domain] = [];
      groups[issue.domain].push(issue);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [allViolations]);

  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-white/[0.03] border-white/10 p-8 space-y-8 text-slate-50">
          <div className="flex flex-col items-center text-center space-y-4">
            <Image src="/logo.png" alt="Logo" width={64} height={64} priority />
            <h1 className="text-2xl font-bold">Terminal Access</h1>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (passphrase === "humango-admin-2025") { document.cookie = "admin_authenticated=true; path=/; max-age=3600"; setIsAuthenticated(true); } }} className="space-y-4">
            <Input type="password" placeholder="Passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} className="bg-white/5 text-center" />
            <Button type="submit" className="w-full">Unlock</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-50 overflow-hidden">
      <aside className="w-64 border-r border-white/5 bg-[#0b1120] hidden md:flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={32} height={32} />
          <span className="font-bold text-lg">HumangoBot</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start gap-3 bg-primary/10 text-primary"><LayoutDashboard className="w-4 h-4" /> Dashboard</Button>
          <Button variant="ghost" onClick={fetchFullHistory} className="w-full justify-start gap-3 text-slate-400"><AlertTriangle className="w-4 h-4" /> All Violations</Button>
        </nav>
        <div className="p-4 border-t border-white/5">
          <Button onClick={() => { setIsAuthenticated(false); document.cookie = "admin_authenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"; }} variant="ghost" className="w-full justify-start gap-3 text-rose-400"><LogOut className="w-4 h-4" /> Logout</Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1120]/50 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-primary border-primary/20">Dual-Report Engine v2.7</Badge>
            <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
              <Zap className={`w-3 h-3 ${isActive ? 'animate-pulse text-emerald-500' : ''}`} /> {isActive ? 'SCANNING' : 'IDLE'}
              {lastSync && <span className="ml-2">Sync: {lastSync}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Master Power</span>
            <Switch checked={isActive} onCheckedChange={handleToggleBot} className="data-[state=checked]:bg-emerald-500" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase">Pages Scanned</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold tabular-nums">{metrics.pagesScanned}</div></CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/10 border-amber-500/20">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase">Violations</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-amber-500 tabular-nums">{metrics.issuesFound}</div></CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-[10px] text-slate-500 uppercase">System Status</CardTitle></CardHeader>
              <CardContent><div className={`text-3xl font-bold ${isActive ? 'text-emerald-500' : 'text-rose-500'}`}>{isActive ? 'ACTIVE' : 'PAUSED'}</div></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <Card className="bg-white/[0.03] border-white/10">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Recent Incidents</CardTitle>
                <Button size="sm" variant="ghost" className="h-8 text-[10px]" onClick={fetchFullHistory}>History</Button>
              </CardHeader>
              <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-[#0b1120] sticky top-0 z-10">
                    <TableRow className="border-white/5">
                      <TableHead className="text-[9px]">DOMAIN</TableHead>
                      <TableHead className="text-[9px]">MODULE</TableHead>
                      <TableHead className="text-[9px]">SEVERITY</TableHead>
                      <TableHead className="text-right text-[9px]">TIME</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentIssues.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500 text-xs">No data</TableCell></TableRow> : recentIssues.map((issue) => (
                      <TableRow key={issue.id} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                        <TableCell className="text-xs font-medium">{issue.domain}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[8px] ${issue.report_type === 'SaaS' ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-purple-500 text-purple-500 bg-purple-500/5'}`}>
                            {issue.report_type} Module
                          </Badge>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={`text-[8px] ${issue.level === 'critical' ? 'text-rose-500' : 'text-amber-500'}`}>{issue.level}</Badge></TableCell>
                        <TableCell className="text-right text-[9px] font-mono text-slate-500">{new Date(issue.date).toLocaleTimeString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="bg-[#0b1120] rounded-xl border border-white/10 p-6 font-mono text-[11px] h-[510px] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3"><TerminalIcon className="w-4 h-4 text-primary" /><span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Logs</span></div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 text-slate-400">
                {systemLogs.map((log) => (
                  <div key={log.id} className="flex gap-3 leading-relaxed">
                    <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className={`font-bold ${log.type === 'ERROR' ? 'text-rose-500' : 'text-emerald-500'}`}>{log.type}:</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
        <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="p-6 border-b border-white/5">
            <DialogTitle className="flex items-center gap-2"><Layers className="text-primary" /> Violation History (SaaS & Manual Modules)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
             <Accordion type="single" collapsible className="w-full space-y-3">
                {groupedViolations.map(([domain, issues]) => (
                  <AccordionItem key={domain} value={domain} className="border border-white/5 bg-white/[0.02] rounded-xl px-4">
                    <AccordionTrigger className="hover:no-underline py-5">
                      <div className="flex flex-1 items-center justify-between text-left pr-6">
                        <div className="flex items-center gap-4">
                          <Globe className="w-5 h-5 text-primary" />
                          <div>
                            <span className="font-bold text-base">{domain}</span>
                            <div className="flex gap-2 mt-0.5">
                              <Badge className="bg-blue-500/10 text-blue-400 text-[8px]">{issues.filter(i => i.report_type === 'SaaS').length} SaaS</Badge>
                              <Badge className="bg-purple-500/10 text-purple-400 text-[8px]">{issues.filter(i => i.report_type === 'Manual').length} Manual</Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-6 border-t border-white/5 pt-4">
                      <div className="space-y-6">
                        {issues.map((issue) => (
                          <div key={issue.id} className="relative pl-6 border-l-2 border-primary/20 py-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-[8px]">{issue.report_type}</Badge>
                                <span className="text-xs font-bold text-white uppercase">{issue.type}</span>
                                <Badge className={issue.level === 'critical' ? 'bg-rose-500' : 'bg-amber-500'} text-xs>{issue.level}</Badge>
                              </div>
                              <span className="text-xs text-rose-400 font-bold">{issue.fine_amount}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-3 bg-white/5 rounded-lg space-y-3">
                                <div>
                                  <p className="text-[9px] text-primary font-bold mb-1 uppercase tracking-widest"><Info className="w-3 h-3 inline mr-1" /> Summary:</p>
                                  <p className="text-xs text-slate-300">{issue.summary}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-emerald-500 font-bold mb-1 uppercase tracking-widest"><Scale className="w-3 h-3 inline mr-1" /> Legal Explanation:</p>
                                  <p className="text-xs text-slate-400 italic">"{issue.description}"</p>
                                  <p className="text-[9px] text-slate-500 mt-2 font-mono">Source: {issue.law_name}</p>
                                </div>
                              </div>
                              <div className="p-3 bg-black/40 rounded-lg font-mono">
                                <p className="text-[9px] text-slate-500 mb-1 uppercase">Target URL:</p>
                                <a href={issue.url} target="_blank" className="text-[10px] text-emerald-400 hover:underline break-all">{issue.url}</a>
                                {issue.evidence_html && issue.evidence_html.startsWith('data:') && (
                                  <div className="mt-3">
                                    <p className="text-[9px] text-slate-500 mb-2 uppercase">Screenshot Evidence:</p>
                                    <img src={issue.evidence_html} className="rounded border border-white/10 w-full opacity-80 hover:opacity-100 transition-opacity cursor-zoom-in" alt="evidence" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
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
