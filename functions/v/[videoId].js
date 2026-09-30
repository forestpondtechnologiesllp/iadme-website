const DEV_API_BASE_URL = "http://192.168.1.7:3000";
const PROD_API_BASE_URL = "https://api.iadme.app";

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const formatNumber = (value) => {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) return "0";

  return new Intl.NumberFormat("en-IN", {
    notation: number >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(number);
};

const getApiBaseUrl = (request) => {
  const host = new URL(request.url).hostname;

  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".pages.dev")) {
    return DEV_API_BASE_URL;
  }

  return PROD_API_BASE_URL;
};

const renderErrorPage = ({ status, title, message }) => {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} | iAdMe</title>
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/favicon.png" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="share-page">
    <section class="share-card share-card-error">
      <img src="/assets/iadme-logo.png" alt="iAdMe Logo" class="share-logo" />
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <a class="button" href="/">Go to iAdMe</a>
    </section>
  </main>
</body>
</html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store",
      },
    }
  );
};

const renderVideoPage = ({ request, video }) => {
  const url = new URL(request.url);
  const canonicalUrl = `${url.origin}/v/${encodeURIComponent(video.id)}`;
  const isPhoto = video.type === "PHOTO_POST";
  const contentLabel = isPhoto ? "photo post" : "reel";
  const title = video.title?.trim() || `View this ${contentLabel} on iAdMe`;
  const description =
    video.description?.trim() ||
    `View ${video.creatorName || "a creator"}'s ${contentLabel} on iAdMe.`;
  const thumbnailUrl = video.thumbnailUrl || "/assets/iadme-logo.png";
  const creatorName = video.creatorName || "Creator";
  const locationParts = [video.locality, video.city].filter(Boolean);
  const locationLabel =
    video.locationLabel ||
    (locationParts.length > 0 ? locationParts.join(", ") : "iAdMe");

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | iAdMe</title>
  <meta name="description" content="${escapeHtml(description.slice(0, 160))}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/favicon.png" />

  <meta property="og:type" content="${isPhoto ? "article" : "video.other"}" />
  <meta property="og:site_name" content="iAdMe" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description.slice(0, 220))}" />
  <meta property="og:image" content="${escapeHtml(thumbnailUrl)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description.slice(0, 220))}" />
  <meta name="twitter:image" content="${escapeHtml(thumbnailUrl)}" />

  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main class="share-page">
    <section class="share-card">
      <div class="share-brand-row">
        <img src="/assets/iadme-logo.png" alt="iAdMe Logo" class="share-logo" />
        <div>
          <div class="share-brand-title">iAdMe</div>
          <div class="share-brand-subtitle">Locality-first short videos</div>
        </div>
      </div>

      <a
        class="share-thumbnail-wrap share-thumbnail-link"
        href="iadme://video/${encodeURIComponent(video.id)}"
        aria-label="Open this ${contentLabel} in iAdMe"
      >
        <img src="${escapeHtml(thumbnailUrl)}" alt="${escapeHtml(title)}" class="share-thumbnail" />
        <div class="share-play-badge" aria-hidden="true">↗</div>
      </a>

      <div class="share-content">
        <p class="eyebrow">${escapeHtml(locationLabel)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="share-description">${escapeHtml(description)}</p>
        <p class="share-creator">By <strong>${escapeHtml(creatorName)}</strong></p>

        <div class="share-stats">
          <span>${formatNumber(video.viewCount)} views</span>
          <span>${formatNumber(video.likeCount)} likes</span>
          <span>${formatNumber(video.superLikeCount)} WoW</span>
          <span>${formatNumber(video.shareCount)} shares</span>
        </div>

        <a class="button share-install-button" id="install-app" href="/get">Install iAdMe</a>
        <a class="button share-open-button" href="iadme://video/${encodeURIComponent(video.id)}">Already installed? Open this ${contentLabel} in iAdMe</a>
        <div class="share-store-links">
          <a href="https://apps.apple.com/app/id6778307078">App Store</a>
          <a href="https://play.google.com/store/apps/details?id=app.iadme.mobile">Google Play</a>
        </div>
        <p class="share-help-text">After installing, reopen this link to view this ${contentLabel}. The store cannot pass this page directly to a fresh installation.</p>
        <button class="share-copy-link" type="button" data-share-url="${escapeHtml(canonicalUrl)}">Copy ${contentLabel} link</button>
        <p class="share-copy-status" role="status" aria-live="polite"></p>
      </div>
    </section>
  </main>
  <script>
    const install = document.getElementById("install-app");
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      install.href = "https://apps.apple.com/app/id6778307078";
    } else if (/Android/i.test(navigator.userAgent)) {
      install.href = "https://play.google.com/store/apps/details?id=app.iadme.mobile";
    }
    document.querySelector(".share-copy-link").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const status = document.querySelector(".share-copy-status");
      try {
        await navigator.clipboard.writeText(button.dataset.shareUrl);
        status.textContent = "Link copied. Open it again after installing.";
      } catch (_) {
        status.textContent = "Copy this page's address to open it after installing.";
      }
    });
  </script>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "public, max-age=60",
      },
    }
  );
};

export async function onRequestGet(context) {
  const videoId = context.params.videoId;

  if (!videoId || Array.isArray(videoId)) {
    return renderErrorPage({
      status: 400,
      title: "Invalid video link",
      message: "This iAdMe video link is invalid.",
    });
  }

  const apiBaseUrl = getApiBaseUrl(context.request);
  const apiUrl = `${apiBaseUrl}/videos/public/${encodeURIComponent(videoId)}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        accept: "application/json",
        "X-Iadme-Content": "photo-v1",
      },
    });

    if (!response.ok) {
      return renderErrorPage({
        status: 404,
        title: "Video not available",
        message: "This video may be private, still processing, removed, or unavailable.",
      });
    }

    const video = await response.json();

    return renderVideoPage({ request: context.request, video });
  } catch (error) {
    return renderErrorPage({
      status: 502,
      title: "Could not load video",
      message: "iAdMe could not load this video preview right now. Please try again later.",
    });
  }
}
