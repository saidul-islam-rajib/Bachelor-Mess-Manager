import type { AppProps } from 'next/app';
import '../styles/globals.css';
import Layout from '@/components/Layout';
import { ToastProvider } from '@/components/ToastProvider';
import { UserProvider } from '@/components/UserProvider';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ToastProvider>
      <UserProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </UserProvider>
    </ToastProvider>
  );
}
