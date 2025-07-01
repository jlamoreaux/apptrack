/**
 * Accessible Form Components
 * 
 * Provides form components that meet WCAG 2.1 AA requirements including
 * proper labeling, error handling, and keyboard navigation.
 */

import React, { forwardRef, useId } from 'react'
import { cn } from '@/lib/utils'

interface AccessibleFormFieldProps {
  label: string
  error?: string
  required?: boolean
  description?: string
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement> | React.SelectHTMLAttributes<HTMLSelectElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>>
  className?: string
}

export function AccessibleFormField({
  label,
  error,
  required = false,
  description,
  children,
  className
}: AccessibleFormFieldProps) {
  const fieldId = useId()
  const errorId = `${fieldId}-error`
  const descriptionId = `${fieldId}-description`

  // Clone the child element and add accessibility attributes
  const childWithProps = children ? 
    React.cloneElement(children, {
      id: fieldId,
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': [
        error ? errorId : null,
        description ? descriptionId : null
      ].filter(Boolean).join(' ') || undefined,
      'aria-required': required
    }) : null

  return (
    <div className={cn('space-y-2', className)}>
      <label 
        htmlFor={fieldId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && (
          <span 
            className="text-destructive ml-1" 
            aria-label="required field"
          >
            *
          </span>
        )}
      </label>
      
      {description && (
        <p 
          id={descriptionId}
          className="text-sm text-muted-foreground"
        >
          {description}
        </p>
      )}
      
      <div className="relative">
        {childWithProps}
      </div>
      
      {error && (
        <p 
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}

interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          // Base styles
          'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          // Focus styles for accessibility
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Error styles
          error && 'border-destructive focus-visible:ring-destructive',
          // Disabled styles
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
AccessibleInput.displayName = 'AccessibleInput'

interface AccessibleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ className, error, options, placeholder, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          // Base styles
          'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          // Focus styles for accessibility
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Error styles
          error && 'border-destructive focus-visible:ring-destructive',
          // Disabled styles
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }
)
AccessibleSelect.displayName = 'AccessibleSelect'

interface AccessibleTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const AccessibleTextarea = forwardRef<HTMLTextAreaElement, AccessibleTextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // Base styles
          'flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          // Focus styles for accessibility
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Error styles
          error && 'border-destructive focus-visible:ring-destructive',
          // Disabled styles
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    )
  }
)
AccessibleTextarea.displayName = 'AccessibleTextarea'

interface AccessibleFieldsetProps {
  legend: string
  children: React.ReactNode
  className?: string
}

export function AccessibleFieldset({ legend, children, className }: AccessibleFieldsetProps) {
  return (
    <fieldset className={cn('space-y-4', className)}>
      <legend className="text-sm font-medium text-foreground">
        {legend}
      </legend>
      <div className="space-y-3">
        {children}
      </div>
    </fieldset>
  )
}

interface AccessibleRadioGroupProps {
  name: string
  options: { value: string; label: string; description?: string }[]
  value?: string
  onChange?: (value: string) => void
  error?: string
  className?: string
}

export function AccessibleRadioGroup({
  name,
  options,
  value,
  onChange,
  error,
  className
}: AccessibleRadioGroupProps) {
  const groupId = useId()
  const errorId = `${groupId}-error`

  return (
    <div 
      className={cn('space-y-3', className)}
      role="radiogroup"
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? errorId : undefined}
    >
      {options.map((option) => {
        const optionId = `${groupId}-${option.value}`
        
        return (
          <div key={option.value} className="flex items-start space-x-3">
            <input
              type="radio"
              id={optionId}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange?.(e.target.value)}
              className={cn(
                'mt-1 h-4 w-4 border-2 border-input',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                error && 'border-destructive'
              )}
            />
            <div className="space-y-1">
              <label 
                htmlFor={optionId}
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                {option.label}
              </label>
              {option.description && (
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
      
      {error && (
        <p 
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export default AccessibleFormField