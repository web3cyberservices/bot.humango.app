'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Info, Mail, Globe, CheckCircle2, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="h-screen bg-[#020617] text-slate-50 selection:bg-primary/30 font-body overflow-hidden flex flex-col">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl shrink-0">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">bot.humango.app</span>
          </div>
          <nav className="flex items-center gap-6">
            <Badge variant="outline" className="hidden sm:flex border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold tracking-widest px-2 py-0">
              V1.0.2 STABLE
            </Badge>
            <Link href="/admin">
              <Button size="sm" className="bg-white/5 hover:bg-white/10 text-white border border-white/10 h-8 rounded-full text-xs font-semibold">
                Admin Portal
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-6 grid lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column: Hero & Mission */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <div className="space-y-4">
            <Badge variant="outline" className="py-1 px-3 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
              Official Crawler Identity
            </Badge>
            <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
              Automated Compliance <br /> & Security Auditing
            </h1>
            <p className="text-base text-slate-400 max-w-xl font-medium leading-relaxed">
              HumangoBot is a specialized agent dedicated to auditing global web infrastructure for <span className="text-white">GDPR compliance</span>, <span className="text-white">SSL standards</span>, and <span className="text-white">data privacy protocols</span>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-bold tracking-wider uppercase">GDPR Ready</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-bold tracking-wider uppercase">SSL Verified</span>
            </div>
          </div>

          <div className="pt-4">
            <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 rounded-2xl border-l-2 border-primary">
              <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Why we crawl?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We identify vulnerable cipher suites and non-compliant cookie policies to help businesses maintain high security benchmarks and protect user data.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Technical Specs & Opt-out */}
        <div className="lg:col-span-5 flex flex-col gap-4 overflow-hidden">
          <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md shadow-2xl flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> Technical Specifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold">Verified User-Agent</label>
                <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[11px] text-slate-300 break-all leading-relaxed">
                  Mozilla/5.0 (compatible; HumangoBot/1.0; +http://bot.humango.app)
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Source IP Address</label>
                  <div className="flex items-center gap-2 font-mono text-sm text-slate-200">
                    <Globe className="w-3 h-3 text-primary" />
                    <span>116.203.3.75</span>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px]">STATIC</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1">
                  <label className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Protocol</label>
                  <div className="text-xs font-bold">HTTP/2, TLS 1.3</div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg border border-white/5 space-y-1">
                  <label className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Compliance</label>
                  <div className="text-xs font-bold">Robots.txt Standard</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-500/10 to-primary/10 border-primary/20 backdrop-blur-md flex-1 overflow-hidden flex flex-col justify-center p-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Opt-out & Support
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              To exclude your domain, update <code className="text-primary font-mono">robots.txt</code> or contact our abuse desk.
            </p>
            <a href="mailto:abuse@humango.app" className="w-full">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-10 text-xs gap-2 shadow-lg shadow-primary/20">
                <Mail className="w-4 h-4" /> Contact abuse@humango.app
              </Button>
            </a>
          </Card>
        </div>
      </main>

      <footer className="py-4 px-6 border-t border-white/5 bg-[#010413]/50 shrink-0">
        <div className="container mx-auto flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          <div className="flex items-center gap-2 opacity-60">
            <Shield className="w-3 h-3" />
            <span>Humango Compliance Systems</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Global Infrastructure Group</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="/" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
