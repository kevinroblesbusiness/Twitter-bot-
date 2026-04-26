import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState<string | null>(null);

  useEffect(() => {
    // Get creator ID from URL params
    const id = router.query.creator_id as string;
    if (id) {
      setCreatorId(id);
      localStorage.setItem('creatorId', id);
    } else {
      const stored = localStorage.getItem('creatorId');
      if (stored) {
        setCreatorId(stored);
      }
    }
  }, [router.query]);

  if (!creatorId && router.pathname !== '/login') {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Fanvue AI Chatbot</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return <Component {...pageProps} creatorId={creatorId} />;
}
