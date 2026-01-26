'use client';

import { ReactNode } from 'react';
import { getTextDirection, containsRTL } from '@/lib/rtl';

interface DirectionalTextProps {
  children: ReactNode;
  text?: string;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'li';
  className?: string;
}

/**
 * A component that automatically detects text direction (RTL/LTR)
 * and applies appropriate styling
 */
export function DirectionalText({
  children,
  text,
  as: Component = 'span',
  className = '',
}: DirectionalTextProps) {
  // Get text content for direction detection
  const textContent = text || (typeof children === 'string' ? children : '');
  const direction = getTextDirection(textContent);
  const isRTL = direction === 'rtl' || containsRTL(textContent);

  return (
    <Component
      dir={direction}
      className={`${isRTL ? 'text-right' : ''} ${className}`}
      style={{ unicodeBidi: 'plaintext' }}
    >
      {children}
    </Component>
  );
}

/**
 * Hook to get direction-aware class names
 */
export function useTextDirection(text: string) {
  const direction = getTextDirection(text);
  const isRTL = direction === 'rtl';

  return {
    direction,
    isRTL,
    className: isRTL ? 'text-right' : '',
    props: {
      dir: direction,
      style: { unicodeBidi: 'plaintext' as const },
    },
  };
}
