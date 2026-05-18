
'use client';

import React, { useState } from 'react';
import { loginAction } from '@/app/actions/auth-actions';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import { Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result.success) {
      toast({ title: "Успешный вход", description: "Добро пожаловать в терминал." });
      router.push('/manager');
      router.refresh();
    } else {
      toast({ 
        variant: "destructive", 
        title: "Ошибка входа", 
        description: result.error || "Неверный email или пароль." 
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-body">
      <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <Image src="/logo.png" alt="Logo" width={64} height={64} priority />
          <h1 className="text-2xl font-bold tracking-tight text-white">Вход в терминал</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email</label>
            <Input 
              name="email"
              type="email" 
              placeholder="abuse@humango.app" 
              className="bg-white/5 border-white/10 h-12 text-white"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Пароль</label>
            <Input 
              name="password"
              type="password" 
              placeholder="••••••••" 
              className="bg-white/5 border-white/10 h-12 text-white"
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 bg-primary mt-4 font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            {loading ? "Авторизация..." : "Войти"}
          </Button>
        </form>
        <div className="text-center">
          <Link href="/" className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-bold">
            Вернуться на главную
          </Link>
        </div>
      </Card>
    </div>
  );
}
