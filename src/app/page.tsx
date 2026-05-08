
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Globe, Terminal, Scale, Clock, ShieldCheck, FileText, Lock, Activity, ShoppingCart, ArrowRight } from "lucide-react";

export default function Home() {
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
              Audit Candidate
            </Badge>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="grid lg:grid-cols-12 gap-12 items-start w-full max-w-7xl mx-auto">
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <Badge variant="outline" className="py-1 px-3 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
                Transparency Desk
              </Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-white">
                Automated Compliance <br />& Security Auditing
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                HumangoBot is a specialized security crawler identifying technical vulnerabilities and <span className="text-white font-medium">GDPR posture</span>. We strictly follow the "Polite Crawling" standards.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: ShieldCheck, title: "Harmless Purpose", desc: "No scalping or data reselling. Focus on security headers and technical audit." },
                { icon: Clock, title: "RFC 9309 Politeness", desc: "Full support for robots.txt and Crawl-delay. No aggressive crawling." },
                { icon: Scale, title: "Data Minimization", desc: "We index technical metadata only. Personal data (PII) is automatically ignored." },
                { icon: Globe, title: "Public Manifest", desc: "Fixed IP ranges and Reverse DNS for automated verification by CDNs." },
              ].map((item, i) => (
                <Card key={i} className="bg-white/[0.02] border-white/5 p-6 hover:bg-white/[0.04] transition-all">
                  <div className="bg-primary/10 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </Card>
              ))}

              <Link href="https://sfcc.humango.app" className="md:col-span-2 group">
                <Card className="bg-primary/5 border-primary/20 p-6 hover:bg-primary/10 transition-all border-dashed">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/20 w-12 h-12 rounded-xl flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Enterprise SFCC Monitoring</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Specialized audit infrastructure for Salesforce Commerce Cloud storefronts.</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <Card className="bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden">
              <CardHeader className="bg-white/[0.02] border-b border-white/5">
                <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> Technical Identity
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
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Reporting Origin (Static IP)</label>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs text-slate-200">
                        <Globe className="w-3.5 h-3.5 text-primary" />
                        <span>116.203.3.75</span>
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] px-2 h-4">Dedicated</Badge>
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

                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase text-primary">Target Traffic</span>
                    <span className="text-[10px] font-bold text-white">&gt; 1,000 req/day</span>
                  </div>
                  <div className="w-full bg-primary/20 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[85%]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-500/10 to-primary/10 border-primary/20 p-6 space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                <Mail className="w-4 h-4 text-primary" /> Contact & Abuse
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                If you wish to exclude your domain or have questions about our crawling volume, please reach out to our DPO.
              </p>
              <Button className="w-full bg-primary font-bold h-11 text-xs gap-2 rounded-xl" asChild>
                <a href="mailto:abuse@humango.app">
                  abuse@humango.app
                </a>
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary opacity-80" />
            <span>Humango Compliance • Audit Protocol v2.5</span>
          </div>
          <div className="flex gap-8">
            <Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Statement</Link>
            <Link href="/legal/rfc9309" className="hover:text-white transition-colors">RFC 9309 Compliance</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
