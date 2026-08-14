"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Play, User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export function MainNav() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const payload = (await response.json()) as { user: AuthUser | null };
        setCurrentUser(payload.user);
      } catch {
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const signOut = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setCurrentUser(null);
    setShowUserMenu(false);
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Play className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold text-white">ReelSync</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <Link className="text-sm text-white/70 transition hover:text-white" href="#features">
            Features
          </Link>
          <Link className="text-sm text-white/70 transition hover:text-white" href="#how-it-works">
            How it Works
          </Link>
          
          {!loading && (
            <>
              {currentUser ? (
                <div className="relative" ref={menuRef}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2"
                  >
                    <User className="h-4 w-4" />
                    {currentUser.name}
                  </Button>
                  
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-xl backdrop-blur">
                      <div className="mb-2 border-b border-white/10 px-3 py-2">
                        <p className="text-xs text-white/50">Signed in as</p>
                        <p className="truncate text-sm font-medium text-white">{currentUser.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void signOut()}
                        className="w-full justify-start text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign out
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href="/auth">
                  Sign in
                </Link>
              )}
              
              <Link className={buttonVariants({ size: 'sm', className: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' })} href="/create">
                Create Room
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
