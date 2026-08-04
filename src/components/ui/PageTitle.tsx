import Head from 'next/head';
import { appConfig } from '@/config';

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <Head>
      <title>{`${title} · ${appConfig.name}`}</title>
      {description && <meta name="description" content={description} />}
    </Head>
  );
}

export default PageTitle;
