import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SpendSmart AI — Airwallex Adaptive Treasury Controller',
  description:
    'Autonomous Multi-Currency Treasury Decision Engine & Sandbox Executor built on Airwallex Starter Kit #01',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-navy-950 text-slate-100 antialiased selection:bg-teal-500 selection:text-navy-950">
        {children}
      </body>
    </html>
  );
}
