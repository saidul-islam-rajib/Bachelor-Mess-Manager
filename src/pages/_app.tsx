import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import Layout from '@/components/Layout';
import { ToastProvider } from '@/components/ToastProvider';
import { UserProvider } from '@/components/UserProvider';
import { InvitationsProvider } from '@/components/InvitationsProvider';
import { NotificationsProvider } from '@/components/NotificationsProvider';
import { CommunityProvider } from '@/components/CommunityProvider';
import { PwaProvider } from '@/components/PwaProvider';
import { ConfirmProvider } from '@/components/ui';
import { appConfig } from '@/config';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{appConfig.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="description" content={appConfig.tagline} />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f172a" />
        <meta name="color-scheme" content="light" />

        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        <meta name="application-name" content={appConfig.name} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appConfig.name} />
        <meta name="format-detection" content="telephone=no" />
      </Head>
      <ToastProvider>
        <ConfirmProvider>
          <UserProvider>
            <InvitationsProvider>
              <NotificationsProvider>
                <CommunityProvider>
                  <PwaProvider>
                    <Layout>
                      <Component {...pageProps} />
                    </Layout>
                  </PwaProvider>
                </CommunityProvider>
              </NotificationsProvider>
            </InvitationsProvider>
          </UserProvider>
        </ConfirmProvider>
      </ToastProvider>
    </>
  );
}
