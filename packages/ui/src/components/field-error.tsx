import type { ComponentProps } from 'react';
import { cn } from '../lib/utils';

// Link this id through the input's aria-describedby and set aria-invalid there.
export function FieldError({ id, className, ...props }: ComponentProps<'p'> & { id: string }) {
  return <p id={id} role="alert" className={cn('text-sm text-destructive', className)} {...props} />;
}
