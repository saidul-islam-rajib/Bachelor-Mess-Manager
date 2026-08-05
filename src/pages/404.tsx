import ErrorPage from '@/components/ErrorPage';
import { strings } from '@/lib/i18n';

export default function NotFoundPage() {
  return (
    <ErrorPage code="404" title={strings.errors.page.notFoundTitle} body={strings.errors.page.notFoundBody} />
  );
}
