import type React from 'react';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import './globals.css';

const bodyFont = Inter({ subsets: ['latin'], variable: '--font-body' });
const displayFont = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'ReelSync',
  description: 'Private watch rooms with synchronized local media and real-time chat.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${bodyFont.variable} ${displayFont.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}