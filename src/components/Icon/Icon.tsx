import { icons } from './icons';
import type { IconName } from './icons';
import './Icon.css';

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  'aria-label'?: string;
}

export function Icon({ name, size = 16, className, 'aria-label': ariaLabel }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon${className ? ` ${className}` : ''}`}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      dangerouslySetInnerHTML={{ __html: icons[name] }}
    />
  );
}
