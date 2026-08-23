import Head from 'next/head';
import { appConfig } from '@/config';

export function PageTitle({
  title,
  description,
  image,
  url,
  hideSocialSummary = false
}: {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  hideSocialSummary?: boolean;
}) {
  const showSocialSummary = Boolean(description) && !hideSocialSummary;

  return (
    <Head>
      <title>{`${title} · ${appConfig.name}`}</title>
      {description && <meta name="description" content={description} />}

      <meta property="og:title" content={title} />
      <meta property="og:site_name" content={appConfig.name} />
      {showSocialSummary && <meta property="og:description" content={description} />}
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}
      {image && <meta property="og:image:alt" content={title} />}
      <meta property="og:type" content={image ? 'article' : 'website'} />

      <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={title} />
      {showSocialSummary && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
    </Head>
  );
}

export default PageTitle;
