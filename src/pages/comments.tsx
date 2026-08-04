import type { GetServerSideProps } from 'next';
import { commentsAnchorPath } from '@/lib/routes';

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const group = typeof query.group === 'string' ? query.group : undefined;

  return { redirect: { destination: commentsAnchorPath(group), permanent: false } };
};

export default function CommentsRedirectPage() {
  return null;
}
