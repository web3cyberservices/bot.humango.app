
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ArrowLeft, Mail, Lock, Info, Scale, FileText, EyeOff, MapPin, History } from "lucide-react";
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
              alt="Humango Logo" 
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="font-bold text-lg tracking-tight text-white">
              Humango
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
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest px-3 py-1">
              GDPR Compliance Framework v2.1
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Privacy Statement
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Official policy regarding the collection, processing, and storage of technical data by Humango Limited.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <ShieldCheck className="w-5 h-5 text-primary" /> Data Minimization & PII Policy
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                Humango strictly adheres to <strong>Art. 5 GDPR</strong>. Our scanning is limited to infrastructure assessment as an external observer.
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">No PII Scraping:</strong> Our engine automatically ignores and redacts emails, phone numbers, and PII found in page content.
                </li>
                <li>
                  <strong className="text-white">Stateless Operations:</strong> We do not store cookies or fingerprint users. Every request is an isolated session.
                </li>
                <li>
                  <strong className="text-white">DNT Support:</strong> We respect Global Privacy Control and always transmit <code>DNT: 1</code> headers.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <History className="w-5 h-5 text-primary" /> Data Retention (Art. 13(2)(a))
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                In accordance with statutory requirements, we maintain strict retention schedules for technical audit logs:
              </p>
              <ul className="list-disc pl-6 space-y-4">
                <li>
                  <strong className="text-white">Audit Evidence:</strong> Technical screenshots and scan logs are stored for exactly <span className="text-emerald-500 font-bold">24 months</span> (2 years) from the date of detection for verification purposes and are automatically purged thereafter.
                </li>
                <li>
                  <strong className="text-white">Queue Metadata:</strong> Domain processing metadata is retained for 365 days.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Scale className="w-5 h-5 text-primary" /> Legal Basis (Art. 6(1)(f) GDPR)
            </h2>
            <p className="text-slate-400 leading-relaxed">
              Our data processing is justified under <strong>Legitimate Interest (Art. 6(1)(f) GDPR)</strong>. The purpose is the identification of technical vulnerabilities and the monitoring of digital compliance to ensure a secure internet environment.
            </p>
          </section>

          <section className="p-8 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3 text-white font-bold">
              <MapPin className="w-5 h-5 text-primary" />
              Company Details
            </div>
            <div className="text-sm text-slate-400 space-y-1">
              <p><strong>Humango Limited</strong></p>
              <p>182-184 High Street North, London, England, E6 2JA</p>
              <p>Company Registration No: 16750477</p>
            </div>
            <div className="pt-4 flex items-center gap-3 text-white font-bold">
              <Mail className="w-5 h-5 text-primary" />
              Data Protection Officer
            </div>
            <a href="mailto:abuse@humango.app" className="inline-block text-primary font-bold hover:underline">
              abuse@humango.app
            </a>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-widest font-bold text-center">
          &copy; {new Date().getFullYear()} Humango Limited • Privacy v2.1
        </div>
      </footer>
    </div>
  );
}
