
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Scale, ArrowLeft, ShieldCheck, Zap, Terminal, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function RFCPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body flex flex-col">
      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image 
              src="/logo.png" 
              alt="HumangoBot Logo" 
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="font-bold text-lg tracking-tight text-white">
              HumangoBot
            </span>
          </Link>
          <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Home Portal
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
        <div className="space-y-12">
          <div className="space-y-4">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
              Polite Auditing
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              RFC 9309 Compliance Documentation
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Technical implementation of the Robots Exclusion Protocol (REP) within the HumangoBot engine.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Clock className="w-5 h-5 text-primary" /> Crawl-Delay & Rate Limiting
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                HumangoBot strictly follows the <code>Crawl-delay</code> directive in <code>robots.txt</code>. If no delay is specified, we maintain a default minimum of 5 seconds between requests to a single domain.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mt-8">
                <div className="p-6 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <Zap className="w-4 h-4 text-amber-500" /> Backoff Strategy
                  </div>
                  <p className="text-sm">Upon receiving 429 or 503 status codes, we apply exponential backoff to reduce server load.</p>
                </div>
                <div className="p-6 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-white font-bold">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Disallow Protocol
                  </div>
                  <p className="text-sm">Paths listed under <code>Disallow</code> for HumangoBot or * are strictly excluded from auditing.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Terminal className="w-5 h-5 text-primary" /> User-Agent Identification
            </h2>
            <div className="text-slate-400 leading-relaxed">
              <p>
                To avoid being flagged as generic traffic, our User-Agent is unique and informative. We do not use generic headers (like Go-http-client or node-fetch).
              </p>
              <div className="mt-4 p-4 bg-black/40 rounded-lg font-mono text-xs text-primary">
                HumangoBot/1.0 (+https://bot.humango.app)
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50 mt-auto">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold text-center">
          &copy; {new Date().getFullYear()} Global Infrastructure Group • RFC 9309 Compliant
        </div>
      </footer>
    </div>
  );
}
