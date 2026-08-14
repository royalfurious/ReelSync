"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type AuthMode = 'register' | 'login';

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadMe = async () => {
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

    void loadMe();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(mode === 'register' ? { name } : {}),
          email,
          password
        })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Unable to complete authentication.');
      }

      const payload = (await response.json()) as { user: AuthUser };
      setCurrentUser(payload.user);
      router.push('/');
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : 'Unable to complete authentication.');
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setCurrentUser(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Register or sign in to keep your identity consistent across rooms.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? <p className="text-sm text-white/55">Loading session…</p> : null}
        {!loading && currentUser ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
            <p className="font-medium text-white">Signed in as {currentUser.name}</p>
            <p>{currentUser.email}</p>
            <Button variant="secondary" type="button" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button type="button" variant={mode === 'register' ? 'default' : 'secondary'} onClick={() => setMode('register')}>
                Register
              </Button>
              <Button type="button" variant={mode === 'login' ? 'default' : 'secondary'} onClick={() => setMode('login')}>
                Sign in
              </Button>
            </div>

            <form className="space-y-4" onSubmit={submit}>
              {mode === 'register' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/80" htmlFor="name">
                    Display name
                  </label>
                  <Input id="name" required minLength={2} maxLength={40} value={name} onChange={(event) => setName(event.target.value)} />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80" htmlFor="email">
                  Email
                </label>
                <Input id="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80" htmlFor="password">
                  Password
                </label>
                <Input id="password" required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? 'Working…' : mode === 'register' ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}