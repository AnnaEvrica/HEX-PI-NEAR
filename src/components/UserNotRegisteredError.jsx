import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const UserNotRegisteredError = () => {
  const { checkAuth } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await checkAuth();
    setRetrying(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Access Restricted</h1>
          <p className="text-slate-600 mb-8">
            We couldn't confirm your account. This is often a momentary connection issue right after login.
          </p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full px-6 py-3 rounded-sm bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 mb-6"
          >
            {retrying ? 'Retrying…' : 'Retry connection'}
          </button>
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600 text-left">
            <p>If retrying doesn't work:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator to request access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;