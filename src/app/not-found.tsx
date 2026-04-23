import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <span className="text-[120px] font-black text-[rgb(var(--fg))] leading-none select-none">J</span>
          <span className="absolute top-[48px] left-[-6px] w-[108px] h-[12px] bg-brand-red rounded-full -rotate-[15deg]" />
        </div>
        <h1 className="text-3xl font-bold text-[rgb(var(--fg))] mb-2">Página no encontrada</h1>
        <p className="text-[rgb(var(--fg-secondary))] mb-8">
          Esta barbería no existe o el link ha expirado.
        </p>
        <Link href="/" className="btn-primary inline-flex">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
