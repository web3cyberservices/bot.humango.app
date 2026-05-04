'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Terminal, 
  Users, 
  Database, 
  Server, 
  Shield, 
  LineChart as ChartIcon,
  Search,
  AlertTriangle
} from "lucide-react";
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';

const chartData = [
  { time: '00:00', pages: 400 },
  { time: '04:00', pages: 300 },
  { time: '08:00', pages: 200 },
  { time: '12:00', pages: 600 },
  { time: '16:00', pages: 800 },
  { time: '20:00', pages: 500 },
  { time: '23:59', pages: 700 },
];

export default function AdminDashboard() {
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState({
    pagesScanned: 12450,
    issuesFound: 842,
    serverLoad: 12,
  });

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        const actions = [
          `GET /audit-v1/index.php - 200 OK`,
          `SSL Certificate verified for cloudflare.com`,
          `GDPR Policy check: PASSED`,
          `New crawler seed detected: 116.203.3.75`,
          `Auditing sensitive data headers...`,
          `Scan completed for secure-server-04`,
          `POST /security/verify - 403 Forbidden`,
          `Analyzing robots.txt for domain: google.com`,
          `Indexing metadata for humango.app`,
          `Resource usage: CPU 14%, RAM 2.4GB`,
        ];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        setLogs(prev => [...prev.slice(-18), `[${timestamp}] ${randomAction}`]);
        
        setMetrics(m => ({
          ...m,
          pagesScanned: m.pagesScanned + Math.floor(Math.random() * 5),
          issuesFound: m.issuesFound + (Math.random() > 0.9 ? 1 : 0),
          serverLoad: Math.min(Math.max(m.serverLoad + (Math.random() * 4 - 2), 5), 45),
        }));
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <div className="flex h-screen bg-[#020617] text-slate-50 overflow-hidden font-body">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0b1120] hidden md:flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">bot.humango.app</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Button variant="secondary" className="w-full justify-start gap-3 bg-white/5 border-white/5 hover:bg-white/10">
            <LayoutDashboard className="w-4 h-4 text-primary" /> Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5">
            <Search className="w-4 h-4" /> Live Audits
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5">
            <Users className="w-4 h-4" /> Permissions
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5">
            <Database className="w-4 h-4" /> Knowledge Base
          </Button>
          <div className="pt-4 pb-2 px-3 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Settings</div>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5">
            <Settings className="w-4 h-4" /> System Config
          </Button>
        </nav>
        <div className="p-4 border-t border-white/5">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5">
              <LogOut className="w-4 h-4" /> Exit to Public
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1120]/50 backdrop-blur-xl z-10">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Control Center</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 shadow-inner">
              <span className="text-xs font-medium text-slate-300">Crawler Status</span>
              <Badge variant="outline" className={isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}>
                {isActive ? "ACTIVE" : "IDLE"}
              </Badge>
              <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-primary/50 transition-colors shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pages Scanned</CardTitle>
                <Database className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{metrics.pagesScanned.toLocaleString()}</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-emerald-400 font-medium">
                  <Activity className="w-3 h-3" />
                  <span>+124 since startup</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-amber-500/50 transition-colors shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compliance Issues</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-amber-50">{metrics.issuesFound}</div>
                <div className="flex items-center gap-1 mt-2 text-xs text-rose-400 font-medium">
                  <Activity className="w-3 h-3" />
                  <span>4 urgent actions</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-indigo-400/50 transition-colors shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Engine Load</CardTitle>
                <Server className="h-4 w-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{Math.round(metrics.serverLoad)}%</div>
                <div className="h-1.5 w-full bg-white/5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-700 ease-in-out" 
                    style={{ width: `${metrics.serverLoad}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm shadow-xl overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/[0.01]">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2"><ChartIcon className="w-4 h-4 text-primary" /> Scan Frequency (24h)</span>
                  <Badge variant="ghost" className="text-[10px] font-mono text-slate-500 tracking-tighter">Live Dataset</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 px-4">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.2)" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1 }}
                      />
                      <Area type="monotone" dataKey="pages" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPages)" strokeWidth={3} animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" /> Live Engine Logs
              </h3>
              <div className="bg-[#0b1120] rounded-2xl border border-white/10 p-5 font-mono text-[11px] overflow-hidden h-[300px] flex flex-col shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-indigo-500 to-primary opacity-50"></div>
                <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                      <Terminal className="w-12 h-12 opacity-10" />
                      <div className="italic">System standby. Waiting for engine activation...</div>
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="flex gap-3 leading-relaxed">
                        <span className="text-primary font-bold opacity-30 shrink-0">CRAWLER &gt;</span>
                        <span className="text-emerald-400/90">{log}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
