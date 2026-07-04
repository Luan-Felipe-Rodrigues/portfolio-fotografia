/*
 * Analytics beacons.
 *
 * Fires pageview at DOMContentLoaded and a duration beacon at pagehide /
 * visibilitychange=hidden. Callers hit trackPhotoView(photoId) via
 * window.LR_ANALYTICS when the lightbox opens a photo (wired from likes.js
 * or the lightbox modules).
 *
 * Wire format is the contract that supabase/functions/ingest/index.ts
 * accepts:
 *   { type, session_id, path?, locale?, referrer?, photo_id?, source?,
 *     duration_ms? }
 *
 * No cookies. Only a sessionStorage-scoped UUID that dies with the tab.
 * Uses navigator.sendBeacon when available so the browser can flush the
 * request during unload; falls back to fetch(keepalive) otherwise.
 */
(function () {
  if (window.LR_ANALYTICS) return;

  const INGEST_URL = 'https://junfgutjyicdrvpoyuzz.supabase.co/functions/v1/ingest';
  const SESSION_KEY = 'lr_session_v1';

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now();
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

  function send(payload) {
    // fetch(keepalive) is more reliable than sendBeacon here: sendBeacon
    // with an application/json Blob triggers CORS quirks in Chromium that
    // fail the request even when the Edge Function replies to OPTIONS with
    // Allow-* headers. keepalive lets the browser flush during unload just
    // like sendBeacon would. Silent-fail — analytics never breaks the page.
    try {
      fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch { /* silent */ }
  }

  function trackPageview() {
    send({
      type: 'pageview',
      session_id: getSessionId(),
      path: window.location.pathname,
      locale: inferLocale(),
      referrer: document.referrer || null
    });
  }

  function trackPhotoView(photoId, source) {
    if (!photoId) return;
    send({
      type: 'photo_view',
      session_id: getSessionId(),
      photo_id: photoId,
      source: source || 'lightbox'
    });
  }

  const pageStart = Date.now();
  let durationSent = false;
  function trackSessionEnd() {
    if (durationSent) return;
    durationSent = true;
    send({
      type: 'pageview',
      session_id: getSessionId(),
      path: window.location.pathname,
      locale: inferLocale(),
      duration_ms: Date.now() - pageStart
    });
  }

  // Auto-fire pageview on load and a duration-carrying beacon on unload.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageview);
  } else {
    trackPageview();
  }
  window.addEventListener('pagehide', trackSessionEnd);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') trackSessionEnd();
  });

  window.LR_ANALYTICS = { trackPageview, trackPhotoView, trackSessionEnd };
  document.dispatchEvent(new CustomEvent('lr:analytics-ready'));
})();
