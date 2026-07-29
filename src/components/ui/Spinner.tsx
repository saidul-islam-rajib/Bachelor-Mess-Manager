const SIZE_CLASSES = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]'
} as const;

export type SpinnerSize = keyof typeof SIZE_CLASSES;

export function Spinner({ size = 'md', className = '' }: { size?: SpinnerSize; className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-block animate-spin rounded-full border-current border-r-transparent align-[-0.125em] ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}

export default Spinner;
