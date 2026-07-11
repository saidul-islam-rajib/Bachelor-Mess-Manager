import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Member/registration management moved into the admin dashboard.
export default function MembersPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return null;
}
