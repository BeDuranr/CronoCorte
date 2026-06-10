import { createServerClient } from '@/lib/supabase/server'
import { accentColorVars } from '@/lib/utils'

// Layout del panel de administración. Carga el color de acento de la barbería
// del admin logueado e inyecta la variable CSS --red para que todo el panel
// (botones, focus, toggles, etc.) use el color elegido. La autenticación la
// siguen manejando las propias páginas; aquí solo aplicamos el tema.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerClient()

  let accentColor: string | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: barbershop } = await supabase
      .from('barbershops')
      .select('accent_color')
      .eq('admin_id', user.id)
      .single()
    accentColor = barbershop?.accent_color ?? null
  }

  return (
    <>
      <style>{`:root { ${accentColorVars(accentColor)} }`}</style>
      {children}
    </>
  )
}
