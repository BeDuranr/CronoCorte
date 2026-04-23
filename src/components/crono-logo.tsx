interface CronoLogoProps {
  size?: 'sm' | 'md' | 'lg'
}

export function CronoLogo({ size = 'md' }: CronoLogoProps) {
  if (size === 'sm') {
    return (
      <div className="flex items-baseline gap-0 leading-none">
        <span className="text-2xl font-black text-[rgb(var(--fg))] tracking-tight">crono</span>
        <span className="text-2xl font-thin text-brand-red">/</span>
        <span className="text-2xl font-light text-[rgb(var(--fg))] tracking-tight">corte</span>
      </div>
    )
  }

  if (size === 'md') {
    return (
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline gap-0">
          <span className="text-2xl font-black text-[rgb(var(--fg))] tracking-tight">crono</span>
          <span className="text-2xl font-thin text-brand-red">/</span>
          <span className="text-2xl font-light text-[rgb(var(--fg))] tracking-tight">corte</span>
        </div>
        <span className="text-[10px] font-normal text-[rgb(var(--fg-secondary))] tracking-[4px] uppercase mt-1">
          agenda · ia · barberías
        </span>
      </div>
    )
  }

  // lg
  return (
    <div className="flex flex-col items-center leading-none">
      <div className="flex items-baseline gap-0">
        <span className="text-4xl font-black text-[rgb(var(--fg))] tracking-tight">crono</span>
        <span className="text-4xl font-thin text-brand-red">/</span>
        <span className="text-4xl font-light text-[rgb(var(--fg))] tracking-tight">corte</span>
      </div>
      <span className="text-[11px] font-normal text-[rgb(var(--fg-secondary))] tracking-[4px] uppercase mt-1.5">
        agenda · ia · barberías
      </span>
    </div>
  )
}
