
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShieldCheck, 
  Globe, 
  Terminal, 
  Scale, 
  Clock, 
  Activity, 
  ShoppingCart, 
  Database, 
  Lock,
  Zap
} from "lucide-react";

export default function SFCCLandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body overflow-x-hidden flex flex-col">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-primary/10 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl shrink-0 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-default">
            <Image 
              src="/logo.png" 
              alt="Humango Logo" 
              width={36}
              height={36}
              className="object-contain"
              priority
            />
            <span className="font-bold text-xl tracking-tight text-white">
              Humango<span className="text-primary">SFCC</span>
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Badge variant="outline" className="hidden sm:flex border-primary/20 bg-primary/5 text-primary text-[10px] font-bold tracking-[0.2em] px-3 py-1 rounded-full uppercase">
              SFCC Audit Engine
            </Badge>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-12 items-start w-full max-w-7xl mx-auto">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <Badge variant="outline" className="py-1 px-3 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
                Enterprise E-Commerce Audit
              </Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
                Salesforce Commerce <br />Cloud Compliance
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                HumangoBot specialized module for <span className="text-white font-medium">SFCC Storefronts</span>. Automated monitoring of third-party pixels, security headers, and GDPR posture in high-scale retail environments.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button className="bg-primary hover:bg-primary/90 text-white font-bold h-12 px-8 rounded-xl" asChild>
                  <a href="mailto:abuse@humango.app">Request Audit Data</a>
                </Button>
                <Button variant="outline" className="border-white/10 hover:bg-white/5 h-12 px-8 rounded-xl" asChild>
                  <Link href="/legal/bot-policy">Transparency Manifesto</Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: ShoppingCart, title: "Storefront Integrity", desc: "Detection of unauthorized script injections and pixel tracking on SFCC checkout flows." },
                { icon: Database, title: "Data Minimization", desc: "Stateless crawling that respects PII boundaries. No transactional data is ever stored." },
                { icon: Lock, title: "Security Hardening", desc: "Audit of CSP headers, HSTS, and TLS 1.3 standards across SFCC production instances." },
                { icon: Zap, title: "High-Scale Efficiency", desc: "Polite indexing of large-scale product catalogs without impacting storefront performance." },
              ].map((item, i) => (
                <Card key={i} className="bg-white/[0.02] border-white/5 p-6 hover:bg-white/[0.04] transition-all border-l-primary/30 border-l-2 shadow-xl">
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
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden border-t-primary/20">
              <CardHeader className="bg-white/[0.02] border-b border-white/5">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> SFCC Auditor Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">Bot User-Agent</label>
                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] text-slate-300 break-all leading-relaxed">
                    HumangoBot/1.0 (+https://humango.app)
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Network Origin</label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span>116.203.3.75</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] px-2 h-4">Static</Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Reverse DNS (PTR)</label>
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                      <Activity className="w-3.5 h-3.5 text-primary" />
                      <span>bot.humango.app</span>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-bold uppercase text-indigo-200">SFCC Best Practices Adherence</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic">
                    Our scanner is tuned to bypass common SFCC cache variations while respecting the storefront's CDN rate limits.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="p-6 bg-gradient-to-br from-primary/10 to-indigo-500/10 rounded-2xl border border-primary/20">
              <h3 className="text-sm font-bold text-white mb-2">Request SFCC Scan Report</h3>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Automated vulnerability reports for SFCC merchants are available upon verification of domain ownership.
              </p>
              <Button className="w-full bg-primary font-bold h-11 rounded-xl shadow-lg shadow-primary/20" asChild>
                <a href="mailto:abuse@humango.app">Contact DPO</a>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary opacity-80" />
            <span>Humango SFCC Compliance • Protocol v1.2</span>
          </div>
          <div className="flex gap-8">
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/legal/bot-policy" className="hover:text-white transition-colors">Bot Policy</Link>
            <Link href="/" className="hover:text-white transition-colors">Global Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
