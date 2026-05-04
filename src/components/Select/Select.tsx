import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { Icon } from '../Icon';
import type { IconName } from '../Icon/icons';
import './Select.css';

export type SelectSize            = 'sm' | 'md' | 'lg';
export type SelectValidationState = 'default' | 'error' | 'success' | 'loading';

export interface SelectOption {
  value:     string;
  label:     string;
  disabled?: boolean;
}

export interface SelectProps {
  options:          SelectOption[];
  value?:           string;
  defaultValue?:    string;
  onChange?:        (value: string) => void;
  placeholder?:     string;
  size?:            SelectSize;
  label?:           string;
  helperText?:      string;
  errorMessage?:    string;
  validationState?: SelectValidationState;
  leadingIcon?:     IconName;
  fullWidth?:       boolean;
  disabled?:        boolean;
  required?:        boolean;
  id?:              string;
  name?:            string;
  className?:       string;
}

const ICON_SIZE: Record<SelectSize, number> = { sm: 14, md: 16, lg: 16 };

export function Select({
  options,
  value:         controlledValue,
  defaultValue,
  onChange,
  placeholder,
  size            = 'md',
  label,
  helperText,
  errorMessage,
  validationState = 'default',
  leadingIcon,
  fullWidth       = false,
  disabled,
  required,
  id,
  name,
  className,
}: SelectProps) {
  const autoId    = useId();
  const selectId  = id ?? autoId;
  const listboxId = `${selectId}-listbox`;

  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const value = isControlled ? controlledValue : internalValue;

  const [isOpen,     setIsOpen]     = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);

  const rootRef    = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const iconSize       = ICON_SIZE[size];
  const selectedOption = options.find(o => o.value === value) ?? null;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Scroll focused option into view
  useEffect(() => {
    if (!isOpen || focusedIdx < 0 || !listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[focusedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIdx, isOpen]);

  const commit = useCallback((val: string) => {
    if (!isControlled) setInternalValue(val);
    onChange?.(val);
    setIsOpen(false);
    setFocusedIdx(-1);
    triggerRef.current?.focus();
  }, [isControlled, onChange]);

  const open = useCallback(() => {
    if (disabled) return;
    const idx = value ? options.findIndex(o => o.value === value) : options.findIndex(o => !o.disabled);
    setFocusedIdx(idx >= 0 ? idx : 0);
    setIsOpen(true);
  }, [disabled, value, options]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusedIdx(-1);
    triggerRef.current?.focus();
  }, []);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); open(); }
    if (e.key === 'ArrowUp')  { e.preventDefault(); open(); }
    if (e.key === 'Escape')   { close(); }
  };

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIdx(i => {
        let next = i + 1;
        while (next < options.length && options[next].disabled) next++;
        return next < options.length ? next : i;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIdx(i => {
        let prev = i - 1;
        while (prev >= 0 && options[prev].disabled) prev--;
        return prev >= 0 ? prev : i;
      });
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIdx(options.findIndex(o => !o.disabled));
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = [...options].reverse().findIndex(o => !o.disabled);
      if (last >= 0) setFocusedIdx(options.length - 1 - last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (focusedIdx >= 0 && !options[focusedIdx]?.disabled) commit(options[focusedIdx].value);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  };

  const helperContent = validationState === 'error' && errorMessage ? errorMessage : helperText;
  const helperClass   = [
    'select-helper',
    validationState === 'error'   && errorMessage ? 'select-helper--error'   : '',
    validationState === 'success'                 ? 'select-helper--success' : '',
  ].filter(Boolean).join(' ');

  const trailingIcon: IconName =
    validationState === 'success' ? 'check-circle' :
    validationState === 'error'   ? 'error'         :
    'chevron-down';

  const trailingColorClass =
    validationState === 'success' ? 'select-icon--success' :
    validationState === 'error'   ? 'select-icon--error'   :
    '';

  const triggerClass = [
    'select-trigger',
    `select-trigger--${size}`,
    `select-trigger--${validationState}`,
    disabled       && 'select-trigger--disabled',
    isOpen         && 'select-trigger--open',
    !!leadingIcon  && 'select-trigger--has-leading-icon',
    !value         && 'select-trigger--placeholder',
    fullWidth      && 'select-trigger--full',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={`select-root${fullWidth ? ' select-root--full' : ''}`}>
      {label && (
        <label htmlFor={selectId} className="select-label">
          {label}
          {required && <span className="select-required" aria-hidden="true"> *</span>}
        </label>
      )}

      <div className={`select-positioner${fullWidth ? ' select-positioner--full' : ''}`}>
        {name && <input type="hidden" name={name} value={value} />}

        <button
          ref={triggerRef}
          id={selectId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-invalid={validationState === 'error' || undefined}
          aria-describedby={helperContent ? `${selectId}-helper` : undefined}
          aria-required={required}
          className={triggerClass}
          disabled={disabled}
          onClick={() => isOpen ? close() : open()}
          onKeyDown={handleTriggerKeyDown}
        >
          {leadingIcon && (
            <span className="select-icon select-icon--leading" aria-hidden="true">
              <Icon name={leadingIcon} size={iconSize} />
            </span>
          )}

          <span className="select-trigger-label">
            {selectedOption ? selectedOption.label : (placeholder ?? 'Select…')}
          </span>

          {validationState === 'loading' ? (
            <span className="select-spinner" aria-label="Loading" />
          ) : (
            <span
              className={[
                'select-icon select-icon--trailing',
                isOpen            ? 'select-icon--chevron-open' : '',
                trailingColorClass,
              ].filter(Boolean).join(' ')}
              aria-hidden="true"
            >
              <Icon name={trailingIcon} size={iconSize} />
            </span>
          )}
        </button>

        {isOpen && (
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label={label ?? placeholder}
            className="select-dropdown"
            onKeyDown={handleListKeyDown}
            tabIndex={-1}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused  = idx === focusedIdx;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  className={[
                    'select-option',
                    isSelected   && 'select-option--selected',
                    isFocused    && 'select-option--focused',
                    opt.disabled && 'select-option--disabled',
                  ].filter(Boolean).join(' ')}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => !opt.disabled && commit(opt.value)}
                  onMouseEnter={() => !opt.disabled && setFocusedIdx(idx)}
                >
                  <span className="select-option-label">{opt.label}</span>
                  {isSelected && (
                    <span className="select-option-check" aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {helperContent && (
        <p id={`${selectId}-helper`} className={helperClass}>
          {helperContent}
        </p>
      )}
    </div>
  );
}
