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
    <div className="min-h-screen bg-gradient-to-br from-[#000] to-[#1A2428] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-white/80 animate-spin mx-auto mb-4" />
        <p className="text-neutral-400">Redirecting to airdrop page...</p>
      </div>
    </div>
  );
}
