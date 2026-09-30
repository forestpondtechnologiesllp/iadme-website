import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../functions/v/[videoId].js', import.meta.url), 'utf8');
const { onRequestGet } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('public reel link offers app opening and install without exposing playable media', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://api.iadme.app/videos/public/reel-123');
    return new Response(JSON.stringify({
      id: 'reel-123', title: '<Hello>', description: 'Near you',
      hlsUrl: 'https://private.example.invalid/master.m3u8',
      thumbnailUrl: 'https://images.example.invalid/thumbnail.jpg',
    }), { status: 200 });
  };
  try {
    const response = await onRequestGet({
      request: new Request('https://iadme.app/v/reel-123'),
      params: { videoId: 'reel-123' },
    });
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /Open this reel in iAdMe/);
    assert.match(html, /Install iAdMe/);
    assert.match(html, /reopen this link/i);
    assert.match(html, /&lt;Hello&gt;/);
    assert.doesNotMatch(html, /<video|master\.m3u8|private\.example/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unavailable reel is not offered for opening', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  try {
    const response = await onRequestGet({
      request: new Request('https://iadme.app/v/missing'),
      params: { videoId: 'missing' },
    });
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /iadme:\/\/video\/missing/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('photo link opts in to photo posts and keeps a thumbnail-only public preview', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers['X-Iadme-Content'], 'photo-v1');
    return new Response(JSON.stringify({type:'PHOTO_POST',id:'photo-123',title:'Photos',thumbnailUrl:'https://images.example.invalid/thumb.webp',photos:[{url:'https://images.example.invalid/display.webp'}]}));
  };
  try {
    const response = await onRequestGet({request:new Request('https://iadme.app/v/photo-123'),params:{videoId:'photo-123'}});
    const html = await response.text();
    assert.equal(response.status,200);
    assert.match(html,/Open this photo post in iAdMe/);
    assert.match(html,/og:type" content="article/);
    assert.doesNotMatch(html,/<video|display.webp/);
  } finally {globalThis.fetch=originalFetch;}
});
