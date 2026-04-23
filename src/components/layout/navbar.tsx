'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Moon, Sun, LogOut, Menu, X, Calendar, LayoutDashboard, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CronoLogo } from '@/components/crono-logo'
import type { UserRole } from '@/types/database'
import { cn } from '@/lib/utils'

interface NavbarProps {
  role?: UserRole
  barbershopName?: string
}

export function Navbar({ role, barbershopName }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggleDark = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const adminLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/servicios', label: 'Servicios', icon: Calendar },
    { href: '/dashboard/barberos', label: 'Barberos', icon: Calendar },
    { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
  ]
  const workerLinks = [
    { href: '/agenda', label: 'Mi Agenda', icon: Calendar },
  ]
  const links = role === 'admin' ? adminLinks : workerLinks

  return (
    <nav className="sticky top-0 z-50 border-b bg-[rgb(var(--bg))]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">

        {/* Logo */}
        <Link href={role === 'admin' ? '/dashboard' : '/agenda'}>
          <CronoLogo size="sm" />
        </Link>

        {/* Links desktop */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                         text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))]
                         hover:bg-[rgb(var(--bg-secondary))] rounded-lg transition-all"
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))] transition-all"
            aria-label="Cambiar tema"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={logout}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                       text-[rgb(var(--fg-secondary))] hover:text-brand-red
                       hover:bg-brand-red/5 rounded-lg transition-all"
          >
            <LogOut size={14} />
            Salir
          </button>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-[rgb(var(--fg-secondary))] hover:bg-[rgb(var(--bg-secondary))]"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-[rgb(var(--bg))] px-4 py-3 flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium
                         text-[rgb(var(--fg-secondary))] hover:text-[rgb(var(--fg))]
                         hover:bg-[rgb(var(--bg-secondary))] rounded-xl transition-all"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium
                       text-brand-red hover:bg-brand-red/5 rounded-xl transition-all mt-1"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      )}
    </nav>
  )
}
