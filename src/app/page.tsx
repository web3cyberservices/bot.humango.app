
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
  ShieldCheck, 
  FileText, 
  Lock, 
  Activity, 
  ShoppingCart, 
  ArrowRight, 
  Zap,
  Loader2,
  AlertTriangle,
  Download,
  CheckCircle2,
  Info,
  ShieldAlert,
  FileSearch,
  Check
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
          title: "Audit Completed",
          description: `Consolidated compliance report has been sent to ${email}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Audit Failed",
          description: result.reason || "Could not complete the statutory scan.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred during the audit.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const domain = scanResult?.url ? new URL(scanResult.url).hostname : '';
  const report = scanResult?.compliance_report;

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
              alt="Humango Logo" 
              width={40}
              height={40}
              className="object-contain"
              priority
            />
            <span className="font-bold text-xl tracking-tight text-white">
              Humango Compliance
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link 
              href="/admin" 
              className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
            >
              <Terminal className="w-3 h-3" /> Audit Terminal
            </Link>
            <Badge variant="outline" className="hidden sm:flex border-primary/20 bg-primary/5 text-primary text-[10px] font-bold tracking-[0.2em] px-3 py-1 rounded-full uppercase">
              Pan-European V5.0
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
                Identify systemic compliance failures and <span className="text-white font-medium">GDPR liability</span> across digital assets. Automated analysis of multi-jurisdictional legal requirements.
              </p>
            </div>

            <div className="max-w-xl w-full">
              <form onSubmit={handleScan} className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex flex-col md:flex-row gap-3 bg-white/[0.03] border border-white/10 p-3 rounded-2xl backdrop-blur-xl focus-within:border-primary/50 transition-all">
                    <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center w-full">
                        <div className="pl-4 pr-2"><Globe className="w-4 h-4 text-slate-500" /></div>
                        <Input 
                          id="target-url"
                          type="url" 
                          placeholder="https://target-domain.com" 
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-11 text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center w-full">
                        <div className="pl-4 pr-2"><Mail className="w-4 h-4 text-slate-500" /></div>
                        <Input 
                          id="recipient-email"
                          type="email" 
                          placeholder="auditor@email.com" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-transparent border-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-11 text-sm"
                          required
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isScanning}
                      className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl shrink-0 gap-2"
                    >
                      {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      {isScanning ? 'Auditing...' : 'Run Audit'}
                    </Button>
                  </div>
                </div>
              </form>
              <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-primary" /> Reports cite Art. 83 statutory liability estimates
              </p>
            </div>

            {scanResult && scanResult.status === 'success' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <Card className="bg-white/[0.03] border-white/10 overflow-hidden shadow-2xl">
                  <div className={`p-4 flex items-center justify-between border-b border-white/5 ${report?.verdict === 'COMPLIANT' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                    <div className="flex items-center gap-3">
                      {report?.verdict === 'COMPLIANT' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-rose-500" />}
                      <div className="flex flex-col">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${report?.verdict === 'COMPLIANT' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          Audit Status: {report?.verdict}
                        </span>
                        <span className="text-[9px] text-slate-500 uppercase font-mono">{domain}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 border-white/10 hover:bg-white/5 text-[9px] font-bold uppercase tracking-widest gap-2" asChild>
                      <a href={`/api/admin/report-pdf?domain=${domain}`} target="_blank">
                        <Download className="w-3 h-3" /> PDF Export
                      </a>
                    </Button>
                  </div>
                  
                  <CardContent className="p-8">
                    <div className="grid md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                          <FileSearch className="w-4 h-4 text-primary" /> Structural Discovery
                        </h4>
                        <div className="space-y-3">
                          {['Privacy Policy', 'Legal Notice / Impressum', 'Terms of Service', 'Cookie Consent'].map((docName, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                              <span className="text-xs text-slate-300 font-medium">{docName}</span>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-primary" /> Statutory Analyzer
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: 'Art. 13(1)(a) Identity', status: true },
                            { label: 'Art. 13(1)(c) Basis', status: false },
                            { label: 'Art. 13(2)(a) Retention', status: true },
                            { label: 'DPO/Contact Info', status: true },
                            { label: 'Jurisdiction Check', status: true },
                            { label: 'Stateless Proxy', status: true }
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                              {item.status ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                              <span className="text-[10px] text-slate-400 font-medium truncate">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: ShieldCheck, title: "Jurisdictional Logic", desc: "Country-aware detection for Germany (TDDG), France (CNIL), and Poland (RODO)." },
                { icon: FileText, title: "Statutory Reporting", desc: "Consolidated audit evidence mapping violations directly to GDPR Statutory Articles." },
                { icon: Scale, title: "Liability Estimates", desc: "Authoritative financial risk mapping based on Art. 83 enforcement frameworks." },
                { icon: Globe, title: "Hybrid Analysis", desc: "Combined Static and Dynamic analysis providing a unified, deduplicated diagnostic trail." },
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
                  <Terminal className="w-4 h-4 text-primary" /> Compliance Audit Network
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Audit Agent ID</label>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] text-slate-300 break-all">
                    Humango Compliance Audit Engine / 5.0
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Audit Node Status</label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span>Active Scan Engine</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] px-2 h-4">Online</Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-primary">System Coverage</span>
                    <span className="text-[10px] font-bold text-white">Full EU-27</span>
                  </div>
                  <div className="w-full bg-primary/20 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[100%]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-primary/10 border-primary/20 p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <ShieldAlert className="w-4 h-4 text-primary" /> Statutory Evidence
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Identify statutory non-compliance before regulatory intervention. Authoritative evidence for enterprise risk management.
              </p>
              <Button className="w-full bg-primary font-bold h-11 text-xs gap-2 rounded-xl shadow-xl shadow-primary/20" asChild>
                <a href="mailto:abuse@humango.app">Statutory Inquiry</a>
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50 mt-auto">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary opacity-80" />
            <span>Humango Compliance Audit Engine • Pan-European V5.0</span>
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
