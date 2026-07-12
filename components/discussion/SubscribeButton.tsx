// components/discussion/SubscribeButton.tsx
'use client';
import * as React from 'react';

export function SubscribeButton({
  discussionId,
  variant = 'default',
  className = '',
}: {
  discussionId: string;
  variant?: 'default' | 'compact' | 'text-only' | 'icon-only';
  className?: string;
}) {
  const [subscribed, setSubscribed] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Check subscription status on mount
  React.useEffect(() => {
    async function checkStatus() {
      try {
        const r = await fetch(`/api/discussions/${discussionId}/subscribe`);
        const j = await r.json();
        setSubscribed(j.subscribed ?? false);
      } catch (err) {
        console.error('Failed to check subscription:', err);
        setSubscribed(false);
      }
    }
    checkStatus();
  }, [discussionId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); // Prevent navigation if inside a link
    e.stopPropagation();
    
    if (loading || subscribed === null) return;
    
    setLoading(true);
    try {
      const method = subscribed ? 'DELETE' : 'POST';
      const r = await fetch(`/api/discussions/${discussionId}/subscribe`, { method });
      
      if (!r.ok) throw new Error('Failed to update subscription');
      
      const j = await r.json();
      setSubscribed(j.subscribed);
    } catch (err) {
      console.error('Failed to toggle subscription:', err);
    } finally {
      setLoading(false);
    }
  }

  // Show loading state on initial check
  if (subscribed === null) {
    return variant === 'icon-only' ? (
      <button disabled className="p-2 text-slate-400">
        <svg className="h-5 w-5 animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      </button>
    ) : (
      <button disabled className={`btnv2 btnv2--sm opacity-50 ${className}`}>
        <span className="kb-spinner h-3 w-3" />
      </button>
    );
  }

  if (variant === 'icon-only') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={`group/sub rounded-lg p-2 transition-all ${
          subscribed
            ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
            : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600'
        } ${loading ? 'opacity-50' : ''} ${className}`}
        title={subscribed ? 'Unsubscribe' : 'Subscribe'}
      >
        {loading ? (
          <span className="kb-spinner h-5 w-5" />
        ) : subscribed ? (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        )}
      </button>
    );
  }
if (variant === 'text-only') {
    return (
        <button
      onClick={toggle}
      disabled={loading}
      className={`btnv2 btnv2--sm text-xs px-3 py-1.5 ${
        subscribed ? 'bg-indigo-100 text-indigo-700' : ''
      } ${loading ? 'opacity-50' : ''} ${className}`}
    >
      {subscribed ? (
        <>
          {/* <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg> */}
          <span>Subscribed</span>
        </>
      ) : (
        <>
          {/* <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg> */}
          <span>Subscribe</span>
        </>
      )}
    </button>
    );
  }
    
  if (variant === 'compact') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          subscribed
            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        } ${loading ? 'opacity-50' : ''} ${className}`}
      >
        {loading ? (
          <span className="kb-spinner h-3 w-3" />
        ) : subscribed ? (
          <>
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span>Subscribed</span>
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Subscribe</span>
          </>
        )}
      </button>
    );
  }

  // Default variant
  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`btnv2 btnv2--sm flex items-center gap-2 ${
        subscribed ? 'bg-indigo-100 text-indigo-700' : ''
      } ${loading ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <span className="kb-spinner h-4 w-4" />
      ) : subscribed ? (
        <>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span>Subscribed</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Subscribe</span>
        </>
      )}
    </button>
  );
}