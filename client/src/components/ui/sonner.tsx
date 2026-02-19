import { ComponentProps } from 'react';
import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/contexts';

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? 'dark' : 'light';

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          warning:
            'group-[.toaster]:!bg-yellow-950 group-[.toaster]:!border-yellow-500 group-[.toaster]:!text-yellow-100',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
