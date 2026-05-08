
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Scale, ArrowLeft, Mail, MapPin, Info, ShieldCheck, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ImpressumPage() {
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
              Legal Disclosure
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Impressum
            </h1>
            <p className="text-slate-400 leading-relaxed text-lg">
              Official operator information in accordance with EU transparency regulations (TMG/ePrivacy).
            </p>
          </div>

          <section className="grid md:grid-cols-2 gap-8">
            <div className="p-8 bg-white/[0.02] rounded-3xl border border-white/5 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary" /> Company Details
              </h2>
              <div className="space-y-4 text-slate-400">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Company Name</label>
                  <p className="text-white font-medium">Humango Limited</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Registered Office</label>
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
                    <span>182-184 High Street North, London, England, E6 2JA</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Registration</label>
                  <p className="text-white font-medium">Company No: 16750477 (UK)</p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white/[0.02] rounded-3xl border border-white/5 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary" /> Contact Information
              </h2>
              <div className="space-y-4 text-slate-400">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">E-Mail</label>
                  <a href="mailto:abuse@humango.app" className="text-primary font-bold hover:underline block">abuse@humango.app</a>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Authorized Representative</label>
                  <p className="text-white">Director of Compliance Operations</p>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[10px] text-slate-500 leading-relaxed italic">
                    Note: This portal is an automated security audit node. For domain exclusion requests, please use the contact email above.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6 text-slate-400 leading-relaxed text-sm">
            <h2 className="text-white font-bold text-lg">Disclaimer</h2>
            <p>
              The content on this website has been created with the greatest possible care. However, we do not guarantee that the content provided is correct, complete or up to date. As a service provider, we are responsible for our own content on these pages in accordance with general laws. 
            </p>
            <p>
              External Links: Our website contains links to third-party websites. We have no influence on their content and therefore cannot accept any liability for this third-party content.
            </p>
          </section>
        </div>
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto text-[9px] text-slate-500 uppercase tracking-[0.25em] font-bold text-center">
          &copy; {new Date().getFullYear()} Humango Limited • Impressum v1.0
        </div>
      </footer>
    </div>
  );
}
