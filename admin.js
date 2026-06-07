const ENVIRONMENTS = {
  local: "http://localhost:3000",
  staging: "https://staging-api.iadme.app",
  production: "https://api.iadme.app",
};

const STORAGE_KEYS = {
  env: "iadme_admin_env",
  baseUrl: "iadme_admin_base_url",
  token: "iadme_admin_token",
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

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.error?.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return body;
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
  pageSize: 50,
  sortKey: "createdAt",
  sortDirection: "desc",
  expanded: true,
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
      writeOutput("auditOutput", "Loading audit logs...");
      const data = await requestAdminApi("/admin/audit");
      writeOutput("auditOutput", data);
    });
  } catch (error) {
    writeOutput("auditOutput", error.message);
  }
};

const loadVideos = async () => {
  try {
    await withLoadingButton("loadVideosBtn", "Loading Videos...", async () => {
      writeOutput("videosOutput", "Loading videos...");
      const data = await requestAdminApi("/admin/videos");
      writeOutput("videosOutput", data);
    });
  } catch (error) {
    writeOutput("videosOutput", error.message);
  }
};

const loadComments = async () => {
  try {
    await withLoadingButton("loadCommentsBtn", "Loading Comments...", async () => {
      writeOutput("commentsOutput", "Loading reported-video comments...");
      const data = await requestAdminApi("/admin/comments");
      writeOutput("commentsOutput", data);
    });
  } catch (error) {
    writeOutput("commentsOutput", error.message);
  }
};

const loadUsers = async () => {
  try {
    await withLoadingButton("loadUsersBtn", "Loading Users...", async () => {
      writeOutput("usersOutput", "Loading users...");
      const data = await requestAdminApi("/admin/users");
      writeOutput("usersOutput", data);
    });
  } catch (error) {
    writeOutput("usersOutput", error.message);
  }
};

const loadReports = async () => {
  try {
    await withLoadingButton("loadReportsBtn", "Loading Reports...", async () => {
      const container = getElement("reportsOutput");

      if (container) {
        container.innerHTML = "Loading reports...";
      }

      const data = await requestAdminApi("/admin/reports/videos");
      reportQueueState.reports = data?.reports || [];
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
      const statusColor = report.status === "open" ? "#f97316" : report.status === "resolved" ? "#16a34a" : "#64748b";

      return `
        <tr style="background:${rowBackground};">
          <td style="padding:10px;border:1px solid #e5e7eb;">
            <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#fff7ed;color:${statusColor};border:1px solid #fed7aa;font-weight:800;font-size:12px;">
              ${escapeHtml(report.status)}
            </span>
          </td>
          <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(report.reasonCode)}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;" title="${escapeHtml(report.userId)}">${escapeHtml(shortText(report.userId, 24))}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;" title="${escapeHtml(report.videoId)}">${escapeHtml(shortText(report.videoId, 26))}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;white-space:nowrap;">${escapeHtml(formatDateTime(report.createdAt))}</td>
          <td style="padding:10px;border:1px solid #e5e7eb;white-space:nowrap;">
            <button onclick="showReportDetails('${escapeHtml(report.videoId)}','${escapeHtml(report.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #8b5cf6;background:#fff;color:#5b21b6;font-weight:800;cursor:pointer;">
              View
            </button>
            <button onclick="resolveReport('${escapeHtml(report.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:800;cursor:pointer;margin-left:6px;">
              Resolve
            </button>
            <button onclick="dismissReport('${escapeHtml(report.id)}')" style="padding:8px 12px;border-radius:9px;border:1px solid #f97316;background:#fff7ed;color:#c2410c;font-weight:800;cursor:pointer;margin-left:6px;">
              Dismiss
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
            <th onclick="sortReports('status')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Status ${sortIcon("status")}</th>
            <th onclick="sortReports('reasonCode')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Reason ${sortIcon("reasonCode")}</th>
            <th onclick="sortReports('userId')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Reporter ${sortIcon("userId")}</th>
            <th onclick="sortReports('videoId')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Video ${sortIcon("videoId")}</th>
            <th onclick="sortReports('createdAt')" style="text-align:left;padding:12px;border:1px solid #e5e7eb;cursor:pointer;">Created ${sortIcon("createdAt")}</th>
            <th style="text-align:left;padding:12px;border:1px solid #e5e7eb;">Actions</th>
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

    output.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px;">
        <strong style="font-size:18px;color:#5b21b6;">Report ${escapeHtml(shortText(reportId, 18))}</strong>
        <button onclick="closeSelectedReportPanel()" style="padding:8px 12px;border-radius:9px;border:1px solid #6d28d9;background:#6d28d9;color:white;font-weight:800;cursor:pointer;">
          Close Details ×
        </button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;">
        <div>
          <p><strong>Report ID:</strong> ${escapeHtml(reportId)}</p>
          <p><strong>Video ID:</strong> ${escapeHtml(videoId)}</p>
          <p><strong>Title:</strong> ${escapeHtml(video.video?.title ?? "")}</p>
          <p><strong>Owner:</strong> ${escapeHtml(video.owner?.email ?? "")}</p>
          <p><strong>Status:</strong> ${escapeHtml(video.video?.playbackStatus ?? "")}</p>
          <p><strong>Visibility:</strong> ${escapeHtml(video.video?.visibility ?? "")}</p>
          <p><strong>Description:</strong> ${escapeHtml(video.video?.description ?? "")}</p>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:12px;background:white;padding:16px;">
          <h4 style="margin-bottom:10px;">Video Stats</h4>
          <pre style="overflow:auto;">${escapeHtml(formatJson(video.stats ?? {}))}</pre>
        </div>
      </div>
    `;
  } catch (error) {
    output.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
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
};

const bindEvents = () => {
  [
    "loadAuditBtn",
    "loadVideosBtn",
    "loadCommentsBtn",
    "loadUsersBtn",
    "loadDashboardBtn",
    "loadReportsBtn",
  ].forEach((id) => {
    const btn = getElement(id);
    if (btn) {
      btn.dataset.originalText = btn.textContent;
    }
  });

  getElement("adminEnv")?.addEventListener("change", applyEnvironmentSelection);
  getElement("saveConfigBtn")?.addEventListener("click", saveConfig);
  getElement("loadAuditBtn")?.addEventListener("click", loadAuditLogs);
  getElement("loadVideosBtn")?.addEventListener("click", loadVideos);
  getElement("loadCommentsBtn")?.addEventListener("click", loadComments);
  getElement("loadUsersBtn")?.addEventListener("click", loadUsers);
  getElement("loadReportsBtn")?.addEventListener("click", loadReports);
  getElement("loadDashboardBtn")?.addEventListener("click", loadDashboardMetrics);
};

document.addEventListener("DOMContentLoaded", () => {
  restoreConfig();
  bindEvents();
  loadDashboardMetrics();
});