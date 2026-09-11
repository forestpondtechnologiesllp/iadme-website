(() => {
  'use strict';
  document.documentElement.classList.add('has-js');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const closeMenu = () => {
    const returnFocus = nav?.contains(document.activeElement);
    toggle?.setAttribute('aria-expanded', 'false'); nav?.classList.remove('is-open');
    if (returnFocus) toggle?.focus();
  };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('is-open', open);
  });
  nav?.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  const dialog = document.querySelector('#film-dialog');
  const player = dialog?.querySelector('video');
  let opener;
  function closeFilm() {
    if (!dialog) return;
    player.pause(); player.removeAttribute('src'); player.replaceChildren(); player.load();
    if (dialog.open) dialog.close();
    document.body.classList.remove('dialog-open'); opener?.focus();
  }
  document.querySelectorAll('[data-film]').forEach(link => link.addEventListener('click', event => {
    if (!dialog || !dialog.showModal || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); opener = link;
    dialog.querySelector('#film-title').textContent = link.dataset.title;
    dialog.querySelector('#film-description').textContent = link.dataset.description || '';
    dialog.querySelector('.film-kind').textContent = link.dataset.kind || 'An iAdMe film';
    dialog.querySelector('.film-download').href = link.href;
    player.poster = link.dataset.poster || ''; player.src = link.href;
    if (link.dataset.caption) {
      const track = document.createElement('track');
      track.kind = 'captions'; track.srclang = 'en'; track.label = 'English'; track.src = link.dataset.caption;
      player.append(track);
    }
    dialog.querySelector('.player-status').textContent = '';
    document.body.classList.add('dialog-open'); dialog.showModal();
    player.play().catch(() => { dialog.querySelector('.player-status').textContent = 'Press play to watch the film.'; });
  }));
  dialog?.querySelector('.dialog-close').addEventListener('click', closeFilm);
  dialog?.addEventListener('cancel', event => { event.preventDefault(); closeFilm(); });
  dialog?.addEventListener('click', event => { if (event.target === dialog) closeFilm(); });
  player?.addEventListener('error', () => {
    if (player.hasAttribute('src')) dialog.querySelector('.player-status').textContent = 'The film could not load. Try the direct video link below.';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) player?.pause(); });

  const shareUrl = 'https://iadme.app/get';
  const shareText = 'Your next story is nearby. Discover local videos and find your people on iAdMe.';
  function status(message) { document.querySelectorAll('.share-status').forEach(el => { el.textContent = message; }); }
  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
      else throw new Error('Clipboard unavailable');
      status('Link copied. Share a little possibility.');
    } catch {
      const field = document.querySelector('#share-url');
      field?.focus(); field?.select();
      status('Select and copy this link: ' + shareUrl);
    }
  }
  document.querySelectorAll('[data-copy-link]').forEach(button => button.addEventListener('click', copyLink));
  document.querySelectorAll('[data-share-link]').forEach(button => button.addEventListener('click', async () => {
    if (!navigator.share) { await copyLink(); return; }
    try { await navigator.share({title:'Discover iAdMe',text:shareText,url:shareUrl}); status('Thanks for sharing iAdMe.'); }
    catch(error) { if (error.name !== 'AbortError') await copyLink(); }
  }));

  const filterButtons = document.querySelectorAll('[data-filter]');
  filterButtons.forEach(button => button.addEventListener('click', () => {
    filterButtons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    let count = 0;
    document.querySelectorAll('[data-category]').forEach(card => {
      card.hidden = button.dataset.filter !== 'all' && card.dataset.category !== button.dataset.filter;
      if (!card.hidden) count++;
    });
    const countEl = document.querySelector('.filter-status');
    if (countEl) countEl.textContent = `${count} film${count === 1 ? '' : 's'}`;
  }));
})();
