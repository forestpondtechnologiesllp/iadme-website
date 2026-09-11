(() => {
  'use strict';
  const APPLE = 'https://apps.apple.com/app/id6778307078';
  const GOOGLE = 'https://play.google.com/store/apps/details?id=app.iadme.mobile';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isPreview = /bot|crawler|spider|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isApple = /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(platform) && navigator.maxTouchPoints > 1);
  const stay = new URLSearchParams(location.search).get('stay') === '1';
  const status = document.getElementById('store-status');
  const target = isAndroid ? GOOGLE : isApple ? APPLE : null;
  if (target && !isPreview && !stay) {
    status.textContent = `Opening ${isAndroid ? 'Google Play' : 'the App Store'}…`;
    window.setTimeout(() => {
      window.location.replace(target);
      window.setTimeout(() => {
        status.textContent = 'If the store did not open, choose a button below.';
      }, 1800);
    }, 180);
  }
})();
