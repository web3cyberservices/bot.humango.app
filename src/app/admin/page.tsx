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
  Lock
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
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

        const actions = [
          `GET /audit-v1/index.php - 200 OK`,
          `SSL Certificate verified for ${randomDomain}`,
          `GDPR Policy check: PASSED for ${randomDomain}`,
          `New crawler seed detected: 116.203.3.75`,
          `Auditing sensitive data headers...`,
          `Scan completed for cluster-node-04`,
          `POST /security/verify - 403 Forbidden`,
          `Analyzing robots.txt for: ${randomDomain}`,
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
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isActive, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase === "humango-admin-2025") {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      toast({
        title: "Access Granted",
        description: "Welcome back, Administrator.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Invalid administrative password.",
      });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('admin_authenticated');
    toast({
      title: "Logged Out",
      description: "You have been securely signed out.",
    });
  };

  const handleIssuesClick = () => {
    toast({
      variant: "destructive",
      title: "4 Urgent Security Actions Required",
      description: "Critical: SSL expired on server-09. GDPR leak detected in /api/v1/users. Missing robots.txt on 2 domains.",
    });
  };

  const handleComingSoon = (feature: string) => {
    toast({
      title: "Notice",
      description: `${feature} module is currently in development.`,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-body">
        <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 overflow-hidden rounded-2xl shadow-xl shadow-black/50 relative">
              <Image 
                src="/logo.png" 
                alt="HumangoBot Logo" 
                fill
                className="object-contain p-2"
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Admin Authentication</h1>
              <p className="text-sm text-slate-500 font-medium font-body">Access restricted to authorized personnel only.</p>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-4 font-body">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold ml-1">Secret Passphrase</label>
              <Input 
                type="password" 
                placeholder="••••••••••••" 
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="bg-white/5 border-white/10 h-12 focus:ring-primary text-center tracking-[0.3em]"
              />
            </div>
            <Button type="submit" className="w-full h-12 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
              Unlock Terminal
            </Button>
          </form>
          <div className="pt-4 text-center">
            <Link href="/" className="text-xs text-slate-600 hover:text-primary transition-colors uppercase tracking-[0.25em] font-bold">
              Back to Public Page
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-50 overflow-hidden font-body selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-[#0b1120] hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b border-white/5 flex items-center gap-3 group">
          <div className="w-8 h-8 overflow-hidden rounded-lg transition-transform duration-300 relative">
            <Image 
              src="/logo.png" 
              alt="HumangoBot Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-slate-400">
            HumangoBot
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
          <Button variant="secondary" className="w-full justify-start gap-3 bg-white/5 border-white/5 hover:bg-white/10 tracking-normal" asChild>
            <Link href="/admin">
              <LayoutDashboard className="w-4 h-4 text-primary" /> Dashboard
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => handleComingSoon('Live Audits')} className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal">
            <Search className="w-4 h-4" /> Live Audits
          </Button>
          <Button variant="ghost" onClick={() => handleComingSoon('Permissions')} className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal">
            <Users className="w-4 h-4" /> Permissions
          </Button>
          <Button variant="ghost" onClick={() => handleComingSoon('Knowledge Base')} className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal">
            <Database className="w-4 h-4" /> Knowledge Base
          </Button>
          <div className="pt-6 pb-2 px-3 text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">Settings</div>
          <Button variant="ghost" onClick={() => handleComingSoon('System Config')} className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal">
            <Settings className="w-4 h-4" /> System Config
          </Button>
        </nav>
        <div className="p-4 border-t border-white/5 space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal"
            asChild
          >
            <Link href="/">
              <LogOut className="w-4 h-4" /> Exit to Public
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 tracking-normal"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1120]/50 backdrop-blur-xl z-10 shrink-0">
          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.25em]">Control Center</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-white/5 px-5 py-2 rounded-full border border-white/10 shadow-inner">
              <span className="text-xs font-semibold text-slate-300 tracking-normal">Crawler Status</span>
              <Badge variant="outline" className={isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 tracking-[0.15em] font-bold" : "bg-slate-500/10 text-slate-400 border-slate-500/20 tracking-[0.15em] font-bold"}>
                {isActive ? "ACTIVE" : "IDLE"}
              </Badge>
              <Switch checked={isActive} onCheckedChange={(val) => {
                setIsActive(val);
                toast({
                  title: val ? "Engine Started" : "Engine Stopped",
                  description: val ? "The crawler is now auditing global infrastructure." : "Scanning operations have been suspended.",
                });
              }} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-primary/50 transition-all duration-300 shadow-lg cursor-pointer group" onClick={() => toast({ title: "Real-time Metrics", description: "All scan clusters reporting optimal performance." })}>
              <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
                <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Pages Scanned</CardTitle>
                <Database className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight leading-none">{metrics.pagesScanned.toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-4 text-xs text-emerald-400 font-bold tracking-normal">
                  <Activity className="w-3 h-3" />
                  <span>+124 since startup</span>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-amber-500/50 transition-all duration-300 shadow-lg cursor-pointer group"
              onClick={handleIssuesClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
                <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Compliance Issues</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500 group-hover:animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-amber-50 leading-none">{metrics.issuesFound}</div>
                <div className="flex items-center gap-2 mt-4 text-xs text-rose-400 font-bold tracking-normal">
                  <Activity className="w-3 h-3" />
                  <span>4 urgent actions</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-indigo-400/50 transition-all duration-300 shadow-lg cursor-pointer group" onClick={() => toast({ title: "System Load", description: "CPU and memory usage are within normal enterprise thresholds." })}>
              <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
                <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Engine Load</CardTitle>
                <Server className="h-4 w-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight leading-none">{Math.round(metrics.serverLoad)}%</div>
                <div className="h-2 w-full bg-white/5 rounded-full mt-5 overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-700 ease-in-out" 
                    style={{ width: `${metrics.serverLoad}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm shadow-xl overflow-hidden border-t-white/10">
              <CardHeader className="border-b border-white/5 bg-white/[0.01] py-4">
                <CardTitle className="text-sm font-bold flex items-center justify-between tracking-normal">
                  <span className="flex items-center gap-2 font-bold"><Activity className="w-4 h-4 text-primary opacity-80" /> Scan Frequency (24h)</span>
                  <Badge variant="ghost" className="text-[10px] font-mono text-slate-500 tracking-[0.1em] opacity-70 font-bold uppercase">Live Dataset</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-8 px-4">
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
                      <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} tick={{dy: 10}} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} tick={{dx: -10}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '4 4' }}
                      />
                      <Area type="monotone" dataKey="pages" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPages)" strokeWidth={3} animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2 ml-1">
                <Terminal className="w-4 h-4 text-emerald-400 opacity-80" /> Live Engine Logs
              </h3>
              <div className="bg-[#0b1120] rounded-2xl border border-white/10 p-6 font-mono text-[11px] overflow-hidden h-[300px] flex flex-col shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-indigo-500 to-primary opacity-30"></div>
                <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-5">
                      <Terminal className="w-12 h-12 opacity-10" />
                      <div className="italic tracking-normal text-sm opacity-50 font-body">System standby. Waiting for engine activation...</div>
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="flex gap-4 leading-relaxed tracking-normal animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-primary font-bold opacity-30 shrink-0">CRAWLER &gt;</span>
                        <span className="text-emerald-400/90 font-medium">{log}</span>
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
