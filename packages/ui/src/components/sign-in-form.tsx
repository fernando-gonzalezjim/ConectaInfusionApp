import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { LoginInput } from '@conecta/contracts';
import { Button } from './button';
import { Input } from './input';

export interface SignInLabels {
  email: string; password: string; rememberMe: string; rememberHint: string; signIn: string; signingIn: string;
}
export function SignInForm({ labels, pending, error, onSubmit }: {
  labels: SignInLabels; pending: boolean; error: string | null; onSubmit: (input: LoginInput) => Promise<void>;
}) {
  const id = useId(); const errorRef = useRef<HTMLParagraphElement>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [rememberMe, setRememberMe] = useState(false);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    try { await onSubmit({ email, password, rememberMe }); }
    finally { setPassword(''); }
  }
  return <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
    {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-md bg-muted p-3 text-sm text-destructive">{error}</p>}
    <fieldset disabled={pending} className="space-y-5">
      <div><label htmlFor={`${id}-email`} className="mb-2 block text-sm font-medium">{labels.email}</label>
        <Input id={`${id}-email`} type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={320} value={email} onChange={event => setEmail(event.target.value)} /></div>
      <div><label htmlFor={`${id}-password`} className="mb-2 block text-sm font-medium">{labels.password}</label>
        <Input id={`${id}-password`} type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} /></div>
      <div><label className="flex min-h-11 items-center gap-3 text-sm" htmlFor={`${id}-remember`}>
        <input id={`${id}-remember`} type="checkbox" className="h-5 w-5 accent-primary" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} aria-describedby={`${id}-hint`} />{labels.rememberMe}</label>
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted-foreground">{labels.rememberHint}</p></div>
      <Button type="submit" className="min-h-11 w-full">{pending ? labels.signingIn : labels.signIn}</Button>
    </fieldset>
  </form>;
}
