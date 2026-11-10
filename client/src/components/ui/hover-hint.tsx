import { useState, type ReactElement, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * A description shown on mouse hover (and keyboard focus) over an (i) or a
 * lock, for a laptop, where opening every rule with a click is slow. A
 * touch screen never opens it: there the (i) still opens its rule inline
 * with a tap, and a lock's reason is said beside it.
 *
 * `suppressed` keeps it shut, e.g. while the (i)'s rule is already open
 * inline below it. The tooltip is always mounted, so the trigger keeps its
 * focus when that changes.
 *
 * `wrap` puts the trigger in a span: a disabled button gets no pointer
 * events, so it can't be hovered itself.
 */
export const HoverHint = ({
  text,
  suppressed = false,
  wrap = false,
  side = 'top',
  children,
}: {
  text: ReactNode;
  suppressed?: boolean;
  wrap?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip
      delayDuration={150}
      open={open && !suppressed && !!text}
      onOpenChange={setOpen}
    >
      <TooltipTrigger asChild>
        {wrap ? <span className="grid min-w-0">{children}</span> : children}
      </TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipContent
          side={side}
          collisionPadding={8}
          className="max-w-64 text-balance text-xs leading-relaxed"
        >
          {text}
        </TooltipContent>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
};
