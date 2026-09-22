import { useState } from 'react';
import AppLink from './AppLink.jsx';
import { trackEvent, trackOutboundClick } from '../lib/analytics.js';
import { getShareUrl, sharePage } from '../lib/share.js';
import { formatUpdatedLabel } from '../lib/format.js';

export function SourceLink({ href, children = 'Source', context = {}, className = '' }) {
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackOutboundClick('source_click', href, context)}
    >
      {children}
    </a>
  );
}

export function ShareButton({ title, text, path, context = {}, className = 'text-button', children = 'Share' }) {
  const [feedback, setFeedback] = useState('');

  async function handleShare() {
    const result = await sharePage({ title, text, url: getShareUrl(path) });

    if (result.status === 'shared') {
      trackEvent('page_share', { ...context, method: result.method });
      setFeedback(result.method === 'copy' ? 'Link copied' : 'Shared');
      window.setTimeout(() => setFeedback(''), 2200);
      return;
    }

    if (result.status === 'unavailable') {
      setFeedback('Sharing is unavailable');
      window.setTimeout(() => setFeedback(''), 2200);
    }
  }

  return (
    <span className="share-control">
      <button type="button" className={className} onClick={handleShare}>
        {children}
      </button>
      {feedback ? <span className="share-feedback" aria-live="polite">{feedback}</span> : null}
    </span>
  );
}

function getScheduleAuthorityLabel(runtime) {
  return runtime.meta.scheduleAuthority === 'official_pdf'
    ? 'Official schedule'
    : runtime.meta.scheduleAuthority === 'stale_official'
      ? 'Last verified official schedule'
      : 'Community schedule reference';
}

export function TrustLine({ runtime, className = '' }) {
  return (
    <div className={`trust-line ${className}`.trim()}>
      <span className="trust-line__dot" aria-hidden="true" />
      <span>{getScheduleAuthorityLabel(runtime)}</span>
      <span aria-hidden="true">·</span>
      <span>{formatUpdatedLabel(runtime.checkedAt)}</span>
      <AppLink href="/sources" className="trust-line__link">Data & sources</AppLink>
    </div>
  );
}
