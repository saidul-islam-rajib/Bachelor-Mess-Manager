import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import Layout from '@/components/Layout';
import { ToastProvider } from '@/components/ToastProvider';
import { UserProvider } from '@/components/UserProvider';
import { STRINGS } from '@/lib/strings';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{STRINGS.appName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
      </Head>
      <ToastProvider>
        <UserProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </UserProvider>
      </ToastProvider>
    </>
  );
}
