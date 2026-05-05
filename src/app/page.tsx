'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Globe, Terminal, Scale, Clock, ShieldCheck, FileText } from "lucide-react";

const LogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="100" height="100" fill="black"/>
    <path d="M15 15h20v70H15V15zm20 25h30v15H35V40zm10-25h40v15H45V15zm25 10h15v50H45V60h30V25z" fill="#5EEAD4"/>
  </svg>
);

export default function Home() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body overflow-x-hidden flex flex-col">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl shrink-0 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-default">
            <div className="w-10 h-10 overflow-hidden rounded-xl shadow-lg shadow-black/50 transition-transform group-hover:scale-105 duration-300">
              <LogoIcon className="w-full h-full" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              HumangoBot
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Badge variant="outline" className="hidden sm:flex border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold tracking-[0.2em] px-3 py-1 rounded-full uppercase">
              Verified Bot Candidate
            </Badge>
            <Button size="sm" className="bg-white/5 hover:bg-white/10 text-white border border-white/10 h-9 rounded-full px-6 text-xs font-semibold tracking-normal transition-all" asChild>
              <Link href="/admin">
                Admin Portal
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-8 items-start w-full max-w-7xl mx-auto">
          {/* Left Column: Mission & Compliance */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-4">
              <Badge variant="outline" className="py-1 px-3 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
                Bot Transparency Report 2025
              </Badge>
              <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight py-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                Automated Compliance <br />& Security Auditing
              </h1>
              <p className="text-base text-slate-400 max-w-xl font-normal leading-relaxed">
                HumangoBot is a specialized crawler designed to identify technical vulnerabilities and monitor <span className="text-white font-medium">GDPR header compliance</span> across the global web infrastructure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { icon: Scale, title: "GDPR Alignment", desc: "No collection of PII (Personally Identifiable Information). Only technical headers are indexed.", color: "emerald" },
                { icon: ShieldCheck, title: "Safety Protocol", desc: "Limited scan depth to avoid resource exhaustion on target servers.", color: "primary" },
                { icon: Clock, title: "Politeness (RFC 9309)", desc: "Strict adherence to robots.txt and Crawl-delay directives.", color: "amber" },
                { icon: FileText, title: "Public Identity", desc: "Every request carries a link to this portal for full operator transparency.", color: "blue" },
              ].map((item, i) => (
                <Card key={i} className="bg-white/[0.02] border-white/5 p-5 space-y-3 border-t-white/10">
                  <div className={`bg-${item.color}-500/10 w-9 h-9 rounded-lg flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 text-${item.color}-400`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold">{item.title}</h3>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right Column: Technical Specs & Opt-out */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-md shadow-2xl border-t-white/20">
              <CardHeader className="pb-4 bg-white/[0.02] border-b border-white/5">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> Verified Identity Card
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">User-Agent Signature</label>
                  <div className="p-3 bg-black/40 rounded-lg border border-white/5 font-mono text-[10px] text-slate-300 break-all leading-relaxed">
                    Mozilla/5.0 (compatible; HumangoBot/1.0; +http://bot.humango.app)
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Verified Origin IP</label>
                    <div className="flex items-center gap-2 font-mono text-sm text-slate-200">
                      <Globe className="w-3 h-3 text-primary" />
                      <span>116.203.3.75</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] font-bold tracking-widest">STABLE</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Encryption</label>
                    <div className="text-[11px] font-bold">TLS 1.3 / HTTP2</div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Verification</label>
                    <div className="text-[11px] font-bold">Cloudflare CF-IP</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-primary/10 border-primary/20 p-6">
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Exclusion & Compliance
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                We strictly follow standard <code className="text-primary font-bold">robots.txt</code> protocols. If you wish to exclude your domain or report an issue, please contact our transparency desk.
              </p>
              <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-10 text-xs gap-2 transition-all shadow-lg shadow-primary/20" asChild>
                <a href="mailto:abuse@humango.app">
                  abuse@humango.app
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-6 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[9px] text-slate-500 uppercase tracking-[0.2em] font-bold">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span>Humango Compliance Systems • Data Minimization Policy Active</span>
          </div>
          <div className="flex gap-6">
            <span>&copy; {new Date().getFullYear()} Global Infrastructure Group</span>
            <Link href="/" className="hover:text-white transition-colors">Privacy Statement</Link>
            <Link href="/" className="hover:text-white transition-colors">RFC 9309 Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
