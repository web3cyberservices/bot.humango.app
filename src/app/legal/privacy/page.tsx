
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ArrowLeft, Mail, Lock, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
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
              Transparency Report
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Privacy Statement
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Official policy regarding the collection, processing, and storage of technical data by the HumangoBot audit network.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <ShieldCheck className="w-5 h-5 text-primary" /> Core Data Principles
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                HumangoBot strictly adheres to the principle of <strong>Data Minimization</strong>. Our scanning activities are limited to the objective assessment of technical infrastructure.
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Technical Scope:</strong> We index technical metadata (HTTP headers, SSL versions, CSP policies).
                </li>
                <li>
                  <strong className="text-white">No PII Harvesting:</strong> We do not index user profiles, email addresses, or private credentials. Our engine automatically ignores text blocks containing personal data.
                </li>
                <li>
                  <strong className="text-white">No Reselling:</strong> Technical audit data is never sold or traded to third-party marketing entities.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Info className="w-5 h-5 text-primary" /> Verified Bot Compliance
            </h2>
            <div className="text-slate-400 leading-relaxed space-y-4">
              <p>
                To maintain "Verified Bot" status with major CDNs and Cloudflare, we provide full transparency regarding our origin:
              </p>
              <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <p className="text-sm">Origin Identity: <strong>HumangoBot/1.0</strong></p>
                <p className="text-sm">Verification: <strong>Reverse DNS (PTR)</strong> records are configured for all origin IPs.</p>
              </div>
            </div>
          </section>

          <section className="p-8 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold">
              <Mail className="w-5 h-5 text-primary" />
              Contact Our DPO
            </div>
            <p className="text-sm text-slate-400">
              For any questions regarding our data handling or exclusion requests:
            </p>
            <a href="mailto:abuse@humango.app" className="inline-block text-primary font-bold hover:underline">
              abuse@humango.app
            </a>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold text-center">
          &copy; {new Date().getFullYear()} Global Infrastructure Group • HumangoBot
        </div>
      </footer>
    </div>
  );
}
