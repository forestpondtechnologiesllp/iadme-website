const ADS_ENVIRONMENTS = {
  local: "http://localhost:3000",
  staging: "https://staging-api.iadme.app",
  production: "https://api.iadme.app",
};

const ADS_STORAGE_KEYS = {
  env: "iadme_ads_env",
  baseUrl: "iadme_ads_base_url",
  token: "iadme_ads_token",
  email: "iadme_ads_email",
};

let adPackages = [];
let advertiserCampaigns = [];

const $ = (id) => document.getElementById(id);

const money = (amountPaise, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amountPaise ?? 0) / 100);

const writeAdsOutput = (value) => {
  const output = $("adsOutput");
  if (!output) return;
  output.textContent =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const setSessionStatus = (message, isLoggedIn = false) => {
  const status = $("adsSessionStatus");
  const logout = $("adsLogoutBtn");

  if (status) {
    status.textContent = message;
    status.style.color = isLoggedIn ? "#0f766e" : "#64748b";
  }

  logout?.classList.toggle("hidden", !isLoggedIn);
};

const getBaseUrl = () => {
  const baseUrl = $("adsBaseUrl")?.value?.trim();
  if (!baseUrl) throw new Error("API Base URL is required");
  return baseUrl.replace(/\/$/, "");
};

const getToken = () => {
  const token = localStorage.getItem(ADS_STORAGE_KEYS.token);
  if (!token) throw new Error("Please login first");
  return token;
};

const extractAccessToken = (data) =>
  data?.accessToken ||
  data?.token ||
  data?.auth?.accessToken ||
  data?.session?.accessToken ||
  data?.data?.accessToken ||
  "";

const api = async (path, options = {}) => {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        body?.error?.code ||
        body?.message ||
        `Request failed with ${response.status}`
    );
  }

  return body;
};

const publicApi = async (path, options = {}) => {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        body?.error?.code ||
        body?.message ||
        `Request failed with ${response.status}`
    );
  }

  return body;
};

const restoreAdsConfig = () => {
  const savedEnv = localStorage.getItem(ADS_STORAGE_KEYS.env) || "production";
  const savedBaseUrl = localStorage.getItem(ADS_STORAGE_KEYS.baseUrl);
  const savedEmail = localStorage.getItem(ADS_STORAGE_KEYS.email);
  const savedToken = localStorage.getItem(ADS_STORAGE_KEYS.token);

  if ($("adsEnv")) $("adsEnv").value = savedEnv;
  if ($("adsBaseUrl")) {
    $("adsBaseUrl").value =
      savedBaseUrl || ADS_ENVIRONMENTS[savedEnv] || ADS_ENVIRONMENTS.production;
  }
  if ($("adsLoginEmail") && savedEmail) $("adsLoginEmail").value = savedEmail;

  setSessionStatus(
    savedToken ? `Logged in as ${savedEmail || "advertiser"}` : "Not logged in.",
    Boolean(savedToken)
  );
};

const renderPackages = () => {
  const grid = $("adPackages");
  const packageSelects = [$("campaignPackage"), $("paymentPackage")].filter(Boolean);

  packageSelects.forEach((select) => {
    select.innerHTML = adPackages
      .map((item) => `<option value="${item.id}">${item.name} - ${money(item.amountPaise, item.currency)}</option>`)
      .join("");
  });

  if (!grid) return;

  grid.innerHTML = adPackages
    .map(
      (item) => `
        <article class="ads-package-card">
          <span>${item.targetLevel}</span>
          <h4>${item.name}</h4>
          <strong>${money(item.amountPaise, item.currency)}</strong>
          <p>${item.description}</p>
          <dl>
            <div><dt>Duration</dt><dd>${item.durationDays} days</dd></div>
            <div><dt>Placement</dt><dd>${item.placement}</dd></div>
          </dl>
          <a href="#dashboard" class="button ads-secondary-button">Select</a>
        </article>
      `
    )
    .join("");
};

const loadPackages = async () => {
  const data = await publicApi("/ads/packages");
  adPackages = data.items || [];
  renderPackages();
};

const syncCampaignSelects = () => {
  const options = advertiserCampaigns
    .map((item) => `<option value="${item.id}">${item.name} (${item.status})</option>`)
    .join("");

  [$("creativeCampaign"), $("paymentCampaign")].filter(Boolean).forEach((select) => {
    select.innerHTML = options || '<option value="">Create a campaign first</option>';
  });
};

const renderCampaigns = async () => {
  const output = $("campaignsOutput");
  if (!output) return;

  if (advertiserCampaigns.length === 0) {
    output.innerHTML = `
      <div class="ads-empty-state">
        <strong>No campaigns yet.</strong>
        <span>Create your first draft, upload a short video, then submit it for review.</span>
      </div>
    `;
    return;
  }

  const cards = await Promise.all(
    advertiserCampaigns.map(async (campaign) => {
      let creatives = [];
      let analytics = campaign.stats || { impressions: 0, clicks: 0, ctr: 0 };

      try {
        const creativeData = await api(
          `/advertiser/ads/campaigns/${campaign.id}/creatives`
        );
        creatives = creativeData.items || [];
      } catch (_) {}

      try {
        analytics = await api(
          `/advertiser/ads/campaigns/${campaign.id}/analytics`
        );
      } catch (_) {}

      return `
        <article class="ads-campaign-card">
          <div class="ads-campaign-main">
            <span class="ads-status ads-status-${campaign.status}">${campaign.status}</span>
            <h5>${campaign.name}</h5>
            <p>${campaign.targetCityKey || "All cities"} / ${campaign.targetRegionKey || "All states"} / ${campaign.targetCountryKey || "IN"}</p>
            <small>${campaign.creativesCount || creatives.length} creative(s)</small>
          </div>
          <div class="ads-campaign-metrics">
            <div><strong>${analytics.impressions || 0}</strong><span>Impressions</span></div>
            <div><strong>${analytics.clicks || 0}</strong><span>Clicks</span></div>
            <div><strong>${analytics.ctr || 0}%</strong><span>CTR</span></div>
          </div>
          <div class="ads-creative-list">
            ${
              creatives.length
                ? creatives
                    .map(
                      (creative) => `
                        <div>
                          <span class="ads-status ads-status-${creative.status}">${creative.status}</span>
                          <strong>${creative.title}</strong>
                          <small>${creative.ctaText || "No CTA"} ${creative.ctaUrl ? `- ${creative.ctaUrl}` : ""}</small>
                        </div>
                      `
                    )
                    .join("")
                : "<em>No creative uploaded yet.</em>"
            }
          </div>
        </article>
      `;
    })
  );

  output.innerHTML = cards.join("");
};

const loadCampaigns = async () => {
  const data = await api("/advertiser/ads/campaigns");
  advertiserCampaigns = data.items || [];
  syncCampaignSelects();
  await renderCampaigns();
};

const login = async (event) => {
  event.preventDefault();
  const email = $("adsLoginEmail").value.trim();
  const password = $("adsLoginPassword").value;

  const data = await publicApi("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const token = extractAccessToken(data);
  if (!token) throw new Error("Login succeeded but no access token was returned");

  localStorage.setItem(ADS_STORAGE_KEYS.token, token);
  localStorage.setItem(ADS_STORAGE_KEYS.email, email);
  localStorage.setItem(ADS_STORAGE_KEYS.baseUrl, getBaseUrl());
  setSessionStatus(`Logged in as ${email}`, true);
  writeAdsOutput("Login successful.");
  await loadCampaigns();
};

const register = async (event) => {
  event.preventDefault();
  const businessName = $("adsBusinessName").value.trim();
  const email = $("adsRegisterEmail").value.trim();
  const password = $("adsRegisterPassword").value;
  const phoneNumber = $("adsRegisterPhone").value.trim();

  await publicApi("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      phoneNumber: phoneNumber || undefined,
      displayName: businessName.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 15) || "Advertiser",
      acceptedTerms: true,
      acceptedPrivacyPolicy: true,
    }),
  });

  $("adsLoginEmail").value = email;
  $("adsLoginPassword").value = password;
  writeAdsOutput("Account created. Logging you in now.");
  await login(new Event("submit"));
};

const createCampaign = async (event) => {
  event.preventDefault();
  const packageId = $("campaignPackage").value;
  const selectedPackage = adPackages.find((item) => item.id === packageId);

  const payload = {
    name: $("campaignName").value.trim(),
    packageId,
    currency: selectedPackage?.currency || "INR",
    totalBudgetCents: selectedPackage?.amountPaise || null,
    targetCountryKey: $("targetCountry").value.trim() || "IN",
    targetRegionKey: $("targetRegion").value.trim() || null,
    targetCityKey: $("targetCity").value.trim() || null,
  };

  const campaign = await api("/advertiser/ads/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  writeAdsOutput({ createdCampaign: campaign });
  $("campaignForm").reset();
  $("targetCountry").value = "IN";
  await loadCampaigns();
};

const uploadToSignedUrl = async (uploadUrl, file) => {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "video/mp4",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed with ${response.status}`);
  }
};

const uploadCreative = async (event) => {
  event.preventDefault();
  const file = $("creativeVideoFile").files?.[0];
  if (!file) throw new Error("Choose a video file");

  $("uploadProgress").textContent = "Creating secure upload URL...";

  const uploadIntent = await api("/uploads/create", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "video/mp4",
      sizeBytes: file.size,
    }),
  });

  $("uploadProgress").textContent = "Uploading video...";
  await uploadToSignedUrl(uploadIntent.uploadUrl, file);

  $("uploadProgress").textContent = "Finalizing upload...";
  await api(`/uploads/${uploadIntent.upload.id}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  $("uploadProgress").textContent = "Creating ad creative for review...";
  const campaignId = $("creativeCampaign").value;
  const campaign = advertiserCampaigns.find((item) => item.id === campaignId);

  const result = await api("/advertiser/ads/ad-videos", {
    method: "POST",
    body: JSON.stringify({
      campaignId,
      uploadId: uploadIntent.upload.id,
      title: $("creativeTitle").value.trim(),
      description: $("creativeDescription").value.trim() || null,
      ctaText: $("creativeCtaText").value.trim() || null,
      ctaUrl: $("creativeCtaUrl").value.trim() || null,
      targetCountryKey: campaign?.targetCountryKey || "IN",
      targetRegionKey: campaign?.targetRegionKey || null,
      targetCityKey: campaign?.targetCityKey || null,
    }),
  });

  writeAdsOutput({ uploadedCreative: result });
  $("uploadProgress").textContent =
    "Uploaded. HLS processing has started and the creative is pending admin review.";
  $("creativeForm").reset();
  await loadCampaigns();
};

const requestPayment = async (event) => {
  event.preventDefault();
  const campaignId = $("paymentCampaign").value;
  const packageId = $("paymentPackage").value;

  const result = await api(
    `/advertiser/ads/campaigns/${campaignId}/payment-request`,
    {
      method: "POST",
      body: JSON.stringify({ packageId }),
    }
  );

  writeAdsOutput(result);
};

const logout = () => {
  localStorage.removeItem(ADS_STORAGE_KEYS.token);
  setSessionStatus("Not logged in.", false);
  advertiserCampaigns = [];
  syncCampaignSelects();
  renderCampaigns();
};

const bindAdvertiserEvents = () => {
  $("adsEnv")?.addEventListener("change", () => {
    const env = $("adsEnv").value;
    $("adsBaseUrl").value = ADS_ENVIRONMENTS[env] || ADS_ENVIRONMENTS.production;
    localStorage.setItem(ADS_STORAGE_KEYS.env, env);
    localStorage.setItem(ADS_STORAGE_KEYS.baseUrl, $("adsBaseUrl").value);
  });

  $("showLoginTab")?.addEventListener("click", () => {
    $("showLoginTab").classList.add("active");
    $("showRegisterTab").classList.remove("active");
    $("adsLoginForm").classList.remove("hidden");
    $("adsRegisterForm").classList.add("hidden");
  });

  $("showRegisterTab")?.addEventListener("click", () => {
    $("showRegisterTab").classList.add("active");
    $("showLoginTab").classList.remove("active");
    $("adsRegisterForm").classList.remove("hidden");
    $("adsLoginForm").classList.add("hidden");
  });

  $("adsLoginForm")?.addEventListener("submit", (event) =>
    login(event).catch((error) => writeAdsOutput(error.message))
  );
  $("adsRegisterForm")?.addEventListener("submit", (event) =>
    register(event).catch((error) => writeAdsOutput(error.message))
  );
  $("campaignForm")?.addEventListener("submit", (event) =>
    createCampaign(event).catch((error) => writeAdsOutput(error.message))
  );
  $("creativeForm")?.addEventListener("submit", (event) =>
    uploadCreative(event).catch((error) => {
      $("uploadProgress").textContent = "";
      writeAdsOutput(error.message);
    })
  );
  $("paymentForm")?.addEventListener("submit", (event) =>
    requestPayment(event).catch((error) => writeAdsOutput(error.message))
  );
  $("refreshCampaignsBtn")?.addEventListener("click", () =>
    loadCampaigns().catch((error) => writeAdsOutput(error.message))
  );
  $("adsLogoutBtn")?.addEventListener("click", logout);
};

document.addEventListener("DOMContentLoaded", async () => {
  restoreAdsConfig();
  bindAdvertiserEvents();

  try {
    await loadPackages();
  } catch (error) {
    writeAdsOutput(error.message);
  }

  if (localStorage.getItem(ADS_STORAGE_KEYS.token)) {
    try {
      await loadCampaigns();
    } catch (error) {
      writeAdsOutput(error.message);
    }
  } else {
    syncCampaignSelects();
    renderCampaigns();
  }
});
