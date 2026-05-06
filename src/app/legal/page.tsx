import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Scale, FileText, Mail, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function LegalPage() {
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
              <ArrowLeft className="w-4 h-4" /> Back to Portal
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 max-w-4xl">
        <div className="space-y-12">
          <div className="space-y-4">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.2em]">
              Transparency & Legal
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              HumangoBot Policy & Compliance
            </h1>
            <p className="text-slate-400 leading-relaxed">
              This document outlines the operational protocols and data handling policies of HumangoBot. 
              Our mission is to improve global web security while maintaining the highest standards of privacy and transparency.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <ShieldCheck className="w-5 h-5 text-primary" /> Privacy & Data Minimization Policy
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                HumangoBot strictly adheres to the principle of <strong>Data Minimization</strong>. Our scanning activities are limited to the objective assessment of technical infrastructure and security posture.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Scope:</strong> The crawler only indexes technical metadata, HTTP response headers, and public security configurations (e.g., SSL/TLS versions, Content-Security-Policy headers, robots.txt directives).
                </li>
                <li>
                  <strong>No PII Collection:</strong> No Personally Identifiable Information (PII) is collected, processed, or stored. We do not index user profiles, names, email addresses, or private credentials found in page content.
                </li>
                <li>
                  <strong>Compliance:</strong> Our operations are designed to comply with <strong>GDPR (EU)</strong> and <strong>CCPA (USA)</strong> regarding automated technical auditing. We do not track individual users across domains.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <Scale className="w-5 h-5 text-primary" /> RFC 9309 (Robots Exclusion Protocol) Compliance
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                HumangoBot is engineered to be a "polite" crawler. We strictly follow the industry-standard <strong>IETF RFC 9309</strong> protocols.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Pre-fetch Verification:</strong> The crawler fetches and interprets the <code>robots.txt</code> file of every domain before any interaction with sub-pages.
                </li>
                <li>
                  <strong>Exclusion Directives:</strong> We fully honor <code>Disallow</code> and <code>Crawl-delay</code> directives. If a path is disallowed for <code>HumangoBot</code> or <code>*</code>, we will not access it.
                </li>
                <li>
                  <strong>Resource Management:</strong> We utilize controlled concurrency and per-domain delays to prevent unnecessary server load or performance degradation for site owners.
                </li>
              </ul>
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-3 text-white border-l-2 border-primary pl-4">
              <FileText className="w-5 h-5 text-primary" /> Operator Transparency & Opt-Out
            </h2>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p>
                Transparency is a core value of the HumangoBot project. Every request made by our infrastructure is identifiable by its unique User-Agent signature.
              </p>
              <div className="p-4 bg-white/5 rounded-xl border border-white/5 font-mono text-sm text-slate-300 break-all leading-relaxed">
                Mozilla/5.0 (compatible; HumangoBot/1.0; +http://bot.humango.app)
              </div>
              <p>
                If you are a site owner and wish to request a manual exclusion from our audit index, or if you have inquiries regarding a specific scan, please contact our transparency desk:
              </p>
              <div className="flex items-center gap-4 p-5 bg-primary/10 rounded-xl border border-primary/20">
                <Mail className="w-6 h-6 text-primary" />
                <div>
                  <div className="text-sm font-bold text-white uppercase tracking-wider">Contact Email</div>
                  <a href="mailto:abuse@humango.app" className="text-primary font-bold hover:underline">
                    abuse@humango.app
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-primary opacity-80" />
            <span>Humango Compliance Systems • Policy Version 1.1</span>
          </div>
          <div className="flex gap-8">
            <span>&copy; {new Date().getFullYear()} Global Infrastructure Group</span>
            <Link href="/" className="hover:text-white transition-colors">Return to Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
