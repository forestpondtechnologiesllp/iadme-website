const ENVIRONMENTS = {
  local: "http://localhost:3000",
  staging: "https://staging-api.iadme.app",
  production: "https://api.iadme.app",
};

const STORAGE_KEYS = {
  env: "iadme_admin_env",
  baseUrl: "iadme_admin_base_url",
  token: "iadme_admin_token",
  email: "iadme_admin_email",
};

const getElement = (id) => document.getElementById(id);

const formatJson = (value) => JSON.stringify(value, null, 2);

const getConfig = () => {
  const baseUrl = getElement("baseUrl")?.value?.trim();
  const token = getElement("adminToken")?.value?.trim();

  if (!baseUrl) {
    throw new Error("API Base URL is required");
  }

  if (!token) {
    throw new Error("Admin token is required");
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    token,
  };
};

const requestAdminApi = async (path, options = {}) => {
  const { baseUrl, token } = getConfig();
  const { allowConflict, ...fetchOptions } = options;

  const response = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok && !(allowConflict && response.status === 409)) {
    const message = body?.error?.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return body;
};

const setLoginStatus = (message, isLoggedIn = false) => {
  const statusEl = getElement("adminLoginStatus");
  const loginBtn = getElement("adminLoginBtn");
  const logoutBtn = getElement("adminLogoutBtn");

  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = isLoggedIn ? "#16a34a" : "#64748b";
  }

  if (loginBtn) loginBtn.style.display = isLoggedIn ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
};

const extractAccessToken = (data) =>
  data?.accessToken ||
  data?.token ||
  data?.auth?.accessToken ||
  data?.session?.accessToken ||
  data?.data?.accessToken ||
  "";

const loginAdmin = async () => {
  const baseUrl = getElement("baseUrl")?.value?.trim()?.replace(/\/$/, "");
  const email = getElement("adminEmail")?.value?.trim();
  const password = getElement("adminPassword")?.value || "";
  const tokenInput = getElement("adminToken");
  const loginBtn = getElement("adminLoginBtn");

  if (!baseUrl || !email || !password) {
    alert("API Base URL, admin email and password are required");
    return;
  }

  try {
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Logging in...";
    }

    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.error?.message || data?.message || `Login failed with ${response.status}`);
    }

    const token = extractAccessToken(data);
    if (!token) throw new Error("Login succeeded but access token was not found");

    tokenInput.value = token;

    localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrl);
    localStorage.setItem(STORAGE_KEYS.email, email);
    localStorage.setItem(STORAGE_KEYS.token, token);

    getElement("adminPassword").value = "";
    setLoginStatus(`Logged in as ${email}`, true);
    await loadDashboardMetrics();
  } catch (error) {
    setLoginStatus("Login failed.", false);
    alert(error.message);
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = "Login";
    }
  }
};

const logoutAdmin = () => {
  localStorage.removeItem(STORAGE_KEYS.token);
  getElement("adminToken").value = "";
  getElement("adminPassword").value = "";
  setLoginStatus("Not logged in.", false);
};

const writeOutput = (id, value) => {
  const el = getElement(id);
  if (!el) return;
  el.textContent = typeof value === "string" ? value : formatJson(value);
};

// ---- Reports Table Helpers and State ----
const reportQueueState = {
  reports: [],
  page: 1,
  pageSize: 25,
  sortKey: "openReportsCount",
  sortDirection: "desc",
  expanded: true,
};

const auditState = {
  logs: [],
  sortKey: "createdAt",
  sortDirection: "desc",
};

const videoManagementState = {
  videos: [],
  page: 1,
  pageSize: 10,
  sortKey: "createdAt",
  sortDirection: "desc",
  expanded: true,
  search: "",
  visibility: "all",
  deleted: "all",
};

const userManagementState = {
  users: [],
  page: 1,
  pageSize: 10,
  sortKey: "createdAt",
  sortDirection: "desc",
  expanded: true,
  search: "",
  status: "all",
};

const commentManagementState = {
  comments: [],
  page: 1,
  pageSize: 10,
  sortKey: "createdAt",
  sortDirection: "desc",
  expanded: true,
  search: "",
  status: "all",
};

const couponManagementState = {
  redemptions: [],
  page: 1,
  pageSize: 10,
  sortKey: "createdAt",
  sortDirection: "desc",
  search: "",
};

const paymentManagementState = {
  payments: [],
  page: 1,
  pageSize: 10,
  sortKey: "createdAt",
  sortDirection: "desc",
  search: "",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const shortText = (value, maxLength = 26) => {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const getSortValue = (report, key) => {
  if (key === "createdAt") return new Date(report.createdAt ?? 0).getTime();
  return String(report[key] ?? "").toLowerCase();
};

const withLoadingButton = async (buttonId, loadingText, fn) => {
  const button = getElement(buttonId);

  if (button) {
    button.disabled = true;
    button.textContent = loadingText;
  }

  try {
    await fn();

    if (button) {
      button.disabled = false;
      button.textContent = "✓ Loaded";

      setTimeout(() => {
        button.textContent = button.dataset.originalText || button.textContent;
      }, 1500);
    }
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || button.textContent;
    }

    throw error;
  }
};

const loadAuditLogs = async () => {
  try {
    await withLoadingButton("loadAuditBtn", "Loading Audit Logs...", async () => {
      const container = getElement("auditOutput");

      if (container) {
        container.innerHTML = "Loading audit logs...";
      }

      const data = await requestAdminApi("/admin/audit");
      auditState.logs = data?.auditLogs || [];
      renderAuditTable();
    });
  } catch (error) {
    writeOutput("auditOutput", error.message);
  }
};

const renderAuditTable = () => {
  const container = getElement("auditOutput");
  if (!container) return;
  container.style.fontFamily = "Inter, Arial, sans-serif";
  container.style.whiteSpace = "normal";
  container.style.overflow = "visible";

  const auditLogs = [...auditState.logs].sort((a, b) => {
    const aValue = auditState.sortKey === "createdAt"
      ? new Date(a.createdAt ?? 0).getTime()
      : String(a[auditState.sortKey] ?? "").toLowerCase();

    const bValue = auditState.sortKey === "createdAt"
      ? new Date(b.createdAt ?? 0).getTime()
      : String(b[auditState.sortKey] ?? "").toLowerCase();

    if (aValue < bValue) return auditState.sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return auditState.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (auditLogs.length === 0) {
    container.innerHTML = "<p>No audit records found.</p>";
    return;
  }

  const sortIcon = (key) => {
    if (auditState.sortKey !== key) return "↕";
    return auditState.sortDirection === "asc" ? "↑" : "↓";
  };

  const rows = auditLogs
    .map((log, index) => {
      const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const actionLabel = String(log.actionType ?? "").replaceAll("_", " ").toLowerCase();
      const entityLabel = String(log.entityType ?? "").replaceAll("_", " ").toLowerCase();

      return `
        <tr style="background:${rowBackground};">
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;color:#334155;font-size:14px;">
            ${escapeHtml(formatDateTime(log.createdAt))}
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;border:1px solid #c4b5fd;font-weight:800;font-size:12px;text-transform:capitalize;white-space:nowrap;">
              ${escapeHtml(actionLabel)}
            </span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;color:#334155;font-size:14px;text-transform:capitalize;white-space:nowrap;">
            ${escapeHtml(entityLabel)}
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;color:#334155;font-size:14px;" title="${escapeHtml(log.entityId)}">
            ${escapeHtml(shortText(log.entityId, 28))}
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;color:#334155;font-size:14px;">
            ${escapeHtml(log.reason || "-")}
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;">
            <button onclick="copyAuditEntityId('${escapeHtml(log.entityId || "")}')" style="padding:7px 10px;border-radius:8px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;font-size:12px;">
              Copy ID
            </button>
            <button onclick="showAuditMetadata('${escapeHtml(log.id || "")}')" style="padding:7px 10px;border-radius:8px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;margin-left:6px;font-size:12px;">
              Metadata
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
      <div style="font-weight:800;color:#334155;font-size:15px;">
        Showing ${auditLogs.length} audit records
      </div>
    </div>

    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:980px;font-family:Inter, Arial, sans-serif;line-height:1.35;">
        <thead>
          <tr style="background:#f8fafc;">
            <th onclick="sortAudit('createdAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;font-size:14px;color:#0f172a;">Time ${sortIcon("createdAt")}</th>
            <th onclick="sortAudit('actionType')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;font-size:14px;color:#0f172a;">Action ${sortIcon("actionType")}</th>
            <th onclick="sortAudit('entityType')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;font-size:14px;color:#0f172a;">Entity ${sortIcon("entityType")}</th>
            <th onclick="sortAudit('entityId')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;font-size:14px;color:#0f172a;">Entity ID ${sortIcon("entityId")}</th>
            <th onclick="sortAudit('reason')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;font-size:14px;color:#0f172a;">Reason ${sortIcon("reason")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;font-size:14px;color:#0f172a;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

const loadVideos = async () => {
  try {
    await withLoadingButton("loadVideosBtn", "Loading Videos...", async () => {
      const container = getElement("videosOutput");

      if (container) {
        container.innerHTML = "Loading videos...";
      }

      const data = await requestAdminApi("/admin/videos");
      videoManagementState.videos = data?.videos || [];
      videoManagementState.page = 1;
      videoManagementState.expanded = true;
      renderVideosTable();
    });
  } catch (error) {
    writeOutput("videosOutput", error.message);
  }
};

const getVideoSortValue = (video, key) => {
  if (key === "createdAt") return new Date(video.createdAt ?? 0).getTime();
  if (key === "deleted") return video.deletedAt ? 1 : 0;
  return String(video[key] ?? "").toLowerCase();
};

const renderVideosTable = () => {
  const container = getElement("videosOutput");
  if (!container) return;

  const videos = [...videoManagementState.videos].sort((a, b) => {
    const aValue = getVideoSortValue(a, videoManagementState.sortKey);
    const bValue = getVideoSortValue(b, videoManagementState.sortKey);

    if (aValue < bValue) return videoManagementState.sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return videoManagementState.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (!videoManagementState.expanded) {
    container.innerHTML = `
      <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f8fafc;">
        <strong>${videos.length} video records hidden</strong>
        <button onclick="toggleVideosExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
          Open Records
        </button>
      </div>
    `;
    return;
  }

  if (videos.length === 0) {
    container.innerHTML = "<p>No videos found.</p>";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(videos.length / videoManagementState.pageSize));
  videoManagementState.page = Math.min(videoManagementState.page, totalPages);

  const startIndex = (videoManagementState.page - 1) * videoManagementState.pageSize;
  const pageVideos = videos.slice(startIndex, startIndex + videoManagementState.pageSize);

  const sortIcon = (key) => {
    if (videoManagementState.sortKey !== key) return "↕";
    return videoManagementState.sortDirection === "asc" ? "↑" : "↓";
  };

  const rows = pageVideos
    .map((video, index) => {
      const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const isDeleted = Boolean(video.deletedAt);
      const statusColor = isDeleted ? "#dc2626" : video.playbackStatus === "ready" ? "#16a34a" : "#f97316";
      const thumbnail = video.thumbnailUrl
        ? `<img src="${escapeHtml(video.thumbnailUrl)}" alt="thumbnail" style="width:70px;height:90px;object-fit:cover;border-radius:10px;background:#0f172a;" />`
        : `<div style="width:70px;height:90px;display:grid;place-items:center;border-radius:10px;background:#e5e7eb;color:#64748b;font-size:12px;">No image</div>`;

      return `
        <tr style="background:${rowBackground};text-align:center;">
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;">${thumbnail}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;">
            <strong>${escapeHtml(shortText(video.title, 42))}</strong><br>
            <span style="color:#64748b;font-size:12px;" title="${escapeHtml(video.id)}">${escapeHtml(shortText(video.id, 28))}</span>
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;">
            ${escapeHtml(shortText(video.ownerEmail, 32))}<br>
            <span style="color:#64748b;font-size:12px;">${escapeHtml(video.ownerStatus)}</span>
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;">
            <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#f8fafc;color:${statusColor};border:1px solid #e5e7eb;font-weight:800;font-size:12px;">
              ${isDeleted ? "deleted" : escapeHtml(video.playbackStatus)}
            </span>
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(video.visibility)}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">${escapeHtml(formatDateTime(video.createdAt))}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;vertical-align:top;white-space:nowrap;">
<button onclick="showVideoDetails('${escapeHtml(video.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
  View
</button>
<button onclick="copyVideoId('${escapeHtml(video.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;margin-left:6px;">
  Copy ID
</button>
            ${isDeleted
              ? `<button onclick="restoreVideoFromTable('${escapeHtml(video.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;margin-left:6px;">Restore</button>`
              : `<button onclick="deleteVideoFromTable('${escapeHtml(video.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;margin-left:6px;">Delete</button>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
      <div style="display:flex;gap:10px;align-items:center;">
        <label style="font-weight:700;">Show</label>
        <select onchange="changeVideoPageSize(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
<option value="10" ${videoManagementState.pageSize === 10 ? "selected" : ""}>10</option>
<option value="20" ${videoManagementState.pageSize === 20 ? "selected" : ""}>20</option>
<option value="50" ${videoManagementState.pageSize === 50 ? "selected" : ""}>50</option>
<option value="100" ${videoManagementState.pageSize === 100 ? "selected" : ""}>100</option>
        </select>
        <span>entries</span>
      </div>

      <button onclick="toggleVideosExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Close Records
      </button>
    </div>

    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:1100px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Thumbnail</th>
            <th onclick="sortVideos('title')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Title ${sortIcon("title")}</th>
            <th onclick="sortVideos('ownerEmail')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Owner ${sortIcon("ownerEmail")}</th>
            <th onclick="sortVideos('deleted')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Status ${sortIcon("deleted")}</th>
            <th onclick="sortVideos('visibility')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Visibility ${sortIcon("visibility")}</th>
            <th onclick="sortVideos('createdAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Created ${sortIcon("createdAt")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <span>Showing ${startIndex + 1} to ${Math.min(startIndex + videoManagementState.pageSize, videos.length)} of ${videos.length} videos</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="changeVideoPage(${videoManagementState.page - 1})" ${videoManagementState.page <= 1 ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Prev</button>
        <strong>Page ${videoManagementState.page} / ${totalPages}</strong>
        <button onclick="changeVideoPage(${videoManagementState.page + 1})" ${videoManagementState.page >= totalPages ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Next</button>
      </div>
    </div>
  `;
};

window.sortVideos = (key) => {
  if (videoManagementState.sortKey === key) {
    videoManagementState.sortDirection = videoManagementState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    videoManagementState.sortKey = key;
    videoManagementState.sortDirection = key === "createdAt" ? "desc" : "asc";
  }

  videoManagementState.page = 1;
  renderVideosTable();
};

window.sortAudit = (key) => {
  if (auditState.sortKey === key) {
    auditState.sortDirection = auditState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    auditState.sortKey = key;
    auditState.sortDirection = key === "createdAt" ? "desc" : "asc";
  }

  renderAuditTable();
};

window.copyAuditEntityId = async (entityId) => {
  try {
    await navigator.clipboard.writeText(entityId);
    alert("Entity ID copied");
  } catch {
    prompt("Copy Entity ID", entityId);
  }
};

window.showAuditMetadata = (auditLogId) => {
  const log = auditState.logs.find((item) => item.id === auditLogId);
  if (!log) {
    alert("Audit log not found");
    return;
  }

  alert(formatJson({
    id: log.id,
    adminUserId: log.adminUserId,
    actionType: log.actionType,
    entityType: log.entityType,
    entityId: log.entityId,
    reason: log.reason,
    metadata: log.metadata,
    createdAt: log.createdAt,
  }));
};

window.copyVideoId = async (videoId) => {
  try {
    await navigator.clipboard.writeText(videoId);
    alert("Video ID copied");
  } catch {
    prompt("Copy Video ID", videoId);
  }
};

window.changeVideoPage = (page) => {
  const totalPages = Math.max(1, Math.ceil(videoManagementState.videos.length / videoManagementState.pageSize));
  videoManagementState.page = Math.min(Math.max(1, Number(page)), totalPages);
  renderVideosTable();
};

window.changeVideoPageSize = (pageSize) => {
  videoManagementState.pageSize = Number(pageSize) || 50;
  videoManagementState.page = 1;
  renderVideosTable();
};

window.toggleVideosExpanded = () => {
  videoManagementState.expanded = !videoManagementState.expanded;
  renderVideosTable();
};

window.showVideoDetails = async (videoId) => {
  const panel = getElement("selectedVideoPanel");
  const output = getElement("selectedVideoOutput");

  if (!panel || !output) return;

  panel.style.display = "block";
  output.innerHTML = "Loading video details...";

  try {
    const video = await requestAdminApi(`/admin/videos/${videoId}`);
    renderSelectedVideoDetails(videoId, video);
  } catch (error) {
    output.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
};

const renderSelectedVideoDetails = (videoId, video) => {
  const output = getElement("selectedVideoOutput");
  if (!output) return;

  const isDeleted = Boolean(video.video?.deletedAt);
  const playbackUrl = video.video?.hlsUrl || video.video?.playbackUrl || "";
  const thumbnailUrl = video.video?.thumbnailUrl || "";

  output.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px;">
      <strong style="font-size:18px;color:#5b21b6;">Video ${escapeHtml(shortText(videoId, 18))}</strong>
      <button onclick="closeSelectedVideoPanel()" style="padding:8px 12px;border-radius:9px;border:1px solid #6d28d9;background:#6d28d9;color:white;font-weight:800;cursor:pointer;">
        Close Details ×
      </button>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
      <button onclick="showVideoDetails('${escapeHtml(videoId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Refresh Details
      </button>
      ${isDeleted
        ? `<button onclick="restoreVideoFromTable('${escapeHtml(videoId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;">Restore Video</button>`
        : `<button onclick="deleteVideoFromTable('${escapeHtml(videoId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;">Delete Video</button>`
      }
    </div>

    <div style="display:grid;grid-template-columns:minmax(280px, 420px) 1fr;gap:18px;align-items:start;">
      <div style="border:1px solid #e5e7eb;border-radius:16px;background:#020617;padding:12px;">
        ${playbackUrl
          ? `<video controls playsinline preload="metadata" poster="${escapeHtml(thumbnailUrl)}" src="${escapeHtml(playbackUrl)}" style="width:100%;max-height:520px;border-radius:12px;background:#000;display:block;"></video>`
          : `<div style="min-height:260px;display:grid;place-items:center;color:#cbd5e1;background:#0f172a;border-radius:12px;">No playback URL available</div>`
        }
      </div>

      <div style="display:grid;gap:16px;">
        <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
          <h4 style="margin-bottom:10px;">Video Details</h4>
          <p><strong>Video ID:</strong> ${escapeHtml(videoId)}</p>
          <p><strong>Title:</strong> ${escapeHtml(video.video?.title ?? "")}</p>
          <p><strong>Owner:</strong> ${escapeHtml(video.owner?.email ?? "")}</p>
          <p><strong>Status:</strong> ${escapeHtml(video.video?.playbackStatus ?? "")}</p>
          <p><strong>Visibility:</strong> ${escapeHtml(video.video?.visibility ?? "")}</p>
          <p><strong>Deleted:</strong> ${isDeleted ? escapeHtml(video.video?.deletedAt) : "No"}</p>
          <p><strong>Description:</strong> ${escapeHtml(video.video?.description ?? "")}</p>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
          <h4 style="margin-bottom:10px;">Video Stats</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
            <div><strong>${escapeHtml(video.stats?.uniqueViewsCount ?? 0)}</strong><br><span>Unique Views</span></div>
            <div><strong>${escapeHtml(video.stats?.totalViewsCount ?? 0)}</strong><br><span>Total Views</span></div>
            <div><strong>${escapeHtml(video.stats?.likesCount ?? 0)}</strong><br><span>Likes</span></div>
            <div><strong>${escapeHtml(video.stats?.dislikesCount ?? 0)}</strong><br><span>Dislikes</span></div>
            <div><strong>${escapeHtml(video.stats?.commentsCount ?? 0)}</strong><br><span>Comments</span></div>
            <div><strong>${escapeHtml(video.stats?.openReportsCount ?? 0)}</strong><br><span>Open Reports</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

window.deleteVideoFromTable = async (videoId) => {
  if (!confirm("Delete this video? This will soft-delete it from feeds.")) return;
  await requestAdminApi(`/admin/videos/${videoId}/delete`, { method: "POST" });
  await loadVideos();
  await window.showVideoDetails(videoId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.restoreVideoFromTable = async (videoId) => {
  if (!confirm("Restore this video?")) return;
  await requestAdminApi(`/admin/videos/${videoId}/restore`, { method: "POST" });
  await loadVideos();
  await window.showVideoDetails(videoId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.closeSelectedVideoPanel = () => {
  const panel = getElement("selectedVideoPanel");
  const output = getElement("selectedVideoOutput");

  if (panel) panel.style.display = "none";
  if (output) output.innerHTML = "";
};

const loadComments = async () => {
  try {
    await withLoadingButton("loadCommentsBtn", "Loading Comments...", async () => {
      const container = getElement("commentsOutput");

      if (container) {
        container.innerHTML = "Loading comments...";
      }

      const data = await requestAdminApi("/admin/comments");
      commentManagementState.comments = data?.comments || [];
      commentManagementState.page = 1;
      commentManagementState.expanded = true;
      renderCommentsTable();
    });
  } catch (error) {
    writeOutput("commentsOutput", error.message);
  }
};

const getCommentSortValue = (comment, key) => {
  if (key === "createdAt") return new Date(comment.createdAt ?? 0).getTime();
  if (key === "deleted") return comment.deletedAt ? 1 : 0;
  return String(comment[key] ?? "").toLowerCase();
};

const getFilteredComments = () => {
  const normalizedSearch = commentManagementState.search.trim().toLowerCase();

  return commentManagementState.comments.filter((comment) => {
    const matchesSearch = !normalizedSearch || [
      comment.id,
      comment.text,
      comment.userEmail,
      comment.userDisplayName,
      comment.videoId,
      comment.videoTitle,
    ].some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));

    const matchesStatus =
      commentManagementState.status === "all" ||
      (commentManagementState.status === "active" && !comment.deletedAt) ||
      (commentManagementState.status === "deleted" && Boolean(comment.deletedAt));

    return matchesSearch && matchesStatus;
  });
};

const renderCommentsTable = () => {
  const container = getElement("commentsOutput");
  if (!container) return;

  const comments = [...getFilteredComments()].sort((a, b) => {
    const aValue = getCommentSortValue(a, commentManagementState.sortKey);
    const bValue = getCommentSortValue(b, commentManagementState.sortKey);

    if (aValue < bValue) return commentManagementState.sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return commentManagementState.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (!commentManagementState.expanded) {
    container.innerHTML = `
      <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f8fafc;">
        <strong>${comments.length} comment records hidden</strong>
        <button onclick="toggleCommentsExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
          Open Records
        </button>
      </div>
    `;
    return;
  }

  if (comments.length === 0) {
    container.innerHTML = "<p>No comments found.</p>";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(comments.length / commentManagementState.pageSize));
  commentManagementState.page = Math.min(commentManagementState.page, totalPages);

  const startIndex = (commentManagementState.page - 1) * commentManagementState.pageSize;
  const pageComments = comments.slice(startIndex, startIndex + commentManagementState.pageSize);

  const sortIcon = (key) => {
    if (commentManagementState.sortKey !== key) return "↕";
    return commentManagementState.sortDirection === "asc" ? "↑" : "↓";
  };

  const rows = pageComments
    .map((comment, index) => {
      const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const isDeleted = Boolean(comment.deletedAt);
      const isReply = Boolean(comment.parentCommentId);
      const statusColor = isDeleted ? "#dc2626" : "#16a34a";

      return `
        <tr style="background:${rowBackground};">
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <strong>${escapeHtml(shortText(comment.text, 54))}</strong><br>
            <span style="color:#64748b;font-size:12px;">${isReply ? "Reply" : "Comment"}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            ${escapeHtml(shortText(comment.userDisplayName || comment.userEmail, 32))}<br>
            <span style="color:#64748b;font-size:12px;">${escapeHtml(shortText(comment.userEmail, 32))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            ${escapeHtml(shortText(comment.videoTitle, 36))}<br>
            <span style="color:#64748b;font-size:12px;" title="${escapeHtml(comment.videoId)}">${escapeHtml(shortText(comment.videoId, 24))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#f8fafc;color:${statusColor};border:1px solid #e5e7eb;font-weight:800;font-size:12px;">
              ${isDeleted ? "deleted" : "active"}
            </span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;color:#334155;">
            ${escapeHtml(formatDateTime(comment.createdAt))}
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;">
            <button onclick="showCommentDetails('${escapeHtml(comment.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
              View
            </button>
            <button onclick="copyCommentId('${escapeHtml(comment.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;margin-left:6px;">
              Copy ID
            </button>
            ${isDeleted
              ? ""
              : `<button onclick="deleteCommentFromTable('${escapeHtml(comment.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;margin-left:6px;">Delete</button>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="margin-top:16px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end;">
      <label style="display:grid;gap:6px;font-weight:700;">
        Search
        <input value="${escapeHtml(commentManagementState.search)}" oninput="setCommentSearch(this.value)" placeholder="Text, user, video, ID" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
      </label>

      <label style="display:grid;gap:6px;font-weight:700;">
        Status
        <select onchange="setCommentStatusFilter(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
          <option value="all" ${commentManagementState.status === "all" ? "selected" : ""}>All</option>
          <option value="active" ${commentManagementState.status === "active" ? "selected" : ""}>Active</option>
          <option value="deleted" ${commentManagementState.status === "deleted" ? "selected" : ""}>Deleted</option>
        </select>
      </label>

      <div style="display:flex;gap:10px;align-items:center;">
        <label style="font-weight:700;">Show</label>
        <select onchange="changeCommentPageSize(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
          <option value="10" ${commentManagementState.pageSize === 10 ? "selected" : ""}>10</option>
          <option value="20" ${commentManagementState.pageSize === 20 ? "selected" : ""}>20</option>
          <option value="50" ${commentManagementState.pageSize === 50 ? "selected" : ""}>50</option>
          <option value="100" ${commentManagementState.pageSize === 100 ? "selected" : ""}>100</option>
        </select>
        <span>entries</span>
      </div>

      <button onclick="exportFilteredComments()" style="padding:10px 14px;border-radius:10px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;">
        Export Comments CSV
      </button>

      <button onclick="toggleCommentsExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Close Records
      </button>
    </div>

    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:1100px;font-family:Inter, Arial, sans-serif;line-height:1.35;">
        <thead>
          <tr style="background:#f8fafc;">
            <th onclick="sortComments('text')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Comment ${sortIcon("text")}</th>
            <th onclick="sortComments('userEmail')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">User ${sortIcon("userEmail")}</th>
            <th onclick="sortComments('videoTitle')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Video ${sortIcon("videoTitle")}</th>
            <th onclick="sortComments('deleted')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Status ${sortIcon("deleted")}</th>
            <th onclick="sortComments('createdAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Created ${sortIcon("createdAt")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <span>Showing ${startIndex + 1} to ${Math.min(startIndex + commentManagementState.pageSize, comments.length)} of ${comments.length} comments</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="changeCommentPage(${commentManagementState.page - 1})" ${commentManagementState.page <= 1 ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Prev</button>
        <strong>Page ${commentManagementState.page} / ${totalPages}</strong>
        <button onclick="changeCommentPage(${commentManagementState.page + 1})" ${commentManagementState.page >= totalPages ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Next</button>
      </div>
    </div>
  `;
};

window.sortComments = (key) => {
  if (commentManagementState.sortKey === key) {
    commentManagementState.sortDirection = commentManagementState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    commentManagementState.sortKey = key;
    commentManagementState.sortDirection = key === "createdAt" ? "desc" : "asc";
  }

  commentManagementState.page = 1;
  renderCommentsTable();
};

window.changeCommentPage = (page) => {
  const totalPages = Math.max(1, Math.ceil(getFilteredComments().length / commentManagementState.pageSize));
  commentManagementState.page = Math.min(Math.max(1, Number(page)), totalPages);
  renderCommentsTable();
};

window.changeCommentPageSize = (pageSize) => {
  commentManagementState.pageSize = Number(pageSize) || 10;
  commentManagementState.page = 1;
  renderCommentsTable();
};

window.setCommentSearch = (value) => {
  commentManagementState.search = value;
  commentManagementState.page = 1;
  renderCommentsTable();
};

window.setCommentStatusFilter = (value) => {
  commentManagementState.status = value;
  commentManagementState.page = 1;
  renderCommentsTable();
};

window.toggleCommentsExpanded = () => {
  commentManagementState.expanded = !commentManagementState.expanded;
  renderCommentsTable();
};

window.copyCommentId = async (commentId) => {
  try {
    await navigator.clipboard.writeText(commentId);
    alert("Comment ID copied");
  } catch {
    prompt("Copy Comment ID", commentId);
  }
};

window.exportFilteredComments = () => {
  const rows = getFilteredComments();
  if (rows.length === 0) {
    alert("No comments available to export");
    return;
  }

  const headers = ["id", "videoId", "userId", "userEmail", "userDisplayName", "parentCommentId", "text", "videoTitle", "deletedAt", "deletedByType", "deletedByUserId", "moderationReason", "createdAt", "updatedAt"];
  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((comment) => headers.map((header) => escapeCsv(comment[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "iadme-comments.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

window.showCommentDetails = (commentId) => {
  const panel = getElement("selectedCommentPanel");
  const output = getElement("selectedCommentOutput");

  if (!panel || !output) return;

  const comment = commentManagementState.comments.find((item) => item.id === commentId);

  if (!comment) {
    output.innerHTML = "<p>Comment not found.</p>";
    panel.style.display = "block";
    return;
  }

  const isDeleted = Boolean(comment.deletedAt);
  const isReply = Boolean(comment.parentCommentId);

  panel.style.display = "block";
  output.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px;">
      <strong style="font-size:18px;color:#5b21b6;">Comment ${escapeHtml(shortText(comment.id, 18))}</strong>
      <button onclick="closeSelectedCommentPanel()" style="padding:8px 12px;border-radius:9px;border:1px solid #6d28d9;background:#6d28d9;color:white;font-weight:800;cursor:pointer;">
        Close Details ×
      </button>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
      <button onclick="copyCommentId('${escapeHtml(comment.id)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;">
        Copy Comment ID
      </button>
      <button onclick="copyVideoId('${escapeHtml(comment.videoId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;">
        Copy Video ID
      </button>
      <button onclick="showVideoDetails('${escapeHtml(comment.videoId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
  Open Video
</button>
      ${isDeleted
        ? ""
        : `<button onclick="deleteCommentFromTable('${escapeHtml(comment.id)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;">Delete Comment</button>`
      }
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
      <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
        <h4 style="margin-bottom:10px;">Comment</h4>
        <p><strong>Comment ID:</strong> ${escapeHtml(comment.id)}</p>
        <p><strong>Type:</strong> ${isReply ? "Reply" : "Comment"}</p>
        <p><strong>Status:</strong> ${isDeleted ? "Deleted" : "Active"}</p>
        <p><strong>Text:</strong> ${escapeHtml(comment.text)}</p>
        <p><strong>Created:</strong> ${escapeHtml(formatDateTime(comment.createdAt))}</p>
        <p><strong>Deleted At:</strong> ${isDeleted ? escapeHtml(formatDateTime(comment.deletedAt)) : "-"}</p>
        <p><strong>Deleted By:</strong> ${escapeHtml(comment.deletedByType || "-")}</p>
        <p><strong>Deleted By User ID:</strong> ${escapeHtml(comment.deletedByUserId || "-")}</p>
        <p><strong>Moderation Reason:</strong> ${escapeHtml(comment.moderationReason || "-")}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
        <h4 style="margin-bottom:10px;">User & Video</h4>
        <p><strong>User:</strong> ${escapeHtml(comment.userDisplayName || "-")}</p>
        <p><strong>Email:</strong> ${escapeHtml(comment.userEmail || "-")}</p>
        <p><strong>User ID:</strong> ${escapeHtml(comment.userId)}</p>
        <p><strong>Video:</strong> ${escapeHtml(comment.videoTitle || "-")}</p>
        <p><strong>Video ID:</strong> ${escapeHtml(comment.videoId)}</p>
        <p><strong>Parent Comment ID:</strong> ${escapeHtml(comment.parentCommentId || "-")}</p>
      </div>
    </div>
  `;
};

window.deleteCommentFromTable = async (commentId) => {
  const comment = commentManagementState.comments.find((item) => item.id === commentId);
  const reason = prompt(
    `Reason for deleting comment:\n\n${shortText(comment?.text || "this comment", 80)}`,
    "Admin moderation"
  );

  if (reason === null) return;
  if (!reason.trim()) {
    alert("Delete reason is required.");
    return;
  }

  await requestAdminApi(`/admin/comments/${commentId}/delete`, {
    method: "POST",
    body: JSON.stringify({ reason: reason.trim() }),
  });

  await loadComments();
  await loadAuditLogs();
  await loadDashboardMetrics();

  const panel = getElement("selectedCommentPanel");
  if (panel && panel.style.display !== "none") {
    window.showCommentDetails(commentId);
  }
};

window.closeSelectedCommentPanel = () => {
  const panel = getElement("selectedCommentPanel");
  const output = getElement("selectedCommentOutput");

  if (panel) panel.style.display = "none";
  if (output) output.innerHTML = "";
};

const formatMoney = (amount, currency) => {
  const value = Number(amount ?? 0) / 100;
  return `${currency || ""} ${value.toFixed(2)}`.trim();
};

const paymentStatusBadge = (status) => {
  const normalized = String(status || "").toLowerCase();
  const colors = {
    credited: ["#dcfce7", "#166534", "#86efac"],
    refunded: ["#fee2e2", "#991b1b", "#fecaca"],
    partially_refunded: ["#ffedd5", "#9a3412", "#fed7aa"],
    failed: ["#fee2e2", "#991b1b", "#fecaca"],
    created: ["#e0f2fe", "#075985", "#bae6fd"],
    verified: ["#ede9fe", "#5b21b6", "#c4b5fd"],
  };
  const [background, color, border] =
    colors[normalized] || ["#f8fafc", "#334155", "#e5e7eb"];

  return `<span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${background};color:${color};border:1px solid ${border};font-weight:800;font-size:12px;white-space:nowrap;">${escapeHtml(status || "-")}</span>`;
};

const commerceMetricCard = (label, value, tone = "neutral") => {
  const tones = {
    neutral: ["#f8fafc", "#0f172a", "#e2e8f0"],
    good: ["#f0fdf4", "#166534", "#86efac"],
    warning: ["#fffbeb", "#92400e", "#fde68a"],
    bad: ["#fef2f2", "#991b1b", "#fecaca"],
  };
  const [background, color, border] = tones[tone] || tones.neutral;

  return `
    <div style="padding:14px;border:1px solid ${border};border-radius:12px;background:${background};">
      <div style="font-size:12px;color:#64748b;font-weight:800;text-transform:uppercase;">${escapeHtml(label)}</div>
      <div style="margin-top:6px;color:${color};font-size:22px;font-weight:900;">${escapeHtml(value)}</div>
    </div>
  `;
};

const loadCommerceDashboard = async () => {
  try {
    await withLoadingButton(
      "loadCommerceDashboardBtn",
      "Loading Dashboard...",
      async () => {
        const output = getElement("commerceDashboardOutput");
        if (output) output.innerHTML = "Loading commerce dashboard...";

        const data = await requestAdminApi("/admin/payments/dashboard");
        const orders = data.orders || {};
        const revenue = data.revenue || {};
        const wallet = data.wallet || {};
        const invoices = data.invoices || {};
        const refunds = data.refunds || {};

        if (output) {
          output.innerHTML = `
            <div style="padding:16px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
                <h4 style="margin:0;font-size:20px;">Commerce Dashboard</h4>
                <span style="color:#64748b;font-size:13px;">Generated ${escapeHtml(formatDateTime(data.generatedAt))}</span>
              </div>
              <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
                ${commerceMetricCard("Orders", orders.total ?? 0)}
                ${commerceMetricCard("Credited", orders.credited ?? 0, "good")}
                ${commerceMetricCard("Failed", orders.failed ?? 0, orders.failed ? "bad" : "neutral")}
                ${commerceMetricCard("Gross", formatMoney(revenue.grossAmount, data.currency))}
                ${commerceMetricCard("Refunded", formatMoney(revenue.refundedAmount, data.currency), refunds.processed ? "warning" : "neutral")}
                ${commerceMetricCard("Net", formatMoney(revenue.netAmount, data.currency), "good")}
                ${commerceMetricCard("GST", formatMoney(revenue.gstAmount, data.currency))}
                ${commerceMetricCard("Net Stars", `${wallet.netStars ?? 0} Stars`)}
                ${commerceMetricCard("Invoice PDF Failed", invoices.pdfFailed ?? 0, invoices.pdfFailed ? "bad" : "good")}
                ${commerceMetricCard("Invoice Email Failed", invoices.emailFailed ?? 0, invoices.emailFailed ? "bad" : "good")}
                ${commerceMetricCard("Refund Reversal Issues", (refunds.insufficientBalance ?? 0) + (refunds.failed ?? 0), (refunds.insufficientBalance || refunds.failed) ? "warning" : "good")}
              </div>
            </div>
          `;
        }
      }
    );
  } catch (error) {
    writeOutput("commerceDashboardOutput", error.message);
  }
};

const renderReconciliationRows = (rows) => {
  if (!rows?.length) {
    return `<p style="margin:8px 0 0;color:#16a34a;font-weight:800;">No rows found.</p>`;
  }

  return `
    <div style="margin-top:10px;overflow:auto;border:1px solid #e5e7eb;border-radius:10px;background:white;">
      <table style="width:100%;border-collapse:collapse;min-width:900px;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:9px;border:1px solid #e5e7eb;">Record</th>
            <th style="text-align:left;padding:9px;border:1px solid #e5e7eb;">Status</th>
            <th style="text-align:left;padding:9px;border:1px solid #e5e7eb;">Amount</th>
            <th style="text-align:left;padding:9px;border:1px solid #e5e7eb;">Details</th>
            <th style="text-align:left;padding:9px;border:1px solid #e5e7eb;">Created</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((row) => {
              const record =
                row.payment_order_id ||
                row.payment_refund_id ||
                row.invoice_id ||
                "-";
              const status =
                row.financial_status ||
                row.status ||
                row.email_status ||
                row.pdf_status ||
                "-";
              const amount =
                row.amount !== undefined
                  ? formatMoney(row.amount, "INR")
                  : row.refunded_amount !== undefined
                    ? formatMoney(row.refunded_amount, "INR")
                    : "-";
              const details = [
                row.provider_order_id,
                row.provider_payment_id,
                row.provider_refund_id,
                row.invoice_number,
                row.financial_error,
                row.email_error,
                row.pdf_error,
              ]
                .filter(Boolean)
                .join(" / ");

              return `
                <tr>
                  <td style="padding:9px;border:1px solid #e5e7eb;" title="${escapeHtml(record)}">${escapeHtml(shortText(record, 34))}</td>
                  <td style="padding:9px;border:1px solid #e5e7eb;">${paymentStatusBadge(status)}</td>
                  <td style="padding:9px;border:1px solid #e5e7eb;">${escapeHtml(amount)}</td>
                  <td style="padding:9px;border:1px solid #e5e7eb;" title="${escapeHtml(details)}">${escapeHtml(shortText(details || "-", 70))}</td>
                  <td style="padding:9px;border:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(formatDateTime(row.created_at || row.createdAt))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const runPaymentReconciliation = async () => {
  try {
    await withLoadingButton(
      "runPaymentReconciliationBtn",
      "Reconciling...",
      async () => {
        const output = getElement("paymentReconciliationOutput");
        if (output) output.innerHTML = "Running reconciliation...";

        const data = await requestAdminApi("/admin/payments/reconciliation", {
          allowConflict: true,
        });
        const buckets = data.buckets || [];
        const unhealthy = buckets.filter((bucket) => Number(bucket.count || 0) > 0);

        if (output) {
          output.innerHTML = `
            <div style="padding:16px;border:1px solid ${data.healthy ? "#86efac" : "#fecaca"};border-radius:14px;background:${data.healthy ? "#f0fdf4" : "#fef2f2"};">
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
                <h4 style="margin:0;font-size:20px;">Payment Reconciliation</h4>
                <strong style="color:${data.healthy ? "#166534" : "#991b1b"};">${data.healthy ? "Healthy" : `${unhealthy.length} anomaly groups`}</strong>
              </div>
              <p style="margin:8px 0 0;color:#64748b;">Generated ${escapeHtml(formatDateTime(data.generatedAt))}</p>
              <div style="margin-top:14px;display:grid;gap:12px;">
                ${buckets
                  .map(
                    (bucket) => `
                      <div style="padding:14px;border:1px solid ${bucket.count ? "#fecaca" : "#bbf7d0"};border-radius:12px;background:white;">
                        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
                          <strong>${escapeHtml(bucket.label)}</strong>
                          <span style="font-weight:900;color:${bucket.count ? "#991b1b" : "#166534"};">${escapeHtml(bucket.count)} rows</span>
                        </div>
                        ${renderReconciliationRows(bucket.rows)}
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
          `;
        }
      }
    );
  } catch (error) {
    writeOutput("paymentReconciliationOutput", error.message);
  }
};

const loadPayments = async () => {
  try {
    await withLoadingButton("loadPaymentsBtn", "Loading Payments...", async () => {
      const output = getElement("paymentsOutput");
      if (output) output.innerHTML = "Loading payments...";

      const params = new URLSearchParams();
      const email = getElement("paymentEmailFilter")?.value?.trim();
      const status = getElement("paymentStatusFilter")?.value?.trim();
      const providerPaymentId =
        getElement("paymentProviderPaymentIdFilter")?.value?.trim();
      const providerOrderId =
        getElement("paymentProviderOrderIdFilter")?.value?.trim();

      if (email) params.set("email", email);
      if (status) params.set("status", status);
      if (providerPaymentId) params.set("providerPaymentId", providerPaymentId);
      if (providerOrderId) params.set("providerOrderId", providerOrderId);

      const query = params.toString();
      const data = await requestAdminApi(
        `/admin/payments${query ? `?${query}` : ""}`
      );

      paymentManagementState.payments = data?.payments || [];
      paymentManagementState.search = "";
      paymentManagementState.page = 1;
      renderPaymentsTable();
    });
  } catch (error) {
    writeOutput("paymentsOutput", error.message);
  }
};

const getPaymentSortValue = (payment, key) => {
  if (key === "createdAt") return new Date(payment.createdAt ?? 0).getTime();
  if (key === "user") {
    return paymentUserLabel(payment).toLowerCase();
  }
  if (key === "amount" || key === "totalStars" || key === "refundedAmount") {
    return Number(payment[key] ?? 0);
  }
  return String(payment[key] ?? "").toLowerCase();
};

const paymentUserLabel = (payment) =>
  payment.userEmail ||
  payment.userPhoneNumber ||
  payment.userDisplayName ||
  payment.userId ||
  "-";

const getFilteredPayments = () => {
  const normalizedSearch = paymentManagementState.search.trim().toLowerCase();

  return paymentManagementState.payments.filter((payment) => {
    if (!normalizedSearch) return true;

    return [
      payment.id,
      payment.userId,
      payment.userEmail,
      payment.userPhoneNumber,
      payment.userDisplayName,
      payment.providerOrderId,
      payment.providerPaymentId,
      payment.starPackCode,
      payment.status,
      payment.latestRefundFinancialStatus,
    ].some((value) =>
      String(value ?? "").toLowerCase().includes(normalizedSearch)
    );
  });
};

const renderPaymentsTable = () => {
  const container = getElement("paymentsOutput");
  if (!container) return;

  if (!getElement("paymentsRowsOutput")) {
    container.innerHTML = `
      <div style="margin-top:16px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end;">
        <label style="display:grid;gap:6px;font-weight:700;">
          Search loaded rows
          <input id="paymentLoadedRowsSearch" value="${escapeHtml(paymentManagementState.search)}" oninput="setPaymentSearch(this.value)" placeholder="Email, phone, user id, payment id, status" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
        </label>

        <div style="display:flex;gap:10px;align-items:center;">
          <label style="font-weight:700;">Show</label>
          <select onchange="changePaymentPageSize(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
            <option value="10" ${paymentManagementState.pageSize === 10 ? "selected" : ""}>10</option>
            <option value="20" ${paymentManagementState.pageSize === 20 ? "selected" : ""}>20</option>
            <option value="50" ${paymentManagementState.pageSize === 50 ? "selected" : ""}>50</option>
          </select>
          <span>entries</span>
        </div>
      </div>

      <div id="paymentsRowsOutput"></div>
    `;
  }

  renderPaymentRows();
};

const renderPaymentRows = () => {
  const container = getElement("paymentsRowsOutput");
  if (!container) return;

  const payments = [...getFilteredPayments()].sort((a, b) => {
    const aValue = getPaymentSortValue(a, paymentManagementState.sortKey);
    const bValue = getPaymentSortValue(b, paymentManagementState.sortKey);

    if (aValue < bValue) return paymentManagementState.sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return paymentManagementState.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(payments.length / paymentManagementState.pageSize)
  );
  paymentManagementState.page = Math.min(paymentManagementState.page, totalPages);

  const startIndex =
    (paymentManagementState.page - 1) * paymentManagementState.pageSize;
  const pagePayments = payments.slice(
    startIndex,
    startIndex + paymentManagementState.pageSize
  );

  const sortIcon = (key) => {
    if (paymentManagementState.sortKey !== key) return "↕";
    return paymentManagementState.sortDirection === "asc" ? "↑" : "↓";
  };

  const rows = pagePayments.length > 0
    ? pagePayments.map((payment, index) => {
      const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const refundLabel = payment.refundCount
        ? `${payment.refundCount} / ${payment.latestRefundFinancialStatus || payment.latestRefundStatus || "-"}`
        : "-";
      const userLabel = paymentUserLabel(payment);

      return `
        <tr style="background:${rowBackground};">
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <strong>${escapeHtml(shortText(userLabel, 34))}</strong><br>
            <span style="color:#64748b;font-size:12px;" title="${escapeHtml(payment.userId)}">${escapeHtml(shortText(payment.userId, 28))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            ${paymentStatusBadge(payment.status)}<br>
            <span style="font-size:12px;color:#64748b;">${escapeHtml(payment.providerStatus || "-")}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <strong>${escapeHtml(formatMoney(payment.amount, payment.currency))}</strong><br>
            <span style="color:#64748b;font-size:12px;">Refunded ${escapeHtml(formatMoney(payment.refundedAmount, payment.currency))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            ${escapeHtml(payment.totalStars)} Stars<br>
            <span style="color:#64748b;font-size:12px;">${escapeHtml(payment.starPackCode || payment.starPackName || "-")}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <span title="${escapeHtml(payment.providerPaymentId || "")}">${escapeHtml(shortText(payment.providerPaymentId || "-", 26))}</span><br>
            <span style="color:#64748b;font-size:12px;" title="${escapeHtml(payment.providerOrderId || "")}">${escapeHtml(shortText(payment.providerOrderId || "-", 26))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">${escapeHtml(refundLabel)}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;">${escapeHtml(formatDateTime(payment.createdAt))}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;">
            <button onclick="showPaymentDetails('${escapeHtml(payment.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
              View
            </button>
          </td>
        </tr>
      `;
    })
    .join("")
    : `
      <tr>
        <td colspan="8" style="padding:16px;border:1px solid #e5e7eb;color:#64748b;text-align:center;">
          No payments found for this search.
        </td>
      </tr>
    `;

  container.innerHTML = `
    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:1200px;font-family:Inter, Arial, sans-serif;line-height:1.35;">
        <thead>
          <tr style="background:#f8fafc;">
            <th onclick="sortPayments('user')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">User ${sortIcon("user")}</th>
            <th onclick="sortPayments('status')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Status ${sortIcon("status")}</th>
            <th onclick="sortPayments('amount')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Amount ${sortIcon("amount")}</th>
            <th onclick="sortPayments('totalStars')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Stars ${sortIcon("totalStars")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Provider IDs</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Refunds</th>
            <th onclick="sortPayments('createdAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Created ${sortIcon("createdAt")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <span>Showing ${payments.length === 0 ? 0 : startIndex + 1} to ${Math.min(startIndex + paymentManagementState.pageSize, payments.length)} of ${payments.length} payments</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="changePaymentPage(${paymentManagementState.page - 1})" ${paymentManagementState.page <= 1 ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Prev</button>
        <strong>Page ${paymentManagementState.page} / ${totalPages}</strong>
        <button onclick="changePaymentPage(${paymentManagementState.page + 1})" ${paymentManagementState.page >= totalPages ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Next</button>
      </div>
    </div>
  `;
};

window.sortPayments = (key) => {
  if (paymentManagementState.sortKey === key) {
    paymentManagementState.sortDirection =
      paymentManagementState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    paymentManagementState.sortKey = key;
    paymentManagementState.sortDirection = key === "createdAt" ? "desc" : "asc";
  }

  paymentManagementState.page = 1;
  renderPaymentRows();
};

window.changePaymentPage = (page) => {
  const totalPages = Math.max(
    1,
    Math.ceil(getFilteredPayments().length / paymentManagementState.pageSize)
  );
  paymentManagementState.page = Math.min(Math.max(1, Number(page)), totalPages);
  renderPaymentRows();
};

window.changePaymentPageSize = (pageSize) => {
  paymentManagementState.pageSize = Number(pageSize) || 10;
  paymentManagementState.page = 1;
  renderPaymentRows();
};

window.setPaymentSearch = (value) => {
  paymentManagementState.search = value;
  paymentManagementState.page = 1;
  renderPaymentRows();
};

window.showPaymentDetails = async (paymentOrderId) => {
  const panel = getElement("selectedPaymentPanel");
  const output = getElement("selectedPaymentOutput");

  if (panel) panel.style.display = "block";
  if (output) output.innerHTML = "Loading payment details...";

  try {
    const data = await requestAdminApi(`/admin/payments/${paymentOrderId}`);
    const payment = data.payment || {};
    const refunds = data.refunds || [];
    const walletTransactions = data.walletTransactions || [];
    const invoice = payment.invoice || null;

    const refundRows = refunds.length
      ? refunds
          .map(
            (refund) => `
              <tr>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(shortText(refund.providerRefundId, 28))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${paymentStatusBadge(refund.status)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(formatMoney(refund.amount, refund.currency))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(refund.reversedStars)} Stars</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${paymentStatusBadge(refund.financialStatus)}<br><span style="font-size:12px;color:#64748b;">${escapeHtml(refund.financialError || "")}</span></td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(formatDateTime(refund.processedAt))}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="6" style="padding:12px;border:1px solid #e5e7eb;color:#64748b;">No refunds recorded.</td></tr>`;

    const walletRows = walletTransactions.length
      ? walletTransactions
          .map(
            (transaction) => `
              <tr>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(transaction.transactionType)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(transaction.status)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(transaction.amount)} ${escapeHtml(transaction.currency)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;" title="${escapeHtml(transaction.paymentRefundId || "")}">${escapeHtml(shortText(transaction.paymentRefundId || "-", 28))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(formatDateTime(transaction.completedAt || transaction.createdAt))}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="5" style="padding:12px;border:1px solid #e5e7eb;color:#64748b;">No wallet transactions linked.</td></tr>`;

    output.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:start;">
        <div>
          <strong>${escapeHtml(payment.userEmail || "-")}</strong><br>
          <span style="color:#64748b;font-size:12px;">${escapeHtml(payment.id || paymentOrderId)}</span>
        </div>
        <button onclick="closeSelectedPaymentPanel()" style="padding:8px 12px;border-radius:9px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;">Close</button>
      </div>

      <div style="margin-top:16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        <div><strong>Status</strong><br>${paymentStatusBadge(payment.status)}</div>
        <div><strong>Amount</strong><br>${escapeHtml(formatMoney(payment.amount, payment.currency))}</div>
        <div><strong>Refunded</strong><br>${escapeHtml(formatMoney(payment.refundedAmount, payment.currency))}</div>
        <div><strong>Stars</strong><br>${escapeHtml(payment.totalStars)} total / ${escapeHtml(payment.walletCreditedStars ?? "-")} credited</div>
        <div><strong>Razorpay Order</strong><br><span title="${escapeHtml(payment.providerOrderId || "")}">${escapeHtml(shortText(payment.providerOrderId || "-", 34))}</span></div>
        <div><strong>Razorpay Payment</strong><br><span title="${escapeHtml(payment.providerPaymentId || "")}">${escapeHtml(shortText(payment.providerPaymentId || "-", 34))}</span></div>
      </div>

      <h4 style="margin-top:20px;">Invoice</h4>
      ${invoice
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;border:1px solid #dbe3ef;border-radius:12px;padding:14px;background:#f8fafc;">
            <div><strong>Invoice No</strong><br>${escapeHtml(invoice.invoiceNumber)}</div>
            <div><strong>Taxable</strong><br>${escapeHtml(formatMoney(invoice.taxableAmount, payment.currency))}</div>
            <div><strong>GST</strong><br>${escapeHtml(formatMoney(invoice.totalTaxAmount, payment.currency))} / ${escapeHtml(String(invoice.taxMode || "").toUpperCase())}</div>
            <div><strong>SAC</strong><br>${escapeHtml(invoice.sacCode || "-")}</div>
            <div><strong>Email</strong><br>${escapeHtml(invoice.emailStatus || "-")}</div>
            <div><strong>PDF</strong><br>${escapeHtml(invoice.pdfStatus || "-")}</div>
            <div style="display:flex;align-items:end;">
              <button onclick="downloadPaymentInvoice('${escapeHtml(payment.id)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #6d28d9;background:#6d28d9;color:white;font-weight:800;cursor:pointer;">
                Download invoice PDF
              </button>
            </div>
          </div>`
        : `<p style="color:#64748b;">No invoice generated for this payment yet.</p>`
      }

      <h4 style="margin-top:20px;">Refunds</h4>
      <div style="overflow:auto;border:1px solid #dbe3ef;border-radius:12px;">
        <table style="width:100%;border-collapse:collapse;min-width:850px;">
          <thead><tr style="background:#f8fafc;">
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Refund ID</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Gateway</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Amount</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Stars</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Financial</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Processed</th>
          </tr></thead>
          <tbody>${refundRows}</tbody>
        </table>
      </div>

      <h4 style="margin-top:20px;">Wallet Transactions</h4>
      <div style="overflow:auto;border:1px solid #dbe3ef;border-radius:12px;">
        <table style="width:100%;border-collapse:collapse;min-width:760px;">
          <thead><tr style="background:#f8fafc;">
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Type</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Status</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Amount</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Refund Link</th>
            <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Completed</th>
          </tr></thead>
          <tbody>${walletRows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    if (output) {
      const message = error instanceof Error ? error.message : String(error);
      output.innerHTML = `
        <div style="padding:14px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2;color:#991b1b;">
          <strong>Unable to load payment details.</strong><br>
          ${escapeHtml(message)}
          <div style="margin-top:8px;color:#7f1d1d;font-size:13px;">
            If the list loads but details return 404, restart/rebuild the local API so the new <code>/admin/payments/:id</code> endpoint is running.
          </div>
        </div>
      `;
    }
  }
};

window.downloadPaymentInvoice = async (paymentOrderId) => {
  try {
    const data = await requestAdminApi(
      `/admin/payments/${paymentOrderId}/invoice/download`
    );

    if (!data?.downloadUrl) {
      throw new Error("Invoice download URL missing");
    }

    window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error));
  }
};

window.closeSelectedPaymentPanel = () => {
  const panel = getElement("selectedPaymentPanel");
  const output = getElement("selectedPaymentOutput");

  if (panel) panel.style.display = "none";
  if (output) output.innerHTML = "";
};

const createCoupon = async () => {
  const code = getElement("couponCode")?.value?.trim();
  const rewardType = getElement("couponRewardType")?.value;
  const rewardAmount = Number(getElement("couponRewardAmount")?.value);
  const currency = getElement("couponCurrency")?.value?.trim() || "INR";

  if (!code || !Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    alert("Coupon code and valid reward amount are required");
    return;
  }

  try {
    await withLoadingButton("createCouponBtn", "Creating Coupon...", async () => {
      const data = await requestAdminApi("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({ code, rewardType, rewardAmount, currency }),
      });

      getElement("couponsOutput").innerHTML = `
        <div style="padding:16px;border:1px solid #bbf7d0;border-radius:14px;background:#f0fdf4;color:#166534;">
          <strong>Coupon created successfully.</strong>
          <pre style="margin-top:12px;white-space:pre-wrap;">${escapeHtml(formatJson(data))}</pre>
        </div>
      `;

      getElement("couponCode").value = "";
      getElement("couponRewardAmount").value = "";

      await loadAuditLogs();
    });
  } catch (error) {
    writeOutput("couponsOutput", error.message);
  }
};

const loadCouponRedemptions = async () => {
  try {
    await withLoadingButton("loadCouponsBtn", "Loading Coupons...", async () => {
      const output = getElement("couponsOutput");
      if (output) output.innerHTML = "Loading coupon redemptions...";

      const data = await requestAdminApi("/admin/coupon-redemptions");
      couponManagementState.redemptions =
        data?.redemptions || data?.couponRedemptions || [];

      renderCouponRedemptionsTable();
    });
  } catch (error) {
    writeOutput("couponsOutput", error.message);
  }
};

const renderCouponRedemptionsTable = () => {
  const container = getElement("couponsOutput");
  if (!container) return;

  const search = couponManagementState.search.trim().toLowerCase();

  const rowsData = couponManagementState.redemptions.filter((r) => {
    if (!search) return true;

    return [
      r.id,
      r.couponId,
      r.couponCode,
      r.code,
      r.userId,
      r.userEmail,
      r.rewardType,
    ].some((v) => String(v ?? "").toLowerCase().includes(search));
  });

  if (rowsData.length === 0) {
    container.innerHTML = "<p>No coupon redemptions found.</p>";
    return;
  }

  const rows = rowsData
    .map((r, index) => {
      const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const code = r.couponCode || r.code || r.coupon?.code || "-";
      const rewardType = r.rewardType || r.coupon?.rewardType || "-";
      const rewardAmount = r.rewardAmount ?? r.coupon?.rewardAmount ?? "-";
      const user = r.userEmail || r.email || r.userId || "-";

      return `
        <tr style="background:${rowBackground};">
          <td style="padding:12px;border:1px solid #e5e7eb;">
            <strong>${escapeHtml(code)}</strong><br>
            <span style="color:#64748b;font-size:12px;">${escapeHtml(shortText(r.id, 28))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;">${escapeHtml(shortText(user, 36))}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;">${escapeHtml(rewardType)} / ${escapeHtml(rewardAmount)}</td>
          <td style="padding:12px;border:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(formatDateTime(r.createdAt))}</td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="margin-top:16px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;">
      <label style="display:grid;gap:6px;font-weight:700;max-width:360px;">
        Search
        <input
          value="${escapeHtml(couponManagementState.search)}"
          oninput="setCouponSearch(this.value)"
          placeholder="Code, user, redemption ID"
          style="padding:10px;border:1px solid #d1d5db;border-radius:10px;"
        />
      </label>
    </div>

    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:800px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Coupon</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">User</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Reward</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Redeemed</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

window.setCouponSearch = (value) => {
  couponManagementState.search = value;
  renderCouponRedemptionsTable();
};

const renderOperationsCards = (title, data) => {
  const output = getElement("operationsOutput");
  if (!output) return;

  const entries = Object.entries(data || {});

  if (entries.length === 0) {
    output.innerHTML = `<p>No ${escapeHtml(title.toLowerCase())} data found.</p>`;
    return;
  }

  const cards = entries
    .map(([key, value]) => {
      const isObject = value && typeof value === "object";

      return `
        <div style="border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;padding:16px;">
          <div style="font-size:13px;color:#64748b;font-weight:800;text-transform:uppercase;">
            ${escapeHtml(key)}
          </div>
          <div style="margin-top:10px;color:#0f172a;font-size:${isObject ? "13px" : "28px"};font-weight:${isObject ? "500" : "900"};">
            ${
              isObject
                ? `<pre style="white-space:pre-wrap;margin:0;">${escapeHtml(formatJson(value))}</pre>`
                : escapeHtml(value)
            }
          </div>
        </div>
      `;
    })
    .join("");

  output.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
      <strong style="font-size:16px;color:#334155;">${escapeHtml(title)}</strong>
      <span style="color:#64748b;font-size:13px;">Last refreshed: ${escapeHtml(formatDateTime(new Date().toISOString()))}</span>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
      ${cards}
    </div>
  `;
};

const loadQueueMetrics = async () => {
  try {
    await withLoadingButton("loadQueuesBtn", "Loading Queues...", async () => {
      const output = getElement("operationsOutput");
      if (output) output.innerHTML = "Loading queue metrics...";

      const data = await requestAdminApi("/admin/metrics/queues");

      const queues = data?.queues || [];

      const cards = queues.map((queue) => {
        const counts = queue.counts || {};
        const latency = queue.latency || {};

        return `
          <div style="
            border:1px solid #e5e7eb;
            border-radius:14px;
            background:#ffffff;
            padding:16px;
          ">
            <h4 style="margin-bottom:12px;">
              ${escapeHtml(queue.name || queue.key)}
            </h4>

            <div style="
              display:grid;
              grid-template-columns:repeat(3,1fr);
              gap:10px;
              margin-bottom:16px;
            ">
              <div><strong>${counts.waiting ?? 0}</strong><br>Waiting</div>
              <div><strong>${counts.active ?? 0}</strong><br>Active</div>
              <div><strong>${counts.completed ?? 0}</strong><br>Completed</div>
              <div><strong>${counts.failed ?? 0}</strong><br>Failed</div>
              <div><strong>${counts.delayed ?? 0}</strong><br>Delayed</div>
              <div><strong>${counts.paused ?? 0}</strong><br>Paused</div>
            </div>

            <div style="
              border-top:1px solid #e5e7eb;
              padding-top:12px;
              color:#64748b;
              font-size:13px;
            ">
              Avg Wait: ${latency.avgWaitMs ?? 0} ms<br>
              Avg Processing: ${latency.avgProcessingMs ?? 0} ms
            </div>
          </div>
        `;
      }).join("");

      output.innerHTML = `
        <div style="margin-bottom:12px;">
          <strong>Queue Metrics</strong>
          <span style="float:right;color:#64748b;">
            ${escapeHtml(formatDateTime(data.generatedAt))}
          </span>
        </div>

        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
          gap:16px;
        ">
          ${cards}
        </div>
      `;
    });
  } catch (error) {
    writeOutput("operationsOutput", error.message);
  }
};

const loadWorkerMetrics = async () => {
  try {
    await withLoadingButton("loadWorkersBtn", "Loading Workers...", async () => {
      const output = getElement("operationsOutput");
      if (output) output.innerHTML = "Loading worker metrics...";

      const data = await requestAdminApi("/admin/metrics/workers");
      const workers = data?.workers || data?.workerMetrics || [];

      if (!output) return;

      if (workers.length === 0) {
        output.innerHTML = "<p>No worker metrics found.</p>";
        return;
      }

      const cards = workers
        .map((worker) => {
          const name = worker.name || worker.key || worker.workerName || "Worker";
          const status = worker.status || worker.state || (worker.isRunning ? "running" : "unknown");
          const queueName = worker.queueName || worker.queue || worker.queueKey || "-";
          const concurrency = worker.concurrency ?? worker.workerConcurrency ?? "-";
          const processed = worker.processed ?? worker.completed ?? worker.completedCount ?? 0;
          const failed = worker.failed ?? worker.failedCount ?? 0;
          const active = worker.active ?? worker.activeCount ?? 0;
          const lastHeartbeat = worker.lastHeartbeat || worker.lastSeenAt || worker.updatedAt || worker.createdAt || data.generatedAt;
          const statusColor = status === "running" || status === "active" || status === "healthy" ? "#16a34a" : status === "unknown" ? "#64748b" : "#dc2626";

          return `
            <div style="border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;padding:16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
                <h4 style="margin:0;">${escapeHtml(name)}</h4>
                <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#f8fafc;color:${statusColor};border:1px solid #e5e7eb;font-weight:800;font-size:12px;">
                  ${escapeHtml(status)}
                </span>
              </div>

              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;">
                <div><strong>${escapeHtml(queueName)}</strong><br><span style="color:#64748b;font-size:12px;">Queue</span></div>
                <div><strong>${escapeHtml(concurrency)}</strong><br><span style="color:#64748b;font-size:12px;">Concurrency</span></div>
                <div><strong>${escapeHtml(active)}</strong><br><span style="color:#64748b;font-size:12px;">Active</span></div>
                <div><strong>${escapeHtml(processed)}</strong><br><span style="color:#64748b;font-size:12px;">Processed</span></div>
                <div><strong>${escapeHtml(failed)}</strong><br><span style="color:#64748b;font-size:12px;">Failed</span></div>
              </div>

              <div style="border-top:1px solid #e5e7eb;padding-top:12px;color:#64748b;font-size:13px;">
                Last heartbeat: ${escapeHtml(formatDateTime(lastHeartbeat))}
              </div>
            </div>
          `;
        })
        .join("");

      output.innerHTML = `
        <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <strong>Worker Metrics</strong>
          <span style="color:#64748b;">${escapeHtml(formatDateTime(data.generatedAt))}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;">
          ${cards}
        </div>
      `;
    });
  } catch (error) {
    writeOutput("operationsOutput", error.message);
  }
};

const loadUsers = async () => {
  try {
    await withLoadingButton("loadUsersBtn", "Loading Users...", async () => {
      const container = getElement("usersOutput");

      if (container) {
        container.innerHTML = "Loading users...";
      }

      const data = await requestAdminApi("/admin/users");
      userManagementState.users = data?.users || [];
      userManagementState.page = 1;
      userManagementState.expanded = true;
      renderUsersTable();
    });
  } catch (error) {
    writeOutput("usersOutput", error.message);
  }
};

const getUserSortValue = (user, key) => {
  if (key === "createdAt") return new Date(user.createdAt ?? 0).getTime();
  if (key === "phoneVerified") return user.phoneVerified ? 1 : 0;
  return String(user[key] ?? "").toLowerCase();
};

const getFilteredUsers = () => {
  const normalizedSearch = userManagementState.search.trim().toLowerCase();

  return userManagementState.users.filter((user) => {
    const matchesSearch = !normalizedSearch || [user.id, user.email, user.phoneNumber]
      .some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));

    const matchesStatus =
      userManagementState.status === "all" || user.status === userManagementState.status;

    return matchesSearch && matchesStatus;
  });
};

const renderUsersTable = () => {
  const container = getElement("usersOutput");
  if (!container) return;

  const users = [...getFilteredUsers()].sort((a, b) => {
    const aValue = getUserSortValue(a, userManagementState.sortKey);
    const bValue = getUserSortValue(b, userManagementState.sortKey);

    if (aValue < bValue) return userManagementState.sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return userManagementState.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (!userManagementState.expanded) {
    container.innerHTML = `
      <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f8fafc;">
        <strong>${users.length} user records hidden</strong>
        <button onclick="toggleUsersExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
          Open Records
        </button>
      </div>
    `;
    return;
  }

  if (users.length === 0) {
    container.innerHTML = "<p>No users found.</p>";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(users.length / userManagementState.pageSize));
  userManagementState.page = Math.min(userManagementState.page, totalPages);

  const startIndex = (userManagementState.page - 1) * userManagementState.pageSize;
  const pageUsers = users.slice(startIndex, startIndex + userManagementState.pageSize);

  const sortIcon = (key) => {
    if (userManagementState.sortKey !== key) return "↕";
    return userManagementState.sortDirection === "asc" ? "↑" : "↓";
  };

  const rows = pageUsers
    .map((user, index) => {
      const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const isInactive = user.status === "inactive";
      const statusColor = isInactive ? "#dc2626" : "#16a34a";
      const phoneStatus = user.phoneVerified ? "Verified" : "Not verified";

      return `
        <tr style="background:${rowBackground};">
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <strong>${escapeHtml(shortText(user.email, 36))}</strong><br>
            <span style="color:#64748b;font-size:12px;" title="${escapeHtml(user.id)}">${escapeHtml(shortText(user.id, 30))}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;">
            <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:#f8fafc;color:${statusColor};border:1px solid #e5e7eb;font-weight:800;font-size:12px;">
              ${escapeHtml(user.status)}
            </span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;color:#334155;">
            ${escapeHtml(user.phoneNumber || "-")}<br>
            <span style="font-size:12px;color:${user.phoneVerified ? "#16a34a" : "#64748b"};">${phoneStatus}</span>
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;color:#334155;">
            ${escapeHtml(formatDateTime(user.createdAt))}
          </td>
          <td style="padding:12px;border:1px solid #e5e7eb;vertical-align:middle;white-space:nowrap;">
            <button onclick="showUserDetails('${escapeHtml(user.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
              View
            </button>
            <button onclick="copyUserId('${escapeHtml(user.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;margin-left:6px;">
              Copy ID
            </button>
            ${isInactive
              ? `<button onclick="reactivateUserFromTable('${escapeHtml(user.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;margin-left:6px;">Reactivate</button>`
              : `<button onclick="deactivateUserFromTable('${escapeHtml(user.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;margin-left:6px;">Deactivate</button>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div style="margin-top:16px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#f8fafc;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end;">
      <label style="display:grid;gap:6px;font-weight:700;">
        Search
        <input value="${escapeHtml(userManagementState.search)}" oninput="setUserSearch(this.value)" placeholder="Email, user ID, phone" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;" />
      </label>

      <label style="display:grid;gap:6px;font-weight:700;">
        Status
        <select onchange="setUserStatusFilter(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
          <option value="all" ${userManagementState.status === "all" ? "selected" : ""}>All</option>
          <option value="active" ${userManagementState.status === "active" ? "selected" : ""}>Active</option>
          <option value="inactive" ${userManagementState.status === "inactive" ? "selected" : ""}>Inactive</option>
        </select>
      </label>

      <div style="display:flex;gap:10px;align-items:center;">
        <label style="font-weight:700;">Show</label>
        <select onchange="changeUserPageSize(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
          <option value="10" ${userManagementState.pageSize === 10 ? "selected" : ""}>10</option>
          <option value="20" ${userManagementState.pageSize === 20 ? "selected" : ""}>20</option>
          <option value="50" ${userManagementState.pageSize === 50 ? "selected" : ""}>50</option>
          <option value="100" ${userManagementState.pageSize === 100 ? "selected" : ""}>100</option>
        </select>
        <span>entries</span>
      </div>

      <button onclick="exportFilteredUsers()" style="padding:10px 14px;border-radius:10px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;">
        Export Users CSV
      </button>

      <button onclick="toggleUsersExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Close Records
      </button>
    </div>

    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:980px;font-family:Inter, Arial, sans-serif;line-height:1.35;">
        <thead>
          <tr style="background:#f8fafc;">
            <th onclick="sortUsers('email')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">User ${sortIcon("email")}</th>
            <th onclick="sortUsers('status')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Status ${sortIcon("status")}</th>
            <th onclick="sortUsers('phoneVerified')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Phone ${sortIcon("phoneVerified")}</th>
            <th onclick="sortUsers('createdAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Created ${sortIcon("createdAt")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <span>Showing ${startIndex + 1} to ${Math.min(startIndex + userManagementState.pageSize, users.length)} of ${users.length} users</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="changeUserPage(${userManagementState.page - 1})" ${userManagementState.page <= 1 ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Prev</button>
        <strong>Page ${userManagementState.page} / ${totalPages}</strong>
        <button onclick="changeUserPage(${userManagementState.page + 1})" ${userManagementState.page >= totalPages ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Next</button>
      </div>
    </div>
  `;
};

window.sortUsers = (key) => {
  if (userManagementState.sortKey === key) {
    userManagementState.sortDirection = userManagementState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    userManagementState.sortKey = key;
    userManagementState.sortDirection = key === "createdAt" ? "desc" : "asc";
  }

  userManagementState.page = 1;
  renderUsersTable();
};

window.changeUserPage = (page) => {
  const totalPages = Math.max(1, Math.ceil(getFilteredUsers().length / userManagementState.pageSize));
  userManagementState.page = Math.min(Math.max(1, Number(page)), totalPages);
  renderUsersTable();
};

window.changeUserPageSize = (pageSize) => {
  userManagementState.pageSize = Number(pageSize) || 10;
  userManagementState.page = 1;
  renderUsersTable();
};

window.setUserSearch = (value) => {
  userManagementState.search = value;
  userManagementState.page = 1;
  renderUsersTable();
};

window.setUserStatusFilter = (value) => {
  userManagementState.status = value;
  userManagementState.page = 1;
  renderUsersTable();
};

window.toggleUsersExpanded = () => {
  userManagementState.expanded = !userManagementState.expanded;
  renderUsersTable();
};

window.copyUserId = async (userId) => {
  try {
    await navigator.clipboard.writeText(userId);
    alert("User ID copied");
  } catch {
    prompt("Copy User ID", userId);
  }
};

window.exportFilteredUsers = () => {
  const rows = getFilteredUsers();
  if (rows.length === 0) {
    alert("No users available to export");
    return;
  }

  const headers = ["id", "email", "status", "phoneNumber", "phoneVerified", "createdAt", "updatedAt"];
  const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((user) => headers.map((header) => escapeCsv(user[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "iadme-users.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

window.showUserDetails = async (userId) => {
  const panel = getElement("selectedUserPanel");
  const output = getElement("selectedUserOutput");

  if (!panel || !output) return;

  panel.style.display = "block";
  output.innerHTML = "Loading user details...";

  try {
    const data = await requestAdminApi(`/admin/users/${userId}`);
    renderSelectedUserDetails(userId, data);
  } catch (error) {
    output.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
};

const renderSelectedUserDetails = (userId, data) => {
  const output = getElement("selectedUserOutput");
  if (!output) return;

  const user = data?.user || {};
  const profile = data?.profile;
  const stats = data?.stats || {};
  const isInactive = user.status === "inactive";

  output.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px;">
      <strong style="font-size:18px;color:#5b21b6;">User ${escapeHtml(shortText(user.email || userId, 28))}</strong>
      <button onclick="closeSelectedUserPanel()" style="padding:8px 12px;border-radius:9px;border:1px solid #6d28d9;background:#6d28d9;color:white;font-weight:800;cursor:pointer;">
        Close Details ×
      </button>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
      <button onclick="showUserDetails('${escapeHtml(userId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Refresh Details
      </button>
      <button onclick="copyUserId('${escapeHtml(userId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #64748b;background:#fff;color:#334155;font-weight:800;cursor:pointer;">
        Copy User ID
      </button>
      ${isInactive
        ? `<button onclick="reactivateUserFromTable('${escapeHtml(userId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;">Reactivate User</button>`
        : `<button onclick="deactivateUserFromTable('${escapeHtml(userId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;">Deactivate User</button>`
      }
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
      <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
        <h4 style="margin-bottom:10px;">Account</h4>
        <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
        <p><strong>Email:</strong> ${escapeHtml(user.email ?? "")}</p>
        <p><strong>Status:</strong> ${escapeHtml(user.status ?? "")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(user.phoneNumber || "-")}</p>
        <p><strong>Phone Verified:</strong> ${user.phoneVerified ? "Yes" : "No"}</p>
        <p><strong>Created:</strong> ${escapeHtml(formatDateTime(user.createdAt))}</p>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
        <h4 style="margin-bottom:10px;">Profile & Stats</h4>
        <p><strong>Display Name:</strong> ${escapeHtml(profile?.displayName || "-")}</p>
        <p><strong>Bio:</strong> ${escapeHtml(profile?.bio || "-")}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-top:12px;">
          <div><strong>${escapeHtml(stats.uploadsCount ?? 0)}</strong><br><span>Uploads</span></div>
          <div><strong>${escapeHtml(stats.videosCount ?? 0)}</strong><br><span>Total Videos</span></div>
          <div><strong>${escapeHtml(stats.activeVideosCount ?? 0)}</strong><br><span>Active Videos</span></div>
          <div><strong>${escapeHtml(stats.deletedVideosCount ?? 0)}</strong><br><span>Deleted Videos</span></div>
          <div><strong>${escapeHtml(stats.publicVideosCount ?? 0)}</strong><br><span>Public Videos</span></div>
          <div><strong>${escapeHtml(stats.premiumVideosCount ?? 0)}</strong><br><span>Premium Videos</span></div>
          <div><strong>${escapeHtml(stats.commentsCount ?? 0)}</strong><br><span>Comments</span></div>
          <div><strong>${escapeHtml(stats.reportsFiledCount ?? 0)}</strong><br><span>Reports Filed</span></div>
          <div><strong>${escapeHtml(stats.reportsAgainstVideosCount ?? 0)}</strong><br><span>Reports Against Videos</span></div>
          <div><strong>${escapeHtml(stats.openReportsAgainstVideosCount ?? 0)}</strong><br><span>Open Reports</span></div>
        </div>
      </div>
    </div>
  `;
};

window.deactivateUserFromTable = async (userId) => {
  if (!confirm("Deactivate this user?")) return;
  await requestAdminApi(`/admin/users/${userId}/deactivate`, { method: "POST" });
  await loadUsers();
  await window.showUserDetails(userId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.reactivateUserFromTable = async (userId) => {
  if (!confirm("Reactivate this user?")) return;
  await requestAdminApi(`/admin/users/${userId}/reactivate`, { method: "POST" });
  await loadUsers();
  await window.showUserDetails(userId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.closeSelectedUserPanel = () => {
  const panel = getElement("selectedUserPanel");
  const output = getElement("selectedUserOutput");

  if (panel) panel.style.display = "none";
  if (output) output.innerHTML = "";
};

const loadReports = async () => {
  try {
    await withLoadingButton("loadReportsBtn", "Loading Reports...", async () => {
      const container = getElement("reportsOutput");

      if (container) {
        container.innerHTML = "Loading reports...";
      }

      const data = await requestAdminApi("/admin/reports/videos/summary");
      reportQueueState.reports = data?.summaries || [];
      reportQueueState.page = 1;
      reportQueueState.expanded = true;
      renderReportsTable();
    });
  } catch (error) {
    writeOutput("reportsOutput", error.message);
  }
};

const renderReportsTable = () => {
  const container = getElement("reportsOutput");
  if (!container) return;

  const reports = [...reportQueueState.reports].sort((a, b) => {
    const aValue = getSortValue(a, reportQueueState.sortKey);
    const bValue = getSortValue(b, reportQueueState.sortKey);

    if (aValue < bValue) return reportQueueState.sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return reportQueueState.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (!reportQueueState.expanded) {
    container.innerHTML = `
      <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;border-radius:14px;padding:16px;background:#f8fafc;">
        <strong>${reports.length} report records hidden</strong>
        <button onclick="toggleReportsExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
          Open Records
        </button>
      </div>
    `;
    return;
  }

  if (reports.length === 0) {
    container.innerHTML = "<p>No reports found.</p>";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(reports.length / reportQueueState.pageSize));
  reportQueueState.page = Math.min(reportQueueState.page, totalPages);

  const startIndex = (reportQueueState.page - 1) * reportQueueState.pageSize;
  const pageReports = reports.slice(startIndex, startIndex + reportQueueState.pageSize);

  const sortIcon = (key) => {
    if (reportQueueState.sortKey !== key) return "↕";
    return reportQueueState.sortDirection === "asc" ? "↑" : "↓";
  };

const rows = pageReports
  .map((report, index) => {
    const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
    const isDeleted = Boolean(report.deletedAt);

    const thumbnail = report.thumbnailUrl
      ? `<img src="${escapeHtml(report.thumbnailUrl)}" alt="thumbnail" style="width:58px;height:78px;object-fit:cover;border-radius:10px;background:#0f172a;" />`
      : `<div style="width:58px;height:78px;display:grid;place-items:center;border-radius:10px;background:#e5e7eb;color:#64748b;font-size:11px;">No image</div>`;

    const reasons = Object.entries(report.reasonSummary || {})
      .map(([reason, count]) => `${escapeHtml(reason)}: ${escapeHtml(count)}`)
      .join("<br>") || "-";

    return `
      <tr style="background:${rowBackground};">
        <td style="padding:10px;border:1px solid #e5e7eb;">${thumbnail}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">
          <strong>${escapeHtml(shortText(report.title || "Untitled", 42))}</strong><br>
          <span style="color:#64748b;font-size:12px;">${escapeHtml(shortText(report.videoId, 28))}</span><br>
          <span style="color:${isDeleted ? "#dc2626" : "#16a34a"};font-size:12px;font-weight:800;">
            ${isDeleted ? "deleted" : escapeHtml(report.visibility)}
          </span>
        </td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(shortText(report.ownerEmail, 32))}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;">
          <strong>${escapeHtml(report.openReportsCount)} open</strong><br>
          Total: ${escapeHtml(report.totalReportsCount)}<br>
          Unique: ${escapeHtml(report.uniqueReportersCount)}<br>
          Resolved: ${escapeHtml(report.resolvedReportsCount)}<br>
          Dismissed: ${escapeHtml(report.dismissedReportsCount)}
        </td>
        <td style="padding:10px;border:1px solid #e5e7eb;">${reasons}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(formatDateTime(report.lastReportedAt))}</td>
        <td style="padding:10px;border:1px solid #e5e7eb;white-space:nowrap;">
          <button onclick="showReportDetails('${escapeHtml(report.videoId)}','${escapeHtml(report.videoId)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
            Review
          </button>
        </td>
      </tr>
    `;
  })
  .join("");

  container.innerHTML = `
    <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
      <div style="display:flex;gap:10px;align-items:center;">
        <label style="font-weight:700;">Show</label>
        <select onchange="changeReportPageSize(this.value)" style="padding:10px;border:1px solid #d1d5db;border-radius:10px;">
          <option value="25" ${reportQueueState.pageSize === 25 ? "selected" : ""}>25</option>
          <option value="50" ${reportQueueState.pageSize === 50 ? "selected" : ""}>50</option>
          <option value="100" ${reportQueueState.pageSize === 100 ? "selected" : ""}>100</option>
        </select>
        <span>entries</span>
      </div>

      <button onclick="toggleReportsExpanded()" style="padding:10px 14px;border-radius:10px;border:1px solid #6d28d9;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Close Records
      </button>
    </div>

    <div style="margin-top:14px;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
      <table style="width:100%;border-collapse:collapse;min-width:980px;">
        <thead>
          <tr style="background:#f8fafc;">
<th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Thumbnail</th>
<th onclick="sortReports('title')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Video ${sortIcon("title")}</th>
<th onclick="sortReports('ownerEmail')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Owner ${sortIcon("ownerEmail")}</th>
<th onclick="sortReports('openReportsCount')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Reports ${sortIcon("openReportsCount")}</th>
<th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Reasons</th>
<th onclick="sortReports('lastReportedAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Last Reported ${sortIcon("lastReportedAt")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <span>Showing ${startIndex + 1} to ${Math.min(startIndex + reportQueueState.pageSize, reports.length)} of ${reports.length} reports</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="changeReportPage(${reportQueueState.page - 1})" ${reportQueueState.page <= 1 ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Prev</button>
        <strong>Page ${reportQueueState.page} / ${totalPages}</strong>
        <button onclick="changeReportPage(${reportQueueState.page + 1})" ${reportQueueState.page >= totalPages ? "disabled" : ""} style="padding:8px 12px;border-radius:8px;border:1px solid #d1d5db;">Next</button>
      </div>
    </div>
  `;
};

window.sortReports = (key) => {
  if (reportQueueState.sortKey === key) {
    reportQueueState.sortDirection = reportQueueState.sortDirection === "asc" ? "desc" : "asc";
  } else {
    reportQueueState.sortKey = key;
    reportQueueState.sortDirection = key === "createdAt" ? "desc" : "asc";
  }

  reportQueueState.page = 1;
  renderReportsTable();
};

window.changeReportPage = (page) => {
  const totalPages = Math.max(1, Math.ceil(reportQueueState.reports.length / reportQueueState.pageSize));
  reportQueueState.page = Math.min(Math.max(1, Number(page)), totalPages);
  renderReportsTable();
};

window.changeReportPageSize = (pageSize) => {
  reportQueueState.pageSize = Number(pageSize) || 50;
  reportQueueState.page = 1;
  renderReportsTable();
};

window.toggleReportsExpanded = () => {
  reportQueueState.expanded = !reportQueueState.expanded;
  renderReportsTable();
};

window.resolveReport = async (reportId) => {
  if (!confirm("Resolve this report?")) return;
  await requestAdminApi(`/admin/reports/${reportId}/resolve`, { method: "POST" });
  await loadReports();
  await loadAuditLogs();
};

window.dismissReport = async (reportId) => {
  if (!confirm("Dismiss this report?")) return;
  await requestAdminApi(`/admin/reports/${reportId}/dismiss`, { method: "POST" });
  await loadReports();
  await loadAuditLogs();
};

window.showReportDetails = async (videoId, reportId) => {
  const panel = getElement("selectedReportPanel");
  const output = getElement("selectedReportOutput");

  if (!panel || !output) {
    return;
  }

  panel.style.display = "block";
  output.innerHTML = "Loading report details...";

  try {
const video = await requestAdminApi(`/admin/videos/${videoId}`);

const reportSummary = reportQueueState.reports.find(
  (r) => r.videoId === videoId
);

renderSelectedReportDetails(
  videoId,
  reportId,
  video,
  reportSummary
);
  } catch (error) {
    output.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
};

const renderSelectedReportDetails = (
  videoId,
  reportId,
  video,
  reportSummary
) => {
  const output = getElement("selectedReportOutput");
  if (!output) return;

  const isDeleted = Boolean(video.video?.deletedAt);
  const playbackUrl = video.video?.hlsUrl || video.video?.playbackUrl || "";
  const thumbnailUrl = video.video?.thumbnailUrl || "";
  const reasonRows = Object.entries(
  reportSummary?.reasonSummary || {}
)
  .map(
    ([reason, count]) =>
      `${escapeHtml(reason)}: ${escapeHtml(count)}`
  )
  .join("<br>") || "-";

  const reportRows = (video.reports || [])
  .map(
    (report) => `
      <tr>
        <td style="padding:10px;border:1px solid #e5e7eb;">
          ${escapeHtml(report.status)}
        </td>
        <td style="padding:10px;border:1px solid #e5e7eb;">
          ${escapeHtml(report.reasonCode)}
        </td>
        <td style="padding:10px;border:1px solid #e5e7eb;">
          ${escapeHtml(report.reporterEmail || "-")}
        </td>
        <td style="padding:10px;border:1px solid #e5e7eb;">
          ${escapeHtml(formatDateTime(report.createdAt))}
        </td>
      </tr>
    `
  )
  .join("");

  output.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px;">
      <strong style="font-size:18px;color:#5b21b6;">Report ${escapeHtml(shortText(reportId, 18))}</strong>
      <button onclick="closeSelectedReportPanel()" style="padding:8px 12px;border-radius:9px;border:1px solid #6d28d9;background:#6d28d9;color:white;font-weight:800;cursor:pointer;">
        Close Details ×
      </button>
    </div>

    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
      <button onclick="refreshReportDetails('${escapeHtml(videoId)}','${escapeHtml(reportId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
        Refresh Details
      </button>
      <button onclick="loadReportVideoComments('${escapeHtml(videoId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #0f766e;background:#ecfdf5;color:#0f766e;font-weight:800;cursor:pointer;">
        Load Comments
      </button>
      ${isDeleted
        ? `<button onclick="restoreReportVideo('${escapeHtml(videoId)}','${escapeHtml(reportId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;">Restore Video</button>`
        : `<button onclick="deleteReportVideo('${escapeHtml(videoId)}','${escapeHtml(reportId)}')" style="padding:9px 13px;border-radius:10px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;">Delete Video</button>`
      }
    </div>

    <div style="display:grid;grid-template-columns:minmax(280px, 420px) 1fr;gap:18px;align-items:start;">
      <div style="border:1px solid #e5e7eb;border-radius:16px;background:#020617;padding:12px;">
        ${playbackUrl
          ? `<video
              controls
              playsinline
              preload="metadata"
              poster="${escapeHtml(thumbnailUrl)}"
              src="${escapeHtml(playbackUrl)}"
              style="width:100%;max-height:520px;border-radius:12px;background:#000;display:block;"
            ></video>`
          : `<div style="min-height:260px;display:grid;place-items:center;color:#cbd5e1;background:#0f172a;border-radius:12px;">
              No playback URL available
            </div>`
        }

        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          ${playbackUrl
            ? `<a href="${escapeHtml(playbackUrl)}" target="_blank" rel="noopener" style="padding:8px 10px;border-radius:9px;background:#ffffff;color:#5b21b6;font-weight:800;font-size:13px;">
                Open Video URL
              </a>`
            : ""
          }
          ${thumbnailUrl
            ? `<a href="${escapeHtml(thumbnailUrl)}" target="_blank" rel="noopener" style="padding:8px 10px;border-radius:9px;background:#ffffff;color:#5b21b6;font-weight:800;font-size:13px;">
                Open Thumbnail
              </a>`
            : ""
          }
        </div>
      </div>

      <div style="display:grid;gap:16px;">
        <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
<h4 style="margin-bottom:10px;">Moderation Summary</h4>

<p><strong>Open Reports:</strong> ${escapeHtml(reportSummary?.openReportsCount ?? 0)}</p>

<p><strong>Total Reports:</strong> ${escapeHtml(reportSummary?.totalReportsCount ?? 0)}</p>

<p><strong>Unique Reporters:</strong> ${escapeHtml(reportSummary?.uniqueReportersCount ?? 0)}</p>

<p><strong>Resolved:</strong> ${escapeHtml(reportSummary?.resolvedReportsCount ?? 0)}</p>

<p><strong>Dismissed:</strong> ${escapeHtml(reportSummary?.dismissedReportsCount ?? 0)}</p>

<p><strong>Reasons:</strong><br>${reasonRows}</p>

<p><strong>Last Reported:</strong>
${escapeHtml(formatDateTime(reportSummary?.lastReportedAt))}
</p>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
          <h4 style="margin-bottom:10px;">Video Stats</h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;">
            <div><strong>${escapeHtml(video.stats?.uniqueViewsCount ?? 0)}</strong><br><span>Unique Views</span></div>
            <div><strong>${escapeHtml(video.stats?.totalViewsCount ?? 0)}</strong><br><span>Total Views</span></div>
            <div><strong>${escapeHtml(video.stats?.likesCount ?? 0)}</strong><br><span>Likes</span></div>
            <div><strong>${escapeHtml(video.stats?.dislikesCount ?? 0)}</strong><br><span>Dislikes</span></div>
            <div><strong>${escapeHtml(video.stats?.commentsCount ?? 0)}</strong><br><span>Comments</span></div>
            <div><strong>${escapeHtml(video.stats?.openReportsCount ?? 0)}</strong><br><span>Open Reports</span></div>
          </div>
        </div>
      </div>
    </div>
    

    <div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:white;">
  <h4 style="margin-bottom:10px;">Report History</h4>

  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Status</th>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Reason</th>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Reporter</th>
        <th style="text-align:left;padding:10px;border:1px solid #e5e7eb;">Reported At</th>
      </tr>
    </thead>
    <tbody>
      ${reportRows}
    </tbody>
  </table>
</div>
    
    <div id="selectedReportComments" style="margin-top:20px;"></div>
  `;
};

window.refreshReportDetails = async (videoId, reportId) => {
  await window.showReportDetails(videoId, reportId);
};

window.deleteReportVideo = async (videoId, reportId) => {
  if (!confirm("Delete this video? This will soft-delete it from feeds.")) return;
  await requestAdminApi(`/admin/videos/${videoId}/delete`, { method: "POST" });
  await window.showReportDetails(videoId, reportId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.restoreReportVideo = async (videoId, reportId) => {
  if (!confirm("Restore this video?")) return;
  await requestAdminApi(`/admin/videos/${videoId}/restore`, { method: "POST" });
  await window.showReportDetails(videoId, reportId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.loadReportVideoComments = async (videoId) => {
  const commentsContainer = getElement("selectedReportComments");
  if (!commentsContainer) return;

  commentsContainer.innerHTML = "Loading comments...";

  try {
    const data = await requestAdminApi(`/admin/comments?videoId=${encodeURIComponent(videoId)}`);
    const comments = data?.comments || [];

    if (comments.length === 0) {
      commentsContainer.innerHTML = "<p>No comments found for this reported video.</p>";
      return;
    }

    const rows = comments
      .map((comment, index) => {
        const rowBackground = index % 2 === 0 ? "#ffffff" : "#f8fafc";
        const isReply = Boolean(comment.parentCommentId);
        const deletedLabel = comment.deletedAt ? `Deleted: ${escapeHtml(formatDateTime(comment.deletedAt))}` : "Active";

        return `
          <tr style="background:${rowBackground};">
            <td style="padding:10px;border:1px solid #e5e7eb;">${isReply ? "↳ Reply" : "Comment"}</td>
            <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(comment.text)}</td>
            <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(comment.userDisplayName || comment.userEmail)}</td>
            <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(deletedLabel)}</td>
            <td style="padding:10px;border:1px solid #e5e7eb;white-space:nowrap;">
              ${comment.deletedAt
                ? "-"
                : `<button onclick="deleteReportComment('${escapeHtml(comment.id)}','${escapeHtml(videoId)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #dc2626;background:#dc2626;color:white;font-weight:800;cursor:pointer;">Delete</button>`
              }
            </td>
          </tr>
        `;
      })
      .join("");

    commentsContainer.innerHTML = `
      <h4 style="margin-bottom:10px;">Comments on Reported Video</h4>
      <div style="overflow:auto;border:1px solid #dbe3ef;border-radius:14px;">
        <table style="width:100%;border-collapse:collapse;min-width:900px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Type</th>
              <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Comment</th>
              <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">User</th>
              <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Status</th>
              <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  } catch (error) {
    commentsContainer.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
};

window.deleteReportComment = async (commentId, videoId) => {
  const reason = prompt("Reason for deleting this comment?", "Admin moderation");
  if (reason === null) return;
  if (!reason.trim()) {
    alert("Delete reason is required.");
    return;
  }

  await requestAdminApi(`/admin/comments/${commentId}/delete`, {
    method: "POST",
    body: JSON.stringify({ reason: reason.trim() }),
  });

  await window.loadReportVideoComments(videoId);
  await loadAuditLogs();
  await loadDashboardMetrics();
};

window.closeSelectedReportPanel = () => {
  const panel = getElement("selectedReportPanel");
  const output = getElement("selectedReportOutput");

  if (panel) {
    panel.style.display = "none";
  }

  if (output) {
    output.innerHTML = "";
  }
};

const loadDashboardMetrics = async () => {
  const button = getElement("loadDashboardBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "Loading Dashboard...";
  }
  try {
    const data = await requestAdminApi("/admin/metrics/platform");

    const moderation = data?.moderation ?? {};

    const openReports =
      moderation.openVideoReports ??
      moderation.openReports ??
      0;

    const deletedVideos =
      moderation.deletedVideos ??
      0;

    const deletedComments =
      moderation.deletedComments ??
      0;

    const deactivatedUsers =
      moderation.deactivatedUsers ??
      0;

    const setValue = (id, value) => {
      const el = getElement(id);
      if (el) {
        el.textContent = String(value);
      }
    };

    setValue("openReportsCount", openReports);
    setValue("deletedVideosCount", deletedVideos);
    setValue("deletedCommentsCount", deletedComments);
    setValue("deactivatedUsersCount", deactivatedUsers);

    setTimeout(() => {
      if (button) {
        button.disabled = false;
        button.textContent = "✓ Dashboard Loaded";

        setTimeout(() => {
          button.textContent = "Load Dashboard Metrics";
        }, 1500);
      }
    }, 500);
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "Load Dashboard Metrics";
    }
    console.error(error);
    alert(`Failed to load dashboard metrics: ${error.message}`);
  }
};

const applyEnvironmentSelection = () => {
  const envSelect = getElement("adminEnv");
  const baseUrlInput = getElement("baseUrl");

  if (!envSelect || !baseUrlInput) return;

  const selectedEnv = envSelect.value;
  const envBaseUrl = ENVIRONMENTS[selectedEnv];

  if (envBaseUrl) {
    baseUrlInput.value = envBaseUrl;
  }
};

const saveConfig = () => {
  const envSelect = getElement("adminEnv");
  const baseUrlInput = getElement("baseUrl");
  const tokenInput = getElement("adminToken");

  if (envSelect) {
    localStorage.setItem(STORAGE_KEYS.env, envSelect.value);
  }

  if (baseUrlInput) {
    localStorage.setItem(STORAGE_KEYS.baseUrl, baseUrlInput.value.trim());
  }

  if (tokenInput) {
    localStorage.setItem(STORAGE_KEYS.token, tokenInput.value.trim());
  }

    const emailInput = getElement("adminEmail");

  if (emailInput?.value?.trim()) {
    localStorage.setItem(STORAGE_KEYS.email, emailInput.value.trim());
  }

  alert("Admin configuration saved");
};

const restoreConfig = () => {
  const envSelect = getElement("adminEnv");
  const baseUrlInput = getElement("baseUrl");
  const tokenInput = getElement("adminToken");

  const savedEnv = localStorage.getItem(STORAGE_KEYS.env) || "production";
  const savedBaseUrl = localStorage.getItem(STORAGE_KEYS.baseUrl);
  const savedToken = localStorage.getItem(STORAGE_KEYS.token);

  if (envSelect) {
    envSelect.value = savedEnv;
  }

  if (baseUrlInput) {
    baseUrlInput.value = savedBaseUrl || ENVIRONMENTS[savedEnv] || ENVIRONMENTS.production;
  }

  if (tokenInput && savedToken) {
    tokenInput.value = savedToken;
  }
    const savedEmail = localStorage.getItem(STORAGE_KEYS.email);
  const emailInput = getElement("adminEmail");

  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
  }

  const token = tokenInput?.value?.trim();
  setLoginStatus(
    token ? `Logged in as ${savedEmail || "admin"}` : "Not logged in.",
    Boolean(token)
  );
};

const bindEvents = () => {
  [
    "loadAuditBtn",
    "loadVideosBtn",
    "loadCommentsBtn",
    "loadUsersBtn",
    "loadDashboardBtn",
    "loadReportsBtn",
    "loadPaymentsBtn",
    "loadCommerceDashboardBtn",
    "runPaymentReconciliationBtn",
    "createCouponBtn",
    "loadCouponsBtn",
    "loadQueuesBtn",
    "loadWorkersBtn",
  ].forEach((id) => {
    const btn = getElement(id);
    if (btn) {
      btn.dataset.originalText = btn.textContent;
    }
  });

  getElement("adminEnv")?.addEventListener("change", applyEnvironmentSelection);
  getElement("saveConfigBtn")?.addEventListener("click", saveConfig);

  getElement("adminLoginBtn")?.addEventListener("click", loginAdmin);
  getElement("adminLogoutBtn")?.addEventListener("click", logoutAdmin);

  getElement("loadAuditBtn")?.addEventListener("click", loadAuditLogs);
  getElement("loadVideosBtn")?.addEventListener("click", loadVideos);
  getElement("loadCommentsBtn")?.addEventListener("click", loadComments);
  getElement("loadUsersBtn")?.addEventListener("click", loadUsers);
  getElement("loadReportsBtn")?.addEventListener("click", loadReports);
  getElement("loadPaymentsBtn")?.addEventListener("click", loadPayments);
  getElement("loadCommerceDashboardBtn")?.addEventListener("click", loadCommerceDashboard);
  getElement("runPaymentReconciliationBtn")?.addEventListener("click", runPaymentReconciliation);
  getElement("loadDashboardBtn")?.addEventListener("click", loadDashboardMetrics);

  getElement("createCouponBtn")?.addEventListener("click", createCoupon);
  getElement("loadCouponsBtn")?.addEventListener("click", loadCouponRedemptions);

  getElement("loadQueuesBtn")?.addEventListener("click", loadQueueMetrics);
  getElement("loadWorkersBtn")?.addEventListener("click", loadWorkerMetrics);

};

document.addEventListener("DOMContentLoaded", () => {
  restoreConfig();
  bindEvents();

  const token = getElement("adminToken")?.value?.trim();

  if (token) {
    loadDashboardMetrics();
  }
});
