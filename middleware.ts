import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Rutas públicas — siempre accesibles
  const publicPaths = ['/', '/login', '/register']
  const isPublicPath = publicPaths.includes(pathname)
  const isSlugPath = /^\/[a-z0-9-]+$/.test(pathname) && !pathname.startsWith('/api')
  const isApiPath = pathname.startsWith('/api')

  if (isPublicPath || isSlugPath || isApiPath) {
    return supabaseResponse
  }

  // Sin sesión → al login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Verificar rol del usuario para rutas protegidas
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // Admin intenta acceder a rutas de worker y viceversa
  if (pathname.startsWith('/dashboard') && role !== 'admin') {
    return NextResponse.redirect(new URL('/agenda', request.url))
  }
  if (pathname.startsWith('/agenda') && role !== 'worker') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
