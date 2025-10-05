import React from 'react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'centered' | 'wide';
  background?: 'default' | 'gradient' | 'glass';
}

export function Layout({ 
  children, 
  className, 
  variant = 'default',
  background = 'default' 
}: LayoutProps) {
  const layoutClasses = cn(
    'min-h-screen transition-all duration-300',
    {
      // Variants
      'flex flex-col': variant === 'default',
      'flex flex-col items-center justify-center': variant === 'centered',
      'w-full': variant === 'wide',
      
      // Backgrounds
      'bg-background': background === 'default',
      'bg-gradient-to-br from-background via-background to-muted/20': background === 'gradient',
      'relative overflow-hidden': background === 'glass',
    },
    className
  );

  return (
    <div className={layoutClasses}>
      {background === 'glass' && (
        <div className="absolute inset-0 bg-gradient-to-br from-team-primary/5 via-transparent to-team-secondary/5 pointer-events-none" />
      )}
      {children}
    </div>
  );
}

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Container({ children, className, size = 'lg' }: ContainerProps) {
  const containerClasses = cn(
    'mx-auto px-4 sm:px-6 lg:px-8',
    {
      'max-w-2xl': size === 'sm',
      'max-w-4xl': size === 'md', 
      'max-w-6xl': size === 'lg',
      'max-w-7xl': size === 'xl',
      'max-w-none': size === 'full',
    },
    className
  );

  return <div className={containerClasses}>{children}</div>;
}

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Section({ children, className, spacing = 'md' }: SectionProps) {
  const sectionClasses = cn(
    {
      'py-8': spacing === 'sm',
      'py-12 md:py-16': spacing === 'md',
      'py-16 md:py-24': spacing === 'lg', 
      'py-24 md:py-32': spacing === 'xl',
    },
    className
  );

  return <section className={sectionClasses}>{children}</section>;
}