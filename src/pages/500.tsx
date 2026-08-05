import ErrorPage from '@/components/ErrorPage';
import { Button } from '@/components/ui';
import { strings } from '@/lib/i18n';

export default function ServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      title={strings.errors.page.serverTitle}
      body={strings.errors.page.serverBody}
      action={
        <Button size="lg" variant="secondary" onClick={() => window.location.reload()}>
          {strings.errors.page.tryAgain}
        </Button>
      }
    />
  );
}
