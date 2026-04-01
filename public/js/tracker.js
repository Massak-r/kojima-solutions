(function() {
  'use strict';
  var ep = '/api/analytics.php';
  var sid = Math.random().toString(36).slice(2, 10);

  function send(event, props) {
    var data = JSON.stringify({
      event: event,
      page: location.pathname,
      referrer: document.referrer,
      vw: window.innerWidth,
      vh: window.innerHeight,
      lang: navigator.language,
      session: sid,
      props: props || undefined
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ep, data);
    } else {
      fetch(ep, { method: 'POST', body: data, keepalive: true }).catch(function() {});
    }
  }

  // Auto-track pageview on load
  send('pageview');

  // Expose plausible-compatible API for existing event calls
  window.plausible = function(event, opts) {
    send(event, opts && opts.props ? opts.props : undefined);
  };
})();
