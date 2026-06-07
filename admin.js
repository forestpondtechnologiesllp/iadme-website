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
  getElement("loadDashboardBtn")?.addEventListener("click", loadDashboardMetrics);
};

document.addEventListener("DOMContentLoaded", () => {
  restoreConfig();
  bindEvents();
  loadDashboardMetrics();
});