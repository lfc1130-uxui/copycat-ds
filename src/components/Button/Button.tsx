import React from 'react';
import { Icon } from '../Icon';
import type { IconName } from '../Icon/icons';
import './Button.css';

export type ButtonVariant      = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize         = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:       ButtonVariant;
  size?:          ButtonSize;
  /** Icon to render inside the button */
  icon?:          IconName;
  /** Position of the icon relative to label (default: 'leading') */
  iconPosition?:  'leading' | 'trailing';
  /** Replace label with a centred spinner; button keeps its natural width. */
  loading?:       boolean;
  fullWidth?:     boolean;
  children:       React.ReactNode;
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

export function Button({
  variant      = 'primary',
  size         = 'md',
  icon,
  iconPosition = 'leading',
  loading      = false,
  fullWidth    = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    loading   && 'btn--loading',
    fullWidth && 'btn--full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconEl = icon
    ? <Icon name={icon} size={ICON_SIZE[size]} />
    : null;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="btn__spinner" aria-hidden="true" />
          <span className="btn__ghost" aria-hidden="true">{children}</span>
        </>
      ) : (
        <>
          {iconPosition === 'leading'  && iconEl}
          {children}
          {iconPosition === 'trailing' && iconEl}
        </>
      )}
    </button>
  );
}
