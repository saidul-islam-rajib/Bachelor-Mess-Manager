import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Spinner';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'dashed'
  | 'inverse'
  | 'inverseSecondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-slate-900 text-white hover:bg-slate-700 disabled:hover:bg-slate-900 focus-visible:outline-slate-900',
  secondary:
    'border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:hover:bg-transparent focus-visible:outline-slate-900',
  danger:
    'border border-red-200 text-red-600 hover:bg-red-50 disabled:hover:bg-transparent focus-visible:outline-red-600',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-slate-900',
  dashed:
    'w-full border border-dashed border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-900',
  inverse: 'bg-white text-slate-900 hover:bg-slate-200 disabled:hover:bg-white focus-visible:outline-white',
  inverseSecondary:
    'border border-slate-500 text-white hover:border-slate-300 hover:bg-white/10 disabled:hover:bg-transparent focus-visible:outline-white'
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base'
};

const BASE_CLASSES =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = ''
}: Pick<BaseProps, 'variant' | 'size' | 'fullWidth' | 'className'>) {
  return [BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className = '', children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});

export type LinkButtonProps = BaseProps & { href: string; onClick?: () => void };

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  onClick
}: LinkButtonProps) {
  return (
    <Link href={href} onClick={onClick} className={buttonClasses({ variant, size, fullWidth, className })}>
      {children}
    </Link>
  );
}

export default Button;
