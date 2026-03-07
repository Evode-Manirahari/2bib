import { cn } from '@/lib/utils';

type Variant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: number }) {
  const variant: Variant =
    status < 300 ? 'success' : status < 400 ? 'info' : status < 500 ? 'warning' : 'error';
  return <Badge variant={variant}>{status}</Badge>;
}

export function RunStatusBadge({ status }: { status: string }) {
  const variant: Variant =
    status === 'PASSED' ? 'success'
    : status === 'FAILED' ? 'warning'
    : status === 'ERROR' ? 'error'
    : status === 'RUNNING' ? 'info'
    : 'neutral';
  return <Badge variant={variant}>{status}</Badge>;
}

export function StepStatusBadge({ status }: { status: string }) {
  const variant: Variant =
    status === 'pass' ? 'success'
    : status === 'fail' ? 'warning'
    : status === 'error' ? 'error'
    : 'neutral';
  return <Badge variant={variant}>{status}</Badge>;
}

export function PAStatusBadge({ status }: { status: string }) {
  const variant: Variant =
    ['APPROVED', 'APPEAL_APPROVED'].includes(status) ? 'success'
    : ['DENIED', 'APPEAL_DENIED'].includes(status) ? 'error'
    : ['SUBMITTED', 'PENDING_REVIEW', 'APPEAL_SUBMITTED', 'APPEAL_REVIEW'].includes(status) ? 'info'
    : 'warning';
  return <Badge variant={variant}>{status.replace(/_/g, ' ')}</Badge>;
}
