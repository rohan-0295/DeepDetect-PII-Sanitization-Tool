import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-6">
          <Shield size={26} className="text-zinc-700" strokeWidth={1.5} />
        </div>
        <p className="text-7xl font-bold font-mono text-zinc-800 mb-4">404</p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-200 mb-2">Page not found</h1>
        <p className="text-sm text-zinc-500 mb-8">This endpoint doesn't exist or has been moved.</p>
        <Link to="/scan"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
          <ArrowLeft size={15} strokeWidth={2.5} />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
