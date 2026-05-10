
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { startCrawlAction } from '@/app/actions/crawler-actions';
import { 
  Mail, 
  Globe, 
  Terminal, 
  Scale, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Lock, 
  Activity, 
  ShoppingCart, 
  ArrowRight, 
  Search, 
  Zap,
  Loader2,
  AlertTriangle,
  Download,
  CheckCircle2
} from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const { toast } = useToast();

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !email) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide both a valid URL and your email address.",
      });
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    try {
      const result = await startCrawlAction(url, email);
      setScanResult(result);
      
      if (result.status === 'success') {
        toast({
          title: "Scan Completed",
          description: `Full report has been sent to ${email}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Scan Failed",
          description: result.reason || "Could not complete the scan. Please check the URL.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during the scan.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const domain = scanResult?.url ? new URL(scanResult.url).hostname : '';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body overflow-x-hidden flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl shrink-0 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-default">
            <Image 
              src="/logo.png" 
              alt="HumangoBot Logo" 
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <span className="font-bold text-xl tracking-tight text-white">
              HumangoBot
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link 
              href="https://sfcc.humango.app" 
              className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
            >
              <ShoppingCart className="w-3 h-3" /> Enterprise SFCC
            </Link>
            <Badge variant="outline" className="hidden sm:flex border-primary/20 bg-primary/5 text-primary text-[10px] font-bold tracking-[0.2em] px-3 py-1 rounded-full uppercase">
              Compliance Portal
            </Badge>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-12 items-start w-full max-w-7xl mx-auto">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <Badge variant="outline" className="py-1 px-3 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
                Automated Auditing
              </Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
                Compliance & Security <br />Report Generator
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                Enter your website and email to receive a comprehensive <span className="text-white font-medium">GDPR & Technical Audit</span> PDF report within seconds.
              </p>
            </div>

            {/* SCANNER FORM */}
            <div className="max-w-xl w-full">
              <form onSubmit={handleScan} className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex flex-col md:flex-row gap-3 bg-white/[0.03] border border-white/10 p-3 rounded-2xl backdrop-blur-xl focus-within:border-primary/50 transition-all">
                    <div className="flex-1 flex items-center bg-white/5 rounded-xl border border-white/5">
                      <div className="pl-4 pr-2">
                        <Globe className="w-4 h-4 text-slate-500" />
                      </div>
                      <Input 
                        type="url" 
                        placeholder="https://your-website.com" 
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-11 text-sm"
                        required
                      />
                    </div>
                    <div className="flex-1 flex items-center bg-white/5 rounded-xl border border-white/5">
                      <div className="pl-4 pr-2">
                        <Mail className="w-4 h-4 text-slate-500" />
                      </div>
                      <Input 
                        type="email" 
                        placeholder="your@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-11 text-sm"
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isScanning}
                      className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl shrink-0 gap-2"
                    >
                      {isScanning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      {isScanning ? 'Scanning...' : 'Scan Now'}
                    </Button>
                  </div>
                </div>
              </form>
              <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-primary" /> Reports are delivered as authenticated PDF attachments
              </p>
            </div>

            {/* SCAN RESULTS DISPLAY */}
            {scanResult && scanResult.status === 'success' && (
              <Card className="bg-white/[0.03] border-white/10 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden">
                <div className="bg-emerald-500/5 border-b border-emerald-500/10 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">Audit Successful</span>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Report Sent</Badge>
                </div>
                <CardContent className="p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">Full Report Dispatched</h3>
                      <p className="text-sm text-slate-400">
                        A detailed analysis of <span className="text-primary font-mono">{domain}</span> has been sent to <span className="text-white font-medium">{scanResult.recipient}</span>.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="border-white/10 hover:bg-white/5 text-xs font-bold uppercase tracking-widest gap-2 h-12 px-6" asChild>
                        <a href={`/api/admin/report-pdf?domain=${domain}`} target="_blank">
                          <Download className="w-4 h-4" /> Download PDF
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Violations</p>
                      <p className="text-lg font-bold text-amber-500">{scanResult.issuesFound}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">SSL Security</p>
                      <p className="text-lg font-bold text-emerald-500">Active</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Scan Type</p>
                      <p className="text-lg font-bold text-white uppercase">{scanResult.scanType}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Compliance</p>
                      <p className="text-lg font-bold text-primary">RFC 9309</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: ShieldCheck, title: "Official Certification", desc: "Our reports provide technical evidence of compliance for regulatory audits." },
                { icon: FileText, title: "PDF Export", desc: "Receive structured PDF reports with legal justifications and potential fine estimates." },
                { icon: Scale, title: "GDPR Focus", desc: "Detailed breakdown of Art. 13/14 requirements and missing documentation." },
                { icon: Globe, title: "Universal Check", desc: "Auditing of SSL, CSP, and HSTS headers alongside content integrity." },
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
                  <Terminal className="w-4 h-4 text-primary" /> Network Intelligence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Audit Agent</label>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] text-slate-300 break-all leading-relaxed">
                    HumangoBot/1.0 (+https://humango.app)
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Reporting Origin</label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span>116.203.3.75</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] px-2 h-4">Verified</Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Compliance Status</label>
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>RFC 9309 ADHERENT</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-primary">Audit Capacity</span>
                    <span className="text-[10px] font-bold text-white">High Volume</span>
                  </div>
                  <div className="w-full bg-primary/20 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[85%]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-primary/10 border-primary/20 p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <Mail className="w-4 h-4 text-primary" /> Enterprise Solutions
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Need bulk auditing for multiple domains or recurring monthly reports? Contact our Enterprise Compliance team.
              </p>
              <Button className="w-full bg-primary font-bold h-11 text-xs gap-2 rounded-xl" asChild>
                <a href="mailto:abuse@humango.app">
                  Contact Sales
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50 mt-auto">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary opacity-80" />
            <span>Humango Compliance • Policy v2.7</span>
          </div>
          <div className="flex gap-8 items-center">
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Statement</Link>
            <Link href="/legal/rfc9309" className="hover:text-white transition-colors">RFC 9309 Compliance</Link>
            <Link href="/admin" className="text-slate-700 hover:text-white transition-colors">Admin Access</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
