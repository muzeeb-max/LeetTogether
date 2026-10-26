import React from 'react';

export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const Surface = ({ children, className = '', as: Component = 'div', ...props }) => (
  <Component className={cn('surface-card rounded-2xl', className)} {...props}>{children}</Component>
);

export const SectionHeading = ({ eyebrow, title, description, action, className = '' }) => (
  <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>}
    </div>
    {action}
  </div>
);

const difficultyTokens = {
  easy: 'border-emerald-400/15 bg-emerald-400/10 text-emerald-300',
  medium: 'border-amber-400/15 bg-amber-400/10 text-amber-200',
  hard: 'border-rose-400/15 bg-rose-400/10 text-rose-300'
};

export const DifficultyBadge = ({ difficulty, className = '' }) => {
  const value = String(difficulty || 'challenge').toLowerCase();
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize', difficultyTokens[value] || 'border-white/10 bg-white/5 text-zinc-300', className)}>
      {value}
    </span>
  );
};

export const MetricCard = ({ label, value, detail, icon: Icon, accent = 'violet', className = '' }) => {
  const accents = {
    violet: 'bg-violet-400/10 text-violet-300 ring-violet-400/10',
    cyan: 'bg-cyan-400/10 text-cyan-300 ring-cyan-400/10',
    green: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/10',
    amber: 'bg-amber-400/10 text-amber-200 ring-amber-400/10'
  };
  return (
    <Surface className={cn('interactive-card p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
          {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
        </div>
        {Icon && <span className={cn('grid h-10 w-10 place-items-center rounded-xl ring-1', accents[accent] || accents.violet)}><Icon className="h-[18px] w-[18px]" /></span>}
      </div>
    </Surface>
  );
};

export const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    {Icon && <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-zinc-400 ring-1 ring-white/[0.07]"><Icon className="h-5 w-5" /></span>}
    <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
    {description && <p className="mt-1.5 max-w-sm text-sm leading-6 text-zinc-500">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Avatar = ({ src, name = 'Member', size = 'md', className = '' }) => {
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-20 w-20 text-xl' };
  return (
    <div className={cn('relative grid flex-shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-400/20 font-semibold text-white ring-1 ring-white/10', sizes[size] || sizes.md, className)}>
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
};
