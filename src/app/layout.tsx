import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Crono Corte', template: '%s | Crono Corte' },
  description: 'Agenda tu hora de corte en segundos.',
  icons: { icon: '/logos/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            try {
              const saved = localStorage.getItem('theme')
              const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
              if (saved === 'dark' || (!saved && prefersDark)) {
                document.documentElement.classList.add('dark')
              }
            } catch {}
          `
        }} />
      </head>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgb(var(--bg))',
              color: 'rgb(var(--fg))',
              border: '1px solid rgb(var(--border))',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#e63946', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  )
}
