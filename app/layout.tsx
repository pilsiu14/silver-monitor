import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Silver Squeeze Monitor',
  description: 'COMEX × Shanghai · paper vs physical · daily edition',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg text-[#e8e8e3] font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
