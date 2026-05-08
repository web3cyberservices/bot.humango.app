'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  Terminal, 
  ShieldCheck, 
  Mail, 
  Clock, 
  Info, 
  ArrowLeft, 
  Scale, 
  Lock, 
  EyeOff, 
  Database, 
  MapPin, 
  Globe, 
  ShieldAlert,
  Cpu,
  FileSearch,
  History,
  ExternalLink
} from "lucide-react";
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
        <div className="space-y-16">
          {/* Hero Section */}
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1">
              Transparency Manifesto v1.1
            </Badge>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Bot Policy & <br />Operational Standards
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg max-w-2xl">
              Official technical and legal specifications for the HumangoBot audit network. This document outlines our commitment to RFC 9309, GDPR compliance, and ethical web auditing.
            </p>
          </div>

          {/* New Section: Audit Scope Link */}
          <section>
            <Link href="/audit-scope.txt" target="_blank">
              <Card className="bg-primary/5 border-primary/20 hover:bg-primary/10 transition-all border-dashed">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/20 p-3 rounded-xl">
                      <FileSearch className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Technical Audit Scope</h3>
                      <p className="text-xs text-slate-500">View the detailed list of compliance checks and detection logic.</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-primary" />
                </CardContent>
              </Card>
            </Link>
          </section>

          {/* 1. Identity & Operator */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
              <span className="bg-primary/20 p-2 rounded-lg"><Info className="w-5 h-5 text-primary" /></span>
              1. Purpose & Operator Identity
            </h2>
            <div className="grid gap-6">
              <div className="p-8 bg-white/[0.02] rounded-3xl border border-white/5 space-y-6 shadow-2xl">
                <p className="text-slate-400 leading-relaxed">
                  HumangoBot is a specialized security crawler operated by <strong>Humango Limited</strong>. Our primary mission is the automated identification of technical vulnerabilities and GDPR compliance gaps across global web infrastructure.
                </p>
                <div className="grid md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Registered Office</label>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
                      <span className="text-sm text-slate-300">182-184 High Street North, London, England, E6 2JA</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Company Registration</label>
                    <div className="flex items-start gap-3">
                      <Terminal className="w-4 h-4 text-primary shrink-0 mt-1" />
                      <span className="text-sm text-slate-300">Company No: 16750477 (United Kingdom)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-white/5 border-white/5 p-4 text-center">
                  <Globe className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Static IP</p>
                  <p className="text-xs font-mono text-white">116.203.3.75</p>
                </Card>
                <Card className="bg-white/5 border-white/5 p-4 text-center">
                  <Cpu className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase">User-Agent</p>
                  <p className="text-[9px] font-mono text-white">HumangoBot/1.0 (+https://humango.app)</p>
                </Card>
                <Card className="bg-white/5 border-white/5 p-4 text-center">
                  <ShieldCheck className="w-5 h-5 text-primary mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Reverse DNS</p>
                  <p className="text-xs font-mono text-white">bot.humango.app</p>
                </Card>
              </div>
            </div>
          </section>

          {/* 2. Technical Standards */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
              <span className="bg-amber-500/20 p-2 rounded-lg"><Clock className="w-5 h-5 text-amber-500" /></span>
              2. Technical Standards (RFC 9309)
            </h2>
            <div className="space-y-6 text-slate-400">
              <p className="leading-relaxed">
                HumangoBot is a "Polite Crawler". We prioritize the server stability of the audited websites over the speed of our indexing.
              </p>
              <ul className="grid gap-4">
                <li className="flex items-start gap-4 p-5 bg-white/5 rounded-2xl border border-white/5">
                  <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500 font-bold text-xs shrink-0">REP</div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1">Robots Exclusion Protocol</h3>
                    <p className="text-xs leading-relaxed">Full adherence to <code>robots.txt</code>. We strictly avoid paths marked as <code>Disallow</code> for our agent or <code>*</code>.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-5 bg-white/5 rounded-2xl border border-white/5">
                  <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500 font-bold text-xs shrink-0">DELAY</div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1">Crawl-Delay & Backoff</h3>
                    <p className="text-xs leading-relaxed">We support <code>Crawl-delay</code>. In its absence, we maintain a minimum of 5 seconds between requests. We respect <code>Retry-After</code> headers with exponential backoff.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-5 bg-white/5 rounded-2xl border border-white/5">
                  <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-500 font-bold text-xs shrink-0">DNT</div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1">Privacy Headers (DNT/GPC)</h3>
                    <p className="text-xs leading-relaxed">Every request transmits <code>DNT: 1</code> (Do Not Track) and <code>Sec-GPC: 1</code> headers, signaling our intent not to track or fingerprint users.</p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* 3. GDPR & Ethics */}
          <section className="space-y-8">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-white">
              <span className="bg-emerald-500/20 p-2 rounded-lg"><ShieldAlert className="w-5 h-5 text-emerald-500" /></span>
              3. Data Protection & Ethics (GDPR)
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" /> Stateless Operation
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No cookie storage or session persistence. Each page crawl starts with a clean incognito context. No fingerprinting is performed.
                </p>
              </div>
              <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-amber-500" /> Data Minimization
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Our system is hard-coded to ignore and redact emails, phone numbers, and PII found in page source. We only collect technical metadata.
                </p>
              </div>
              <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-500" /> Legal Basis (Art. 6(1)(f))
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Audits are conducted under <strong>Legitimate Interest</strong>. This processing is necessary for the security monitoring of the digital ecosystem.
                </p>
              </div>
              <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 space-y-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-500" /> Retention Policy
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Audit evidence (screenshots/logs) is stored for 365 days for verification purposes and automatically deleted thereafter.
                </p>
              </div>
            </div>
          </section>

          {/* 4. DPO & Opt-Out */}
          <section className="p-8 bg-primary/5 rounded-3xl border border-primary/20 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary" /> Data Protection Officer
                </h2>
                <p className="text-sm text-slate-400">
                  For Article 17 (Right to Erasure) requests, DPA inquiries, or domain exclusion (Opt-Out):
                </p>
              </div>
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-bold px-8 rounded-xl shadow-xl shadow-primary/20" asChild>
                <a href="mailto:abuse@humango.app">abuse@humango.app</a>
              </Button>
            </div>
            <div className="pt-6 border-t border-white/5">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em] mb-4">Verification Manifesto v1.1</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-white/5 text-[9px] border-white/10">Compliance Focused</Badge>
                <Badge variant="secondary" className="bg-white/5 text-[9px] border-white/10">Non-Commercial Scanning</Badge>
                <Badge variant="secondary" className="bg-white/5 text-[9px] border-white/10">Stateless Agent</Badge>
                <Badge variant="secondary" className="bg-white/5 text-[9px] border-white/10">RFC 9309 Compliant</Badge>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold text-center">
          &copy; {new Date().getFullYear()} Humango Limited • London • Policy v1.1
        </div>
      </footer>
    </div>
  );
}