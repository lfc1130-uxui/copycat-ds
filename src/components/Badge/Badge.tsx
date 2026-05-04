import React from 'react';
import './Badge.css';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize    = 'sm' | 'md';

export interface BadgeProps {
  variant?:  BadgeVariant;
  size?:     BadgeSize;
  children:  React.ReactNode;
  className?: string;
}

export function Badge({
  variant   = 'default',
  size      = 'md',
  children,
  className,
}: BadgeProps) {
  const classes = [
    'badge',
    `badge--${variant}`,
    `badge--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
