
'use client';

import React, { useState } from 'react';
import { useFirebase } from '@/components/providers/firebase-provider';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from 'next/image';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { auth } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Устанавливаем куку для совместимости с существующей Middleware
      document.cookie = "admin_authenticated=true; path=/; max-age=3600; SameSite=Strict";
      toast({ title: "Успешный вход", description: "Перенаправление в панель управления..." });
      router.push('/admin');
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Ошибка входа", 
        description: "Неверный email или пароль." 
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-body">
      <Card className="w-full max-w-md bg-white/[0.03] border-white/10 backdrop-blur-xl shadow-2xl p-8 space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <Image src="/logo.png" alt="Logo" width={64} height={64} priority />
          <h1 className="text-2xl font-bold tracking-tight">Вход в систему</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email</label>
            <Input 
              type="email" 
              placeholder="admin@humango.app" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/5 border-white/10 h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Пароль</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/5 border-white/10 h-12"
              required
            />
          </div>
          <Button type="submit" className="w-full h-12 bg-primary mt-4 font-bold">
            <Lock className="w-4 h-4 mr-2" /> Войти в терминал
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
