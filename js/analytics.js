/*
 * Analytics placeholder for Sprint 2.
 *
 * Sprint 2 will replace the console.debug lines with beacons to a Supabase
 * Edge Function `ingest`, which writes to public.page_views / photo_views /
 * sessions. Contract stays stable so main.js and likes.js don't need edits
 * when the real implementation lands.
 *
 * No cookies, no fingerprint, no PII — only session_id in sessionStorage.
 */
(function () {
  if (window.LR_ANALYTICS) return;

  const SESSION_KEY = 'lr_session_v1';

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function inferLocale() {
    const path = window.location.pathname;
    if (path.startsWith('/en/')) return 'en';
    if (path.startsWith('/es/')) return 'es';
    return 'pt';
  }

  function trackPageview() {
    const payload = {
      session_id: getSessionId(),
      path: window.location.pathname,
      referrer: document.referrer || null,
      locale: inferLocale(),
      timestamp: Date.now()
    };
    console.debug('[analytics] pageview', payload);
    // Sprint 2: navigator.sendBeacon('<ingest-url>/pageview', JSON.stringify(payload));
  }

  function trackPhotoView(photoId, source) {
    const payload = {
      session_id: getSessionId(),
      photo_id: photoId,
      source: source || 'lightbox',
      timestamp: Date.now()
    };
    console.debug('[analytics] photo_view', payload);
    // Sprint 2: navigator.sendBeacon('<ingest-url>/photo_view', JSON.stringify(payload));
  }

  const pageStart = Date.now();
  function trackSessionEnd() {
    const payload = {
      session_id: getSessionId(),
      path: window.location.pathname,
      duration_ms: Date.now() - pageStart,
      timestamp: Date.now()
    };
    console.debug('[analytics] session_end', payload);
    // Sprint 2: navigator.sendBeacon('<ingest-url>/session_end', JSON.stringify(payload));
  }

  // Auto-fire pageview and session_end
  document.addEventListener('DOMContentLoaded', trackPageview);
  window.addEventListener('pagehide', trackSessionEnd);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') trackSessionEnd();
  });

  window.LR_ANALYTICS = { trackPageview, trackPhotoView, trackSessionEnd };
  document.dispatchEvent(new CustomEvent('lr:analytics-ready'));
})();
