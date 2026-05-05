
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
  ShieldAlert
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

interface DetectedIssue {
  id: string;
  domain: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  timestamp: string;
}

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [detectedIssues, setDetectedIssues] = useState<DetectedIssue[]>([
    { id: '1', domain: 'outdated-shop.com', type: 'SSL TLS 1.0 Detected', severity: 'critical', timestamp: '10:24:15' },
    { id: '2', domain: 'data-leak-test.io', type: 'PII in GET Parameters', severity: 'high', timestamp: '11:05:42' },
    { id: '3', domain: 'unsecured-api.net', type: 'Missing CORS Headers', severity: 'medium', timestamp: '11:15:03' },
    { id: '4', domain: 'crypto-node.org', type: 'Self-Signed Certificate', severity: 'critical', timestamp: '12:01:22' },
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
        const domains = ['google.com', 'cloudflare.com', 'humango.app', 'github.com', 'aws.amazon.com', 'test-malware.com', 'leaked-data.net'];
        const randomDomain = domains[Math.floor(Math.random() * domains.length)];
        
        startCrawlAction(`https://${randomDomain}`);

        const isIssue = Math.random() > 0.85;
        let logMessage = `GET /audit-v1/index.php - 200 OK (${randomDomain})`;

        if (isIssue) {
          const issueTypes = ['GDPR Leak', 'SSL Expired', 'Invalid Header', 'PII Exposure'];
          const type = issueTypes[Math.floor(Math.random() * issueTypes.length)];
          logMessage = `ALERT: ${type} detected on ${randomDomain}`;
          
          const newIssue: DetectedIssue = {
            id: Math.random().toString(36).substr(2, 9),
            domain: randomDomain,
            type: type,
            severity: Math.random() > 0.5 ? 'critical' : 'high',
            timestamp: timestamp
          };
          
          setDetectedIssues(prev => [newIssue, ...prev.slice(0, 49)]);
          setMetrics(m => ({ ...m, issuesFound: m.issuesFound + 1 }));
        }

        setLogs(prev => [...prev.slice(-18), `[${timestamp}] ${logMessage}`]);
        
        setMetrics(m => ({
          ...m,
          pagesScanned: m.pagesScanned + Math.floor(Math.random() * 5),
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-body">
        <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <Image 
              src="/logo.png" 
              alt="HumangoBot Logo" 
              width={64}
              height={64}
              priority
            />
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
        <div className="p-6 border-b border-white/5 border-t-white/10 flex items-center gap-3 group">
          <Image src="/logo.png" alt="HumangoBot Logo" width={32} height={32} />
          <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            HumangoBot
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-hide">
          <Button variant="secondary" className="w-full justify-start gap-3 bg-white/5 border-white/5 hover:bg-white/10 tracking-normal" asChild>
            <Link href="/admin">
              <LayoutDashboard className="w-4 h-4 text-primary" /> Dashboard
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setShowIssuesDialog(true)}
            className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal"
          >
            <Search className="w-4 h-4" /> Live Audits
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal opacity-50 cursor-not-allowed">
            <Users className="w-4 h-4" /> Permissions
          </Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal opacity-50 cursor-not-allowed">
            <Database className="w-4 h-4" /> Knowledge Base
          </Button>
          <div className="pt-8 pb-3 px-3 text-[10px] uppercase tracking-[0.25em] text-slate-500 font-bold">Settings</div>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal opacity-50 cursor-not-allowed">
            <Settings className="w-4 h-4" /> System Config
          </Button>
        </nav>
        <div className="p-4 border-t border-white/5 space-y-2">
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 tracking-normal" asChild>
            <Link href="/">
              <LogOut className="w-4 h-4" /> Exit to Public
            </Link>
          </Button>
          <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 tracking-normal">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b1120]/50 backdrop-blur-xl z-10 shrink-0">
          <div className="flex items-center gap-3 md:hidden">
            <Image src="/logo.png" alt="Logo" width={32} height={32} />
            <span className="font-bold text-sm tracking-tight">HumangoBot</span>
          </div>
          <div className="hidden md:block">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-[0.25em]">Control Center</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-white/5 px-5 py-2 rounded-full border border-white/10">
              <span className="text-xs font-semibold text-slate-300">Crawler Engine</span>
              <Badge variant="outline" className={isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}>
                {isActive ? "ACTIVE" : "IDLE"}
              </Badge>
              <Switch checked={isActive} onCheckedChange={setIsActive} className="data-[state=checked]:bg-emerald-500" />
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Pages Scanned</CardTitle>
                <Database className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{metrics.pagesScanned.toLocaleString()}</div>
                <div className="flex items-center gap-2 mt-5 text-xs text-emerald-400 font-bold">
                  <Activity className="w-3 h-3" />
                  <span>Real-time Sync Active</span>
                </div>
              </CardContent>
            </Card>
            
            <Dialog open={showIssuesDialog} onOpenChange={setShowIssuesDialog}>
              <DialogTrigger asChild>
                <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm hover:border-amber-500/50 transition-all cursor-pointer group">
                  <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                    <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Compliance Issues</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight text-amber-50">{metrics.issuesFound}</div>
                    <div className="flex items-center gap-2 mt-5 text-xs text-rose-400 font-bold">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Click to view detailed report</span>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent className="bg-[#0b1120] border-white/10 text-slate-50 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" /> Compliance Audit Results
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Showing latest detected vulnerabilities and policy violations.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
                  {detectedIssues.map((issue) => (
                    <div key={issue.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between hover:bg-white/10 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{issue.domain}</span>
                          <Badge variant="outline" className={
                            issue.severity === 'critical' ? "bg-rose-500/10 text-rose-400 border-rose-500/20 text-[9px]" :
                            issue.severity === 'high' ? "bg-amber-500/10 text-amber-400 border-amber-500/20 text-[9px]" :
                            "bg-blue-500/10 text-blue-400 border-blue-500/20 text-[9px]"
                          }>
                            {issue.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">{issue.type}</p>
                      </div>
                      <div className="text-right flex flex-col items-end gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">{issue.timestamp}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary-foreground hover:bg-primary">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
                <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Engine Load</CardTitle>
                <Server className="h-4 w-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{Math.round(metrics.serverLoad)}%</div>
                <div className="h-2 w-full bg-white/5 rounded-full mt-6 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-700" 
                    style={{ width: `${metrics.serverLoad}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-sm shadow-xl">
              <CardHeader className="border-b border-white/5 py-5">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Scan Frequency (24h)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-10">
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
                      <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="pages" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPages)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-8">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em] flex items-center gap-2 ml-1">
                <Terminal className="w-4 h-4 text-emerald-400" /> Live Engine Logs
              </h3>
              <div className="bg-[#0b1120] rounded-2xl border border-white/10 p-7 font-mono text-[11px] h-[300px] flex flex-col shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-indigo-500 to-primary opacity-30"></div>
                <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
                  {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-6 text-center">
                      <Terminal className="w-12 h-12 opacity-10" />
                      <div className="italic text-sm opacity-50">System standby. Waiting for engine activation...</div>
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
                        <span className="text-primary font-bold opacity-30 shrink-0">CRAWLER &gt;</span>
                        <span className={log.includes('ALERT') ? "text-amber-400 font-bold" : "text-emerald-400/90"}>{log}</span>
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
