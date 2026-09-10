import { Inter } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import MobileHeader from '@/components/MobileHeader';
import { UndoProvider } from '@/contexts/UndoContext';
import { StoreProvider } from '@/contexts/StoreContext';
import { ReposicaoProvider } from '@/contexts/ReposicaoContext';
import UndoToast from '@/components/UndoToast';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Estoque de Discos | Freelancer Discos',
  description: 'Sistema de gerenciamento de estoque de discos de vinil, CDs e DVDs',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={inter.variable} data-theme="dark">
      <body>
        <UndoProvider>
          <StoreProvider>
            <ReposicaoProvider>
              <div className="app-layout">
                <Sidebar />
                <div className="main-wrapper">
                  <MobileHeader />
                  <main className="main-content">
                    {children}
                  </main>
                </div>
                <BottomNav />
                <UndoToast />
              </div>
            </ReposicaoProvider>
          </StoreProvider>
        </UndoProvider>
      </body>
    </html>
  );
}
