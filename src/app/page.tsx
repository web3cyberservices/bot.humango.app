
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { startCrawlAction, checkAuditStatus } from '@/app/actions/crawler-actions';
import { 
  Mail, 
  Globe, 
  Terminal, 
  Scale, 
  ShieldCheck, 
  FileText, 
  Lock, 
  Activity, 
  Zap,
  Loader2,
  ShieldAlert,
  Download,
  CheckCircle2,
  Cpu,
  Fingerprint,
  ArrowRight,
  AlertCircle
} from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [pollingUrl, setPollingUrl] = useState('');
  const [displayDomain, setDisplayDomain] = useState('');
  const { toast } = useToast();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !email) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide both a valid URL and your email address." });
      return;
    }

    setIsScanning(true);
    setScanStatus('queued');
    
    // Extract hostname just for visual display
    try {
      const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
      setDisplayDomain(host);
    } catch (e) {
      setDisplayDomain(url);
    }

    try {
      const result = await startCrawlAction(url, email);
      if (result.status === 'success' && result.url) {
        setPollingUrl(result.url); // Use the exact normalized URL from the DB
        toast({ title: "Audit Queued", description: "Your request is now in the priority audit queue." });
      } else {
        toast({ variant: "destructive", title: "Audit Failed", description: result.reason || "Could not queue the scan." });
        setIsScanning(false);
        setScanStatus('failed');
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred while starting the audit." });
      setIsScanning(false);
      setScanStatus('failed');
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning && pollingUrl && (scanStatus === 'queued' || scanStatus === 'processing')) {
      interval = setInterval(async () => {
        const res = await checkAuditStatus(pollingUrl);
        if (res.success) {
          const currentStatus = res.status as any;
          if (currentStatus === 'completed') {
            setScanStatus('completed');
            setIsScanning(false);
            clearInterval(interval);
            toast({ title: "Audit Finished!", description: "The PDF report has been sent to your email and is ready for download." });
          } else if (currentStatus === 'failed') {
            setScanStatus('failed');
            setIsScanning(false);
            clearInterval(interval);
            toast({ variant: "destructive", title: "Audit Failed", description: "The bot encountered an error scanning this site. Please try again later." });
          } else if (currentStatus !== scanStatus) {
            setScanStatus(currentStatus);
          }
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isScanning, scanStatus, pollingUrl, toast]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body overflow-x-hidden flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl shrink-0 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-default">
            <Image src="/logo.png" alt="Humango Logo" width={40} height={40} className="object-contain" priority />
            <span className="font-bold text-xl tracking-tight text-white">Humango Compliance</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/admin" className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">
              <Terminal className="w-3 h-3" /> Audit Terminal
            </Link>
            <Badge variant="outline" className="hidden sm:flex border-primary/20 bg-primary/5 text-primary text-[10px] font-bold tracking-[0.2em] px-3 py-1 rounded-full uppercase">
              Pan-European V21.0
            </Badge>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-12 items-start w-full max-w-7xl mx-auto">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <Badge variant="outline" className="py-1 px-3 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
                Automated Statutory Audit
              </Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
                Statutory Privacy & <br />Security Monitoring
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                Identify systemic compliance failures and <span className="text-white font-medium">GDPR liability</span>. 
                Our bot will scan your site, analyze it with AI, and deliver a legal PDF to your inbox.
              </p>
            </div>

            <div className="max-w-xl w-full">
              <form onSubmit={handleScan} className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex flex-col md:flex-row gap-3 bg-white/[0.03] border border-white/10 p-3 rounded-2xl backdrop-blur-xl focus-within:border-primary/50 transition-all">
                    <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center w-full px-4">
                        <Globe className="w-4 h-4 text-slate-500" />
                        <Input type="url" placeholder="target-domain.com" value={url} onChange={(e) => setUrl(e.target.value)} className="bg-transparent border-none focus-visible:ring-0 text-white h-11 text-sm" required />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center w-full px-4">
                        <Mail className="w-4 h-4 text-slate-500" />
                        <Input type="email" placeholder="auditor@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent border-none focus-visible:ring-0 text-white h-11 text-sm" required />
                      </div>
                    </div>
                    <Button type="submit" disabled={isScanning} className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl shrink-0 gap-2">
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {isScanning ? 'Auditing...' : 'Run Audit'}
                    </Button>
                  </div>
                </div>
              </form>
              <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-primary" /> Reports include statutory liability estimates and AI-generated fixes.
              </p>
            </div>

            {isScanning && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <Card className="bg-white/[0.03] border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-white uppercase tracking-widest text-sm">
                      {scanStatus === 'queued' ? 'Initializing Secure Connection...' : 'AI Legal Analysis in Progress...'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm">
                      The HumangoBot is crawling {displayDomain} and mapping findings to GDPR articles. This usually takes 30-60 seconds.
                    </p>
                  </div>
                </Card>
              </div>
            )}

            {scanStatus === 'completed' && (
              <div className="animate-in zoom-in duration-500">
                <Card className="bg-primary/10 border-primary/20 overflow-hidden shadow-2xl">
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <div>
                        <h4 className="font-bold text-white text-lg">Audit Complete</h4>
                        <p className="text-sm text-slate-400">Detailed report sent to <strong>{email}</strong></p>
                      </div>
                    </div>
                    <Button className="bg-white text-primary hover:bg-slate-100 font-bold gap-2" asChild>
                      <a href={`/api/admin/report-pdf?domain=${new URL(pollingUrl).hostname}`} target="_blank">
                        <Download className="w-4 h-4" /> Download PDF
                      </a>
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {scanStatus === 'failed' && !isScanning && (
              <div className="animate-in zoom-in duration-500">
                <Card className="bg-rose-500/10 border-rose-500/20 p-6 flex items-center gap-4">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <div>
                    <h4 className="font-bold text-white text-lg">Audit Failed</h4>
                    <p className="text-sm text-slate-400">The scan for {displayDomain} could not be completed. Please check the URL and try again.</p>
                  </div>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: ShieldCheck, title: "Jurisdictional Logic", desc: "Country-aware detection for Germany (TDDG), France (CNIL), and Poland (RODO)." },
                { icon: FileText, title: "AI Reporting", desc: "Genkit-powered analysis mapping violations directly to statutory articles." },
                { icon: Scale, title: "Liability Estimates", desc: "Authoritative financial risk mapping based on Art. 83 enforcement frameworks." },
                { icon: Lock, title: "Stateless Security", desc: "Audits are performed without cookies or session storage for maximum privacy." },
              ].map((item, i) => (
                <Card key={i} className="bg-white/[0.02] border-white/5 p-6 hover:bg-white/[0.04] transition-all">
                  <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="bg-white/[0.02] border-b border-white/5">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> Audit Network Transparency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-2.5 rounded-xl"><ShieldCheck className="w-4 h-4 text-primary" /></div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Operator Identity</p>
                      <p className="text-sm font-bold text-white">Humango Limited</p>
                      <p className="text-[11px] text-slate-400 mt-1">182-184 High Street North, London, E6 2JA</p>
                      <p className="text-[10px] font-mono text-primary mt-1">Co. No: 16750477</p>
                    </div>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-4 h-4 text-slate-500" />
                      <div className="flex-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Verified User-Agent</p>
                        <p className="text-[10px] font-mono text-slate-300 truncate">HumangoBot/1.0 (+https://bot.humango.app)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Fingerprint className="w-4 h-4 text-slate-500" />
                      <div className="flex-1">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Static Network Node</p>
                        <p className="text-[10px] font-mono text-slate-300">IP: 116.203.3.75</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-primary/10 border-primary/20 p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white"><ShieldAlert className="w-4 h-4 text-primary" /> Statutory Evidence</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Our bot uses AI to interpret complex legal requirements into actionable PDF reports.
              </p>
              <Button className="w-full bg-primary font-bold h-11 text-xs gap-2 rounded-xl" asChild>
                <a href="mailto:abuse@humango.app">Statutory Inquiry <ArrowRight className="w-3 h-3" /></a>
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50 mt-auto">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary opacity-80" />
            <span>Humango Compliance Audit Engine • Pan-European V21.0</span>
          </div>
          <div className="flex gap-8 items-center">
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Statement</Link>
            <Link href="/admin" className="text-slate-800 hover:text-white transition-colors">Audit Terminal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
