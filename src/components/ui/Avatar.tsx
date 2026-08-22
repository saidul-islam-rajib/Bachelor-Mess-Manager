import { initialsOf } from '@/lib/format';

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-20 w-20 text-xl'
} as const;

export type AvatarSize = keyof typeof SIZE_CLASSES;

export type AvatarProps = {
  name: string;
  image?: string | null;
  size?: AvatarSize;
  muted?: boolean;
  className?: string;
};

export function Avatar({ name, image, size = 'md', muted = false, className = '' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ${muted ? 'opacity-60' : ''} ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-medium ${
        muted ? 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
      } ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}

export default Avatar;
