import React from 'react';
import { ModernNavigation } from './ModernNavigation';
import { Layout } from './Layout';

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'centered' | 'wide';
  background?: 'default' | 'gradient' | 'glass';
  navVariant?: 'default' | 'transparent';
}

export function MainLayout({ 
  children, 
  className,
  variant = 'default',
  background = 'default',
  navVariant = 'default'
}: MainLayoutProps) {
  return (
    <Layout className="min-h-screen" variant="default" background={background}>
      <ModernNavigation variant={navVariant} />
      <main className="flex-1">
        <Layout 
          className={className} 
          variant={variant === 'default' ? undefined : variant}
          background="default"
        >
          {children}
        </Layout>
      </main>
    </Layout>
  );
}