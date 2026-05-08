'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Terminal, ShieldCheck, Mail, Clock, Info, ArrowLeft, Scale, Lock, EyeOff, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function BotPolicyPage() {
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
            <Link href="/legal" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Legal Directory
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
        <div className="space-y-12">
          <div className="space-y-4">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
              Operator Transparency
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Bot Policy & Operations
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Detailed technical and legal specifications for the HumangoBot audit network, aligning with GDPR and RFC 9309 standards.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Info className="w-5 h-5 text-primary" /> Purpose of Activity
            </h2>
            <p className="text-slate-400 leading-relaxed">
              HumangoBot is a specialized crawler operated by <strong>Humango Limited</strong>. Its mission is the automated identification of security vulnerabilities and monitoring of GDPR posture. 
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="bg-white/5 border-white/5 p-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Infrastructure Audit
                </h3>
                <p className="text-xs text-slate-500">Scanning for TLS versions, Security Headers, and certificate validity without traffic interception.</p>
              </Card>
              <Card className="bg-white/5 border-white/5 p-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-500" /> Compliance Monitoring
                </h3>
                <p className="text-xs text-slate-500">Detecting missing Cookie Banners and mandatory legal disclosures (Impressum).</p>
              </Card>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Lock className="w-5 h-5 text-primary" /> Cookies & Tracking Policy
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-primary" /> Stateless Operation
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Our bot operates in a <strong>stateless mode</strong>. We do not store or transmit "Set-Cookie" headers across requests. Every page scan is performed with a "clean" session.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> No Fingerprinting
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  HumangoBot does not execute scripts designed for browser fingerprinting or user behavioral tracking.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Database className="w-5 h-5 text-primary" /> Data Minimization
            </h2>
            <div className="p-6 bg-black/40 rounded-2xl border border-white/5 space-y-4">
              <ul className="space-y-3">
                <li className="flex gap-3 text-xs text-slate-400">
                  <span className="text-primary font-bold">●</span>
                  <span><strong>Metadata Only:</strong> Collection is strictly limited to technical headers, HTML structure, and legal document presence.</span>
                </li>
                <li className="flex gap-3 text-xs text-slate-400">
                  <span className="text-primary font-bold">●</span>
                  <span><strong>No PII Scraping:</strong> Our engine automatically ignores and redacts emails, phone numbers, and PII found in page content.</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Clock className="w-5 h-5 text-primary" /> Retention & Basis
            </h2>
            <div className="space-y-4 text-slate-400">
              <p className="text-sm">
                <strong>Legal Basis:</strong> Our processing is based on <strong>Legitimate Interest (Art. 6(1)(f) GDPR)</strong> to ensure the security and compliance of the digital ecosystem.
              </p>
              <p className="text-sm">
                <strong>Retention:</strong> Audit evidence (logs and violation snapshots) are stored for <strong>365 days</strong> for legal proof before automatic deletion.
              </p>
            </div>
          </section>

          <section className="p-8 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold">
              <Mail className="w-5 h-5 text-primary" />
              Opt-out & Exclusion
            </div>
            <p className="text-sm text-slate-400">
              To request a domain exclusion or manual data removal, please contact our DPO:
            </p>
            <a href="mailto:abuse@humango.app" className="inline-block text-primary font-bold text-lg hover:underline">
              abuse@humango.app
            </a>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold text-center">
          &copy; {new Date().getFullYear()} Global Infrastructure Group • Humango Bot Policy v1.5
        </div>
      </footer>
    </div>
  );
}