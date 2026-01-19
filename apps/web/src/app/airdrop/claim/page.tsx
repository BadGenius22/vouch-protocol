'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Redirect to main airdrop page - everything is now consolidated there
export default function AirdropClaimPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/airdrop');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Redirecting to airdrop page...</p>
        </div>
      </div>
    </div>
  );
}
