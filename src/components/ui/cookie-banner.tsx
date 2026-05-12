
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, X } from 'lucide-react';

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('humango_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const acceptConsent = () => {
    localStorage.setItem('humango_cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 z-[100] animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="bg-[#0b1120] border border-white/10 p-6 rounded-3xl shadow-2xl backdrop-blur-xl max-w-2xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4 text-left">
          <div className="bg-primary/20 p-3 rounded-2xl shrink-0">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-white font-bold text-sm">Compliance Transparency</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              We use essential technical cookies to ensure the portal operates securely. By using our site, you acknowledge our commitment to statutory compliance and GDPR transparency.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4 mr-2" /> Decline
          </Button>
          <Button size="sm" onClick={acceptConsent} className="bg-primary font-bold px-6">
            Accept Essential
          </Button>
        </div>
      </div>
    </div>
  );
}
