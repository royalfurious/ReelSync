import * as React from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white placeholder:text-white/35 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}