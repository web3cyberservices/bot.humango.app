
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { startCrawlAction, checkAuditStatus } from '@/app/actions/crawler-actions';
import { 
  Mail, Globe, Terminal, ShieldCheck, Zap, Loader2, CheckCircle2, Download, ArrowRight, ShieldAlert, Cpu, Activity, FileSearch, Code
} from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'pending' | 'queued' | 'processing' | 'completed' | 'failed'>('idle');
  const [pollingUrl, setPollingUrl] = useState('');
  const { toast } = useToast();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);
    setScanStatus('queued');
    try {
      const result = await startCrawlAction(url, email);
      if (result.status === 'success' && result.url) {
        setPollingUrl(result.url);
        toast({ title: "Audit Queued", description: "Your request has been added to the priority engine." });
      } else {
        setScanStatus('failed');
        setIsScanning(false);
        toast({ variant: "destructive", title: "Queue Error", description: result.reason });
      }
    } catch (error) {
      setScanStatus('failed');
      setIsScanning(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning && pollingUrl && ['queued', 'pending', 'processing'].includes(scanStatus)) {
      interval = setInterval(async () => {
        const res = await checkAuditStatus(pollingUrl);
        if (res.success && res.status === 'completed') {
          setScanStatus('completed');
          setIsScanning(false);
          clearInterval(interval);
        } else if (res.success && res.status === 'failed') {
          setScanStatus('failed');
          setIsScanning(false);
          clearInterval(interval);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isScanning, scanStatus, pollingUrl]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body flex flex-col selection:bg-primary/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-primary/5 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/5 p-1.5 rounded-lg border border-white/10">
              <Image src="/logo.png" alt="Humango Logo" width={24} height={24} priority />
            </div>
            <span className="font-bold text-lg tracking-tight">Humango<span className="text-primary">Compliance</span></span>
          </div>
          <Link href="/admin" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
            <Terminal className="w-3 h-3" /> Admin Hub
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-6 pt-16 pb-24 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <Badge variant="outline" className="py-1.5 px-4 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
              Statutory Compliance Engine
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.9] text-white">
              Professional Web <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-primary to-indigo-500">
                Integrity Auditing
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">
              Automated detection of GDPR liabilities, missing legal disclosures, and technical risks in real-time. Verified reports for global web infrastructure.
            </p>

            <div className="pt-8 max-w-2xl mx-auto">
              <form onSubmit={handleScan} className="flex flex-col md:flex-row gap-3 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl focus-within:border-primary/50 transition-colors">
                <div className="flex-1 flex items-center px-4">
                  <Globe className="w-4 h-4 text-slate-500 mr-3" />
                  <Input 
                    placeholder="domain.com" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-12" 
                    required 
                  />
                </div>
                <div className="flex-1 flex items-center px-4 border-t md:border-t-0 md:border-l border-white/5">
                  <Mail className="w-4 h-4 text-slate-500 mr-3" />
                  <Input 
                    type="email" 
                    placeholder="report@recipient.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-12" 
                    required 
                  />
                </div>
                <Button type="submit" disabled={isScanning} className="bg-primary hover:bg-primary/90 text-white font-bold h-12 px-8 rounded-xl transition-all shadow-lg shadow-primary/20">
                  {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
                  {isScanning ? 'Processing...' : 'Run Audit'}
                </Button>
              </form>
              <div className="flex flex-col items-center gap-2 mt-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                  * RFC 9309 Compliant. We respect robots.txt and server stability.
                </p>
                <code className="text-[9px] text-primary/60 font-mono">
                  UA: HumangoBot/1.0 (+https://bot.humango.app)
                </code>
              </div>
            </div>

            {scanStatus === 'completed' && (
              <div className="mt-12 animate-in zoom-in-95 duration-500">
                <Card className="bg-emerald-500/5 border-emerald-500/20 p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-sm">
                  <div className="flex items-center gap-6 text-left">
                    <div className="bg-emerald-500/20 p-4 rounded-2xl">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xl text-white">Diagnostic Complete</h4>
                      <p className="text-slate-400">The statutory report for <span className="text-white font-medium">{url}</span> is ready.</p>
                    </div>
                  </div>
                  <Button asChild size="lg" className="bg-white text-[#020617] hover:bg-slate-200 font-bold px-10 rounded-xl h-14">
                    <a href={`/api/admin/report-pdf?domain=${url}`} target="_blank">
                      <Download className="w-5 h-5 mr-2" /> Download PDF Report
                    </a>
                  </Button>
                </Card>
              </div>
            )}
          </div>
        </section>

        <section className="bg-white/[0.01] border-y border-white/5 py-24">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: ShieldAlert, title: "GDPR Gaps", desc: "Detection of missing privacy policies, cookie banners, and mandatory legal disclosures." },
                { icon: Cpu, title: "Logic Verification", desc: "Automated analysis of data retention timeframes and technical storage purposes." },
                { icon: FileSearch, title: "Deep Indexing", desc: "Smart discovery of /legal paths even if not linked directly in the main navigation." },
                { icon: Activity, title: "Risk Scoring", desc: "Calculating liability scores based on potential administrative fines and ad-platform policies." },
              ].map((item, i) => (
                <div key={i} className="group p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-primary/20 hover:bg-white/[0.04] transition-all duration-500">
                  <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                Enterprise-Grade <br />Compliance Verification
              </h2>
              <p className="text-lg text-slate-400 font-light leading-relaxed">
                Humango Compliance provides the technical evidence required to verify digital integrity. Our bot operates statelessly, respecting privacy while identifying critical gaps.
              </p>
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500 uppercase">User-Agent Identity</span>
                  <span className="text-primary">HumangoBot/1.0 (+https://bot.humango.app)</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500 uppercase">Static IP Node</span>
                  <span className="text-white">116.203.3.75</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-500 uppercase">Protocol Standard</span>
                  <span className="text-white">RFC 9309 (Polite)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 uppercase">Legal Basis</span>
                  <span className="text-emerald-500">Art. 6(1)(f) GDPR</span>
                </div>
              </div>
              <Button variant="ghost" className="text-primary hover:text-primary/80 p-0 font-bold group" asChild>
                <Link href="/legal/bot-policy">
                  View Technical Policy <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-indigo-500/5 rounded-[3rem] p-1 border border-white/5 overflow-hidden">
              <div className="bg-[#0b1120] rounded-[2.9rem] p-10 space-y-6">
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Operational</Badge>
                  <span className="text-xs font-mono text-slate-500 flex items-center gap-2">
                    <Code className="w-3 h-3" /> Node: 116.203.3.75
                  </span>
                </div>
                <div className="space-y-4">
                  <p className="text-2xl font-bold text-white">Compliance Verdict</p>
                  <p className="text-sm text-slate-400">Our engine maps your site against EU and UK statutory requirements in real-time.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-2xl font-bold text-white">1,240+</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Daily Audits</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-2xl font-bold text-white">99.9%</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Uptime</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex gap-8">
              <Link href="/legal/privacy" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/legal/impressum" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Legal Notice</Link>
              <Link href="/legal/bot-policy" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Bot Policy</Link>
            </div>
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">&copy; {new Date().getFullYear()} Humango Limited • London • bot.humango.app</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
