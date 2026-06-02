import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/ui/Sidebar'
import AdminProvider from '@/components/ui/AdminProvider'

export const metadata: Metadata = {
  title: 'Valcausse — Gestion des contrats céréales',
  description: 'Application de gestion des contrats d\'achat et de vente de céréales pour la coopérative Valcausse',
  icons: { icon: '/logo.png' },
  themeColor: '#7B2820',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-cream">
        <AdminProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-6 max-w-full overflow-x-hidden">
              {children}
            </main>
          </div>
        </AdminProvider>
      </body>
    </html>
  )
}
