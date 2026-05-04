import React, { useState, useId } from 'react';
import { Icon } from '../Icon';
import type { IconName } from '../Icon/icons';
import './Input.css';

export type InputSize            = 'sm' | 'md' | 'lg';
export type InputValidationState = 'default' | 'error' | 'success' | 'loading';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?:            InputSize;
  label?:           string;
  helperText?:      string;
  errorMessage?:    string;
  validationState?: InputValidationState;
  leadingIcon?:     IconName;
  trailingIcon?:    IconName;
  prefix?:          string;
  suffix?:          string;
  fullWidth?:       boolean;
}

const ICON_SIZE: Record<InputSize, number> = { sm: 14, md: 16, lg: 16 };

export function Input({
  size            = 'md',
  label,
  helperText,
  errorMessage,
  validationState = 'default',
  leadingIcon,
  trailingIcon,
  prefix,
  suffix,
  fullWidth       = false,
  disabled,
  readOnly,
  required,
  type            = 'text',
  id,
  className,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && showPassword ? 'text' : type;

  // Trailing slot priority: loading spinner > success icon > error icon > password toggle > trailingIcon
  const showSpinner = validationState === 'loading';
  const showSuccess = validationState === 'success';
  const showError   = validationState === 'error';

  const trailingIconName: IconName | null =
    showSuccess  ? 'check-circle' :
    showError    ? 'error'        :
    isPassword   ? (showPassword ? 'eye-off' : 'eye') :
    trailingIcon ?? null;

  const hasTrailing   = showSpinner || trailingIconName !== null;
  const hasLeadingIcon = !!leadingIcon;
  const hasPrefix      = !!prefix;

  const wrapperClasses = [
    'input-wrapper',
    `input-wrapper--${size}`,
    `input-wrapper--${validationState}`,
    disabled      && 'input-wrapper--disabled',
    readOnly      && 'input-wrapper--readonly',
    hasLeadingIcon && 'input-wrapper--has-leading-icon',
    hasPrefix      && 'input-wrapper--has-prefix',
    hasTrailing    && 'input-wrapper--has-trailing',
    fullWidth      && 'input-wrapper--full',
    className,
  ].filter(Boolean).join(' ');

  const helperContent = validationState === 'error' && errorMessage
    ? errorMessage
    : helperText;

  const helperClass = [
    'input-helper',
    validationState === 'error' && errorMessage ? 'input-helper--error' : '',
    validationState === 'success' ? 'input-helper--success' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={`input-root${fullWidth ? ' input-root--full' : ''}`}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
          {required && <span className="input-required" aria-hidden="true"> *</span>}
        </label>
      )}

      <div className={wrapperClasses}>
        {prefix && <span className="input-prefix">{prefix}</span>}
        {!prefix && leadingIcon && (
          <span className="input-icon input-icon--leading" aria-hidden="true">
            <Icon name={leadingIcon} size={ICON_SIZE[size]} />
          </span>
        )}

        <input
          id={inputId}
          type={resolvedType}
          className="input-field"
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={validationState === 'error' || undefined}
          aria-describedby={helperContent ? `${inputId}-helper` : undefined}
          {...props}
        />

        {suffix && <span className="input-suffix">{suffix}</span>}

        {!suffix && showSpinner && (
          <span className="input-spinner" aria-label="Loading" />
        )}

        {!suffix && !showSpinner && trailingIconName && (
          <span
            className={[
              'input-icon input-icon--trailing',
              (isPassword) ? 'input-icon--interactive' : '',
              showSuccess   ? 'input-icon--success' : '',
              showError     ? 'input-icon--error'   : '',
            ].filter(Boolean).join(' ')}
            aria-hidden={!isPassword || undefined}
            role={isPassword ? 'button' : undefined}
            tabIndex={isPassword ? 0 : undefined}
            onClick={isPassword ? () => setShowPassword(v => !v) : undefined}
            onKeyDown={isPassword ? (e) => { if (e.key === 'Enter' || e.key === ' ') setShowPassword(v => !v); } : undefined}
            aria-label={isPassword ? (showPassword ? 'Hide password' : 'Show password') : undefined}
          >
            <Icon name={trailingIconName} size={ICON_SIZE[size]} />
          </span>
        )}
      </div>

      {helperContent && (
        <p id={`${inputId}-helper`} className={helperClass}>
          {helperContent}
        </p>
      )}
    </div>
  );
}
