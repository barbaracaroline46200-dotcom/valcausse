import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/ui/Sidebar'
import Header from '@/components/ui/Header'
import AdminProvider from '@/components/ui/AdminProvider'
import AuthGate from '@/components/ui/AuthGate'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

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
          <ErrorBoundary>
          <AuthGate>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 ml-64 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-6 pt-20 max-w-full overflow-x-hidden">
                  {children}
                </main>
              </div>
            </div>
          </AuthGate>
          </ErrorBoundary>
        </AdminProvider>
      </body>
    </html>
  )
}
