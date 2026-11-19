import * as React from 'react';
import { cn } from '../../lib/utils';

/** Alerta de error. Siempre `role="alert"` para que los lectores de pantalla la anuncien. */
export const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
        className
      )}
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';
