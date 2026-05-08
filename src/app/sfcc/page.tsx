
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldCheck, 
  Globe, 
  Scale, 
  Activity, 
  ShoppingCart, 
  Lock,
  Zap,
  ArrowRight,
  Search,
  CheckCircle2,
  FileBarChart,
  Layout
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SFCCLandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-body overflow-x-hidden flex flex-col">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-primary/10 blur-[100px] rounded-full" />
      </div>

      <header className="border-b border-white/5 bg-[#020617]/50 backdrop-blur-xl shrink-0 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-default">
            <div className="bg-white/5 p-2 rounded-xl border border-white/10 group-hover:border-primary/50 transition-colors">
              <Image 
                src="/logo.png" 
                alt="Humango Logo" 
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Humango<span className="text-primary">SFCC</span>
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="https://humango.app" className="hidden md:block text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Global Portal</Link>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-full shadow-lg shadow-primary/20">
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section - Tightened layout */}
        <section className="container mx-auto px-6 pt-12 pb-24 md:pt-16 md:pb-32">
          <div className="max-w-4xl space-y-6">
            <Badge variant="outline" className="py-1.5 px-4 border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-[0.3em] rounded-full">
              Enterprise Retail Audit
            </Badge>
            <h1 className="text-5xl md:text-8xl font-extrabold tracking-tight leading-[0.9] text-white">
              Salesforce <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-primary to-indigo-500">
                Commerce Cloud
              </span> <br />
              Monitoring
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl leading-relaxed font-light mt-4">
              Continuous infrastructure auditing for global <span className="text-white font-medium">SFCC storefronts</span>. 
              We identify third-party risks, compliance gaps, and technical glitches in real-time.
            </p>
            <div className="flex flex-wrap gap-5 pt-8">
              <Button size="lg" className="bg-white text-[#020617] hover:bg-slate-200 font-bold h-16 px-10 rounded-2xl shadow-2xl" asChild>
                <a href="mailto:abuse@humango.app">Connect with Experts <ArrowRight className="ml-2 w-5 h-5" /></a>
              </Button>
              <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 h-16 px-10 rounded-2xl backdrop-blur-md text-white" asChild>
                <Link href="/legal/bot-policy">Transparency Protocol</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="bg-white/[0.01] border-y border-white/5 py-24">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: ShoppingCart, title: "Pixel Audit", desc: "Real-time tracking of marketing pixels and third-party script behavior to prevent unauthorized data leaks." },
                { icon: ShieldCheck, title: "GDPR Compliance", desc: "Automated verification of consent management platforms across global retail domains." },
                { icon: Lock, title: "Security Hardening", desc: "Monitoring CSP, HSTS, and SSL standards on production storefronts to maintain retail integrity." },
                { icon: Activity, title: "Flow Integrity", desc: "Identifying technical errors in critical checkout stages and product catalog accessibility." },
              ].map((item, i) => (
                <div key={i} className="group p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-primary/20 hover:bg-white/[0.04] transition-all duration-500">
                  <div className="bg-primary/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-light">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="container mx-auto px-6 py-32">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-10">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight">Our Enterprise Mission</h2>
                <p className="text-lg text-slate-400 font-light leading-relaxed">
                  We bridge the gap between complex retail operations and stringent global regulations. HumangoSFCC acts as your external auditor, providing transparency into your digital footprint.
                </p>
              </div>
              
              <div className="space-y-6">
                {[
                  { title: "Stateless Monitoring", text: "We perform deep audits without storing sensitive customer data or cookies." },
                  { title: "Infrastructure Audit", text: "Continuous verification that Business Manager changes meet security standards." },
                  { title: "Risk Mitigation", text: "Early detection of compliance issues before they escalate into regulatory fines." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5">
                    <div className="bg-primary/20 p-1.5 rounded-full h-fit mt-1">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold mb-1">{item.title}</h4>
                      <p className="text-sm text-slate-500 font-light">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
              <Card className="relative bg-[#0b1120] border-white/10 p-10 rounded-[3rem] shadow-2xl overflow-hidden group">
                <div className="absolute top-0 right-0 p-8">
                  <FileBarChart className="w-16 h-16 text-primary opacity-20" />
                </div>
                <CardHeader className="p-0 mb-8">
                  <CardTitle className="text-3xl font-bold text-white">Retail Integrity <br />Report</CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-8">
                  <p className="text-slate-400 font-light leading-relaxed">
                    Our platform generates technical evidence of compliance, helping global brands maintain trust with their customers and regulators.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                      <p className="text-2xl font-bold text-white">100%</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Stateless Audit</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5">
                      <p className="text-2xl font-bold text-white">Global</p>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Scale Coverage</p>
                    </div>
                  </div>
                  <Button className="w-full h-14 bg-primary text-white font-bold rounded-2xl text-base group-hover:shadow-xl group-hover:shadow-primary/20 transition-all">
                    Request Demo Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-16 px-6 border-t border-white/5 bg-[#010413]/50">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <span className="text-sm font-bold tracking-widest text-white uppercase">Humango Enterprise Integrity</span>
            </div>
            <div className="flex flex-wrap justify-center gap-10">
              <Link href="/legal/privacy" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Privacy Statement</Link>
              <Link href="/legal/bot-policy" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Bot Policy</Link>
              <Link href="https://humango.app" className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Main Portal</Link>
            </div>
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">
              &copy; {new Date().getFullYear()} Global Infrastructure Group
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
