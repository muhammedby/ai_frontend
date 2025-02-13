'use client';

import { useEffect } from 'react';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    document.documentElement.removeAttribute('data-darkreader-mode');
    document.documentElement.removeAttribute('data-darkreader-scheme');
    document.documentElement.removeAttribute('data-darkreader-proxy-injected');
  }, []);

  return <>{children}</>;
} 