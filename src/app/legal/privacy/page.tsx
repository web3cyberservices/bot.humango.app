
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ArrowLeft, Mail, Lock, Info, Scale, FileText, EyeOff } from "lucide-react";
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
              GDPR Compliance
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Privacy Statement
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Official policy regarding the collection, processing, and storage of technical data by the HumangoBot network.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <ShieldCheck className="w-5 h-5 text-primary" /> Data Minimization & Ethics
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                HumangoBot strictly adheres to <strong>Art. 5 GDPR</strong>. Our scanning is limited to infrastructure assessment as an external observer.
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Stateless Scanning:</strong> We do not store cookies or fingerprint users. Every request is a clean session.
                </li>
                <li>
                  <strong className="text-white">Zero PII Storage:</strong> We automatically redact emails, names, and phone numbers found in HTML content. We do not scrape form inputs.
                </li>
                <li>
                  <strong className="text-white">Retention:</strong> Technical audit logs are kept for 365 days for compliance verification and legal evidence.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Scale className="w-5 h-5 text-primary" /> Legal Basis (Art. 6 GDPR)
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Our data processing is justified under <strong>Legitimate Interest (Art. 6(1)(f) GDPR)</strong>. The purpose is to identify technical vulnerabilities and monitor the digital compliance posture of web infrastructure to ensure a secure internet environment.
            </p>
          </section>

          <section className="p-8 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold">
              <Mail className="w-5 h-5 text-primary" />
              Data Protection Officer (DPO)
            </div>
            <p className="text-sm text-slate-400">
              For GDPR rights (access, erasure, objection) or exclusion requests, contact:
            </p>
            <a href="mailto:abuse@humango.app" className="inline-block text-primary font-bold hover:underline">
              abuse@humango.app
            </a>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold text-center">
          &copy; {new Date().getFullYear()} Global Infrastructure Group • Humango Privacy v1.5
        </div>
      </footer>
    </div>
  );
}
