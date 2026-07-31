import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import Layout from '@/components/Layout';
import { ToastProvider } from '@/components/ToastProvider';
import { UserProvider } from '@/components/UserProvider';
import { InvitationsProvider } from '@/components/InvitationsProvider';
import { NotificationsProvider } from '@/components/NotificationsProvider';
import { ConfirmProvider } from '@/components/ui';
import { appConfig } from '@/config';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{appConfig.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={appConfig.tagline} />
        <link rel="icon" href="/logo.png" />
      </Head>
      <ToastProvider>
        <ConfirmProvider>
          <UserProvider>
            <InvitationsProvider>
              <NotificationsProvider>
                <Layout>
                  <Component {...pageProps} />
                </Layout>
              </NotificationsProvider>
            </InvitationsProvider>
          </UserProvider>
        </ConfirmProvider>
      </ToastProvider>
    </>
  );
}
