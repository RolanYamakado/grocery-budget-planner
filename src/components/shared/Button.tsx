import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-full px-5 py-2.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-terracotta text-white hover:bg-terracotta-dark',
        variant === 'secondary' && 'bg-white text-olive-dark border border-olive hover:bg-olive/10',
        variant === 'ghost' && 'text-stone-600 hover:bg-stone-100',
        className,
      )}
      {...props}
    />
  );
}
