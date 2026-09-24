import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CliniDesk - Gestão & Remarcação Inteligente de Consultas',
  description: 'Plataforma SaaS B2B com IA Conversacional e Tool Calling para automação de consultas via WhatsApp.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
