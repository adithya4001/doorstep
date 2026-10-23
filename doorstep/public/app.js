const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const clock = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
const date = (value) =>
  new Date(value).toLocaleDateString([], { day: "numeric", month: "short" });
const open = (item) => !["completed", "cancelled"].includes(item.status);
const labels = {
  waiting: "Waiting for you",
  needs_attention: "Needs attention",
  acknowledged: "Acknowledged",
  completed: "Received",
  cancelled: "Cancelled",
};
let snapshot = { handoffs: [], history: [], preferences: {} };
let sequence = 0,
  ready = false,
  busy = false,
  setupRequired = false,
  user = null,
  filter = "open",
  currentView = "overview",
  arrivalKey = null,
  detailId = null,
  refreshPending = false;
const requests = [];
let themeChoice;
try {
  themeChoice = localStorage.getItem("doorstep-theme") || "system";
} catch {
  themeChoice = "system";
}
const media = matchMedia("(prefers-color-scheme: dark)");
function theme(choice) {
  themeChoice = ["light", "dark", "system"].includes(choice)
    ? choice
    : "system";
  document.documentElement.dataset.theme =
    themeChoice === "system" ? (media.matches ? "dark" : "light") : themeChoice;
  try {
    localStorage.setItem("doorstep-theme", themeChoice);
  } catch {}
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.themeChoice === themeChoice,
    );
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeChoice === themeChoice),
    );
  });
  document
    .querySelectorAll(".theme-cycle")
    .forEach((button) =>
      button.setAttribute(
        "aria-label",
        `Appearance: ${themeChoice}. Switch to ${document.documentElement.dataset.theme === "dark" ? "light" : "dark"}.`,
      ),
    );
}
theme(themeChoice);
media.addEventListener("change", () => theme(themeChoice));
document
  .querySelectorAll("[data-theme-choice]")
  .forEach(
    (button) => (button.onclick = () => theme(button.dataset.themeChoice)),
  );
document
  .querySelectorAll(".theme-cycle")
  .forEach(
    (button) =>
      (button.onclick = () =>
        theme(
          document.documentElement.dataset.theme === "dark" ? "light" : "dark",
        )),
  );

function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 5000);
}
function gate() {
  ready = false;
  user = null;
  snapshot = { handoffs: [], history: [], preferences: {} };
  requests.length = 0;
  document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  [
    "arrival-list",
    "resident-content",
    "activity-list",
    "recent-activity",
    "detail-content",
    "messages",
    "request-log",
    "metrics",
  ].forEach((id) => $(id).replaceChildren());
  $("preferences-form").reset();
  $("arrival-form").reset();
  $("chat-form").reset();
  $("assistant-target").replaceChildren();
  $("summary-output").textContent = "";
  $("workspace").hidden = true;
  $("gate").hidden = false;
}
async function authStatus() {
  const response = await fetch("/api/auth/status");
  if (!response.ok)
    throw new Error("Could not read household access. Reload to retry.");
  const status = await response.json();
  setupRequired = status.setupRequired;
  user = status.user;
  if (status.authenticated) return connect();
  gate();
  $("gate-title").textContent = setupRequired
    ? "Make this home yours."
    : "Welcome home.";
  $("gate-description").textContent = setupRequired
    ? "Create the owner account for this local workspace. You only need to do this once."
    : "Sign in to see arrivals and keep the next handoff moving.";
  $("auth-form").hidden = false;
  $("auth-submit").textContent = setupRequired
    ? "Create household →"
    : "Sign in →";
  $("auth-password").minLength = setupRequired ? 12 : 1;
  $("auth-password").autocomplete = setupRequired
    ? "new-password"
    : "current-password";
  $("password-hint").textContent = setupRequired
    ? "Use 12–128 characters. Keep this password somewhere safe; this prototype has no email recovery."
    : "Use the password you created on this device.";
}
$("show-password").onclick = () => {
  const show = $("auth-password").type === "password";
  $("auth-password").type = show ? "text" : "password";
  $("show-password").textContent = show ? "Hide" : "Show";
  $("show-password").setAttribute(
    "aria-label",
    show ? "Hide password" : "Show password",
  );
};
$("auth-form").onsubmit = async (event) => {
  event.preventDefault();
  $("auth-submit").disabled = true;
  $("auth-error").textContent = "";
  try {
    const response = await fetch(
      `/api/auth/${setupRequired ? "setup" : "login"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("auth-username").value.trim(),
          password: $("auth-password").value,
        }),
      },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    $("auth-password").value = "";
    user = result.user;
    await connect();
  } catch (error) {
    $("auth-error").textContent = error.message;
  } finally {
    $("auth-submit").disabled = false;
  }
};
$("logout").onclick = async () => {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!response.ok) throw new Error("Sign out failed. Try again.");
    gate();
    await authStatus();
    toast("Signed out of your household.");
  } catch (error) {
    toast(error.message);
  }
};
async function rpc(method, params = {}, log = true) {
  const response = await fetch("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++sequence, method, params }),
  });
  if (response.status === 401) {
    gate();
    await authStatus();
    throw new Error("Your session ended. Sign in to continue.");
  }
  if (!response.ok)
    throw new Error(
      `Connection interrupted (${response.status}). Check the board before retrying an action.`,
    );
  const body = await response.json();
  if (log) {
    requests.unshift(
      `${clock(Date.now())}  ${method}\n${JSON.stringify(params)}\n→ ${body.result?.isError ? "tool error" : body.error?.message || "ok"}`,
    );
    requests.splice(30);
    $("request-log").textContent = requests.join("\n\n");
  }
  if (body.error) throw new Error(body.error.message);
  return body.result;
}
async function tool(name, args = {}, log = true) {
  const result = await rpc("tools/call", { name, arguments: args }, log);
  if (result.isError)
    throw new Error(
      result.content?.[0]?.text || "The action could not be completed.",
    );
  return result.structuredContent || JSON.parse(result.content[0].text);
}
async function connect() {
  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "doorstep-browser", version: "0.2.0" },
  });
  $("protocol-version").textContent = init.protocolVersion;
  const notification = await fetch("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": init.protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  if (!notification.ok)
    throw new Error("Could not initialize the household connection.");
  const listing = await rpc("tools/list");
  $("tool-count").textContent = listing.tools.length;
  ready = true;
  await refresh();
  syncSettings();
  $("gate").hidden = true;
  $("workspace").hidden = false;
  $("account-name").textContent = user?.username || "Local demo";
  $("avatar").textContent = (user?.username || "D").slice(0, 1).toUpperCase();
  $("session-title").textContent = user
    ? `Signed in as ${user.username}`
    : "Trusted local demo mode";
  $("session-description").textContent = user
    ? "This session expires after 12 hours. Sign out when you finish on a shared device."
    : "Authentication was explicitly disabled in server configuration.";
  $("logout").hidden = !user;
}
function view(name) {
  currentView = name;
  document
    .querySelectorAll(".view")
    .forEach((section) => (section.hidden = section.id !== name));
  document.querySelectorAll(".navigation [data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === name);
    if (button.dataset.view === name)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "settings") syncSettings();
}
function syncSettings() {
  const prefs = snapshot.preferences;
  $("household-input").value = prefs.household || "Our home";
  $("resident-input").value = prefs.resident || "";
  $("instructions-input").value = prefs.instructions || "";
  const select = $("window-input");
  const value = String(prefs.acknowledgementSeconds || 120);
  if (![...select.options].some((option) => option.value === value))
    select.add(new Option(`${value} seconds`, value));
  select.value = value;
}
function actions(item) {
  const id = escapeHtml(item.id);
  const button = (name, label, cls) =>
    `<button class="${cls}" data-action="${name}" data-id="${id}">${label}</button>`;
  if (["waiting", "needs_attention"].includes(item.status))
    return (
      button("acknowledge_arrival", "I’ve seen it ✓", "primary") +
      button("cancel_handoff", "Dismiss", "secondary")
    );
  if (item.status === "acknowledged")
    return (
      button("complete_handoff", "It’s received ✓", "primary") +
      button("cancel_handoff", "Cancel", "secondary")
    );
  return "";
}
function nextStep(item) {
  return {
    waiting: "Waiting for the resident to acknowledge.",
    needs_attention: "Response window passed. Still visible here.",
    acknowledged: snapshot.preferences.instructions,
    completed: "The resident confirmed receipt.",
    cancelled: "This arrival was dismissed by the resident.",
  }[item.status];
}
function historyHtml(entries, link = true) {
  return entries.length
    ? entries
        .map(
          (entry) =>
            `<div class="timeline-row"><span class="timeline-dot"></span><div><p>${escapeHtml(entry.action)}</p><small>${date(entry.at)} · ${clock(entry.at)} · ${escapeHtml(entry.handoff_id.slice(0, 8))}</small>${link ? `<button class="details-button" data-detail="${escapeHtml(entry.handoff_id)}">Open handoff ↗</button>` : ""}</div></div>`,
        )
        .join("")
    : '<p class="muted micro">Your next household moment will appear here.</p>';
}
function render() {
  const items = snapshot.handoffs,
    active = items.filter(open),
    attention = active.filter((item) => item.status === "needs_attention");
  const today = new Date().toDateString();
  const completed = items.filter(
    (item) =>
      item.status === "completed" &&
      new Date(item.updatedAt).toDateString() === today,
  );
  const duration = completed.length
    ? Math.round(
        completed.reduce(
          (sum, item) =>
            sum + (new Date(item.updatedAt) - new Date(item.createdAt)) / 1000,
          0,
        ) / completed.length,
      )
    : null;
  const stats = [
    ["Open handoffs", active.length, "Waiting or acknowledged", "↗"],
    ["Received today", completed.length, "Confirmed by the resident", "✓"],
    ["Needs attention", attention.length, "Response window passed", "◷"],
    [
      "Avg. handoff today",
      duration === null
        ? "—"
        : duration < 60
          ? `${duration}s`
          : `${Math.round(duration / 60)}m`,
      duration === null
        ? "Appears after your first receipt"
        : "Arrival to confirmed receipt",
      "↔",
    ],
  ];
  $("metrics").innerHTML = stats
    .map(
      ([title, count, caption, icon]) =>
        `<div class="metric"><div class="metric-top"><span>${title}</span><span>${icon}</span></div><strong class="metric-number">${count}</strong><small>${caption}</small></div>`,
    )
    .join("");
  $("household-name").textContent =
    snapshot.preferences.household || "Our home";
  $("resident-name").textContent = snapshot.preferences.resident || "there";
  $("today-label").textContent = new Date().toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  $("time-label").textContent = `YOUR HOME, RIGHT NOW · ${clock(Date.now())}`;
  $("board-count").textContent = active.length;
  $("quiet-toggle").setAttribute(
    "aria-checked",
    String(Boolean(snapshot.preferences.quietMode)),
  );
  $("quiet-description").textContent = snapshot.preferences.quietMode
    ? "On · visual prompts stay on"
    : "Off · visual prompts stay on";
  $("pulse-title").textContent = attention.length
    ? "A moment needs you."
    : active.length
      ? "Home is in motion."
      : "A clear doorstep.";
  $("pulse-copy").textContent = attention.length
    ? `${attention.length} unseen arrival${attention.length === 1 ? " has" : "s have"} passed the response window. No external alert has been sent.`
    : active.length
      ? `${active.length} handoff${active.length === 1 ? " is" : "s are"} open. Acknowledgement keeps everyone in the loop.`
      : "Nothing is waiting. The next arrival will have a place here.";
  let list = items.filter((item) =>
    filter === "open"
      ? open(item)
      : filter === "attention"
        ? item.status === "needs_attention"
        : filter === "received"
          ? item.status === "completed"
          : true,
  );
  const query = $("search").value.toLowerCase().trim();
  list = list.filter((item) =>
    `${item.kind} ${item.note} ${item.id} ${labels[item.status]}`
      .toLowerCase()
      .includes(query),
  );
  if ($("sort-order").value === "oldest") list.reverse();
  const html = list.length
    ? list
        .map((item) => {
          const stage =
            item.status === "completed"
              ? 3
              : item.status === "acknowledged"
                ? 2
                : item.status === "cancelled"
                  ? 0
                  : 1;
          return `<article class="arrival-card"><div class="card-top"><span class="kind-icon">${item.kind === "parcel" ? "▣" : "♙"}</span><span class="status ${item.status}">${labels[item.status]}</span></div><h3>${item.kind === "parcel" ? "A parcel at the door" : "A visitor is here"}</h3><p class="card-meta">${date(item.createdAt)} · ${clock(item.createdAt)} · ${escapeHtml(item.id.slice(0, 8))}</p><p class="card-note">${escapeHtml(item.note || "No note added to this arrival.")}</p><div class="steps" aria-label="${stage} of 3 handoff steps"><span class="${stage > 0 ? "done" : ""}"></span><span class="${stage > 1 ? "done" : ""}"></span><span class="${stage > 2 ? "done" : ""}"></span></div><p class="card-next">${escapeHtml(nextStep(item))}</p><div class="actions">${actions(item)}</div><button class="details-button" data-detail="${escapeHtml(item.id)}">View handoff timeline ↗</button></article>`;
        })
        .join("")
    : `<div class="empty"><span>${query ? "⌕" : "⌂"}</span><h3>${query ? "No matching arrivals." : filter === "open" ? "You’re all caught up." : "Nothing in this view yet."}</h3><p>${query ? "Try a different note, type or handoff ID." : "Record a parcel or visitor to see a complete handoff, from arrival to receipt."}</p><button class="primary new-arrival">＋ Record an arrival</button>${!items.length ? '<button id="sample-button" class="text-button">Or try a clearly labelled demo scenario ↗</button>' : ""}</div>`;
  if ($("arrival-list").innerHTML !== html) $("arrival-list").innerHTML = html;
  const residentHtml = active.length
    ? [...active]
        .sort(
          (a, b) =>
            Number(b.status === "needs_attention") -
            Number(a.status === "needs_attention"),
        )
        .map(
          (item) =>
            `<article class="resident-card"><span class="status ${item.status}">${labels[item.status]}</span><h2>${item.kind === "parcel" ? "Your parcel is here." : "You have a visitor."}</h2><p>${escapeHtml(item.note || nextStep(item))}</p>${item.note ? `<p>${escapeHtml(nextStep(item))}</p>` : ""}<div class="actions">${actions(item)}</div><button class="details-button" data-detail="${escapeHtml(item.id)}">View timeline ↗</button></article>`,
        )
        .join("")
    : '<div class="resident-card"><span class="eyebrow">ALL CAUGHT UP</span><h2>Nothing needs you right now.</h2><p>We’ll keep the next arrival visible here.</p></div>';
  if ($("resident-content").innerHTML !== residentHtml)
    $("resident-content").innerHTML = residentHtml;
  const recent = historyHtml(snapshot.history.slice(0, 3));
  if ($("recent-activity").innerHTML !== recent)
    $("recent-activity").innerHTML = recent;
  const all = historyHtml(snapshot.history);
  if ($("activity-list").innerHTML !== all) $("activity-list").innerHTML = all;
  const selected = $("assistant-target").value;
  const options =
    '<option value="">Choose an arrival before changing its status</option>' +
    active
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}">${escapeHtml(item.kind)} · ${escapeHtml(item.id.slice(0, 8))} · ${labels[item.status]}</option>`,
      )
      .join("");
  if ($("assistant-target").innerHTML !== options) {
    $("assistant-target").innerHTML = options;
    $("assistant-target").value = selected;
  }
}
async function refresh(log = false) {
  if (refreshPending) return;
  refreshPending = true;
  try {
    const result = await tool("home_status", {}, log);
    if (!ready) return;
    snapshot = result;
    render();
    $("connection").textContent = "● Household connected";
  } finally {
    refreshPending = false;
  }
}
async function perform(fn) {
  if (busy) return toast("An action is already in progress.");
  if (!ready) return toast("Sign in and connect to your household first.");
  busy = true;
  try {
    await fn();
    await refresh();
    if ($("detail-dialog").open && detailId) await showDetail(detailId, false);
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
  }
}
async function showDetail(id, show = true) {
  const result = await tool("handoff_details", { handoffId: id });
  detailId = id;
  const item = result.handoff;
  $("detail-content").innerHTML =
    `<span class="status ${item.status}">${labels[item.status]}</span><h2>${item.kind === "parcel" ? "Parcel handoff" : "Visitor handoff"}</h2><p>${escapeHtml(item.note || "No note added.")}</p><p class="micro">${escapeHtml(item.id)} · Manually recorded</p><div class="actions">${actions(item)}</div><p>${escapeHtml(nextStep(item))}</p><h3>From arrival to now</h3>${historyHtml(result.history, false)}`;
  if (show && !$("detail-dialog").open) $("detail-dialog").showModal();
}
function newArrival() {
  arrivalKey = crypto.randomUUID();
  $("arrival-form").reset();
  $("arrival-dialog").showModal();
}
$("arrival-form").onsubmit = (event) => {
  event.preventDefault();
  $("arrival-submit").disabled = true;
  perform(async () => {
    await tool("record_arrival", {
      eventKey: arrivalKey,
      kind: new FormData($("arrival-form")).get("kind"),
      note: $("arrival-note").value.trim(),
    });
    $("arrival-dialog").close();
    toast("Arrival recorded. The next step is visible.");
  }).finally(() => ($("arrival-submit").disabled = false));
};
$("preferences-form").onsubmit = (event) => {
  event.preventDefault();
  perform(async () => {
    await tool("household_preferences", {
      household: $("household-input").value.trim(),
      resident: $("resident-input").value.trim(),
      instructions: $("instructions-input").value.trim(),
      acknowledgementSeconds: Number($("window-input").value),
    });
    $("preferences-result").textContent = "Saved to your household.";
    toast("Household preferences saved.");
  });
};
$("quiet-toggle").onclick = () =>
  perform(async () => {
    await tool("set_quiet_mode", { enabled: !snapshot.preferences.quietMode });
    toast("Quiet mode updated for this app.");
  });
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.view) view(button.dataset.view);
  if (button.classList.contains("new-arrival")) newArrival();
  if (button.classList.contains("close-dialog"))
    button.closest("dialog").close();
  if (button.dataset.filter) {
    filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  }
  if (button.dataset.detail)
    showDetail(button.dataset.detail).catch((error) => toast(error.message));
  if (button.dataset.action)
    perform(async () => {
      await tool(button.dataset.action, { handoffId: button.dataset.id });
      toast(
        {
          acknowledge_arrival:
            "Acknowledged. Handoff instructions are now visible.",
          complete_handoff: "Received. This handoff is complete.",
          cancel_handoff: "The handoff has been dismissed.",
        }[button.dataset.action],
      );
    });
  if (button.id === "sample-button")
    perform(async () => {
      const first = await tool("record_arrival", {
        eventKey: crypto.randomUUID(),
        kind: "parcel",
        note: "Demo scenario · A parcel delivered beside the front door",
      });
      await tool("acknowledge_arrival", { handoffId: first.handoff.id });
      await tool("complete_handoff", { handoffId: first.handoff.id });
      const second = await tool("record_arrival", {
        eventKey: crypto.randomUUID(),
        kind: "visitor",
        note: "Demo scenario · A friend waiting at the entrance",
      });
      await tool("acknowledge_arrival", { handoffId: second.handoff.id });
      await tool("record_arrival", {
        eventKey: crypto.randomUUID(),
        kind: "parcel",
        note: "Demo scenario · Grocery bag ready to collect",
      });
      toast(
        "Three labelled sample arrivals added. All metrics use these saved records.",
      );
    });
  if (button.dataset.prompt) chat(button.dataset.prompt);
});
$("account-button").onclick = () => view("settings");
$("search").oninput = render;
$("sort-order").onchange = render;
$("assistant-open").onclick = () => {
  render();
  $("assistant-dialog").showModal();
  if (!$("messages").children.length)
    message(
      "Check your home, switch quiet mode on or off, or choose an arrival and confirm its next step.",
    );
};
function message(text, author = "assistant") {
  const element = document.createElement("p");
  element.className = `message ${author}`;
  element.textContent = text;
  $("messages").append(element);
  $("messages").scrollTop = $("messages").scrollHeight;
}
async function chat(text) {
  if (!text.trim()) return;
  message(text, "user");
  $("chat-input").value = "";
  const command = text.toLowerCase().trim();
  await perform(async () => {
    if (/^(check my home|home status|status)$/.test(command)) {
      await refresh();
      const active = snapshot.handoffs.filter(open);
      message(
        `${active.length} open handoff${active.length === 1 ? "" : "s"}. ${active.filter((item) => item.status === "needs_attention").length} need attention. Quiet mode is ${snapshot.preferences.quietMode ? "on" : "off"}.`,
      );
    } else if (/^(turn )?quiet( mode)? (on|off)$/.test(command)) {
      await tool("set_quiet_mode", { enabled: command.endsWith("on") });
      message(
        `Quiet mode is ${command.endsWith("on") ? "on" : "off"} in this app. Your physical doorbell is unchanged.`,
      );
    } else if (
      /^(i have seen it|i’ve seen it|acknowledge|it is received|received)$/.test(
        command,
      )
    ) {
      const handoffId = $("assistant-target").value;
      if (!handoffId)
        return message(
          "Choose the specific arrival above before changing its status.",
        );
      const name =
        command === "received" || command === "it is received"
          ? "complete_handoff"
          : "acknowledge_arrival";
      try {
        const result = await tool(name, { handoffId });
        message(
          name === "complete_handoff"
            ? "You confirmed receipt. The handoff is complete."
            : `Acknowledged. Your saved instructions: ${result.instructions} These are displayed here, not sent to a visitor.`,
        );
      } catch (error) {
        message(error.message);
        throw error;
      }
    } else
      message(
        "Supported commands: “Check my home”, “Turn quiet mode on/off”, “I have seen it”, and “It is received”. Select an arrival before changing its status.",
      );
  });
}
$("chat-form").onsubmit = (event) => {
  event.preventDefault();
  chat($("chat-input").value);
};
$("export-button").onclick = () => {
  const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    "time,handoff_id,action",
    ...snapshot.history.map((entry) =>
      [entry.at, entry.handoff_id, entry.action].map(cell).join(","),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `doorstep-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Exported the latest 50 activity events.");
};
$("summary-button").onclick = async () => {
  $("summary-button").disabled = true;
  $("summary-output").textContent = "Requesting a summary…";
  try {
    const response = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    $("summary-output").textContent = `${result.text} (${result.provider})`;
  } catch (error) {
    $("summary-output").textContent = error.message;
  } finally {
    $("summary-button").disabled = false;
  }
};
document.addEventListener("keydown", (event) => {
  if (
    event.target.closest("input,textarea,select") ||
    document.querySelector("dialog[open]")
  )
    return;
  if (event.key === "/" && currentView === "overview" && ready) {
    event.preventDefault();
    $("search").focus();
  }
  if (
    currentView === "resident" &&
    ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)
  ) {
    const buttons = [...$("resident-content").querySelectorAll("button")];
    if (!buttons.length) return;
    event.preventDefault();
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    buttons[
      (buttons.indexOf(document.activeElement) + direction + buttons.length) %
        buttons.length
    ].focus();
  }
});
setInterval(async () => {
  if (ready && !busy && !document.hidden)
    try {
      await refresh();
    } catch (error) {
      $("connection").textContent = "○ Connection interrupted";
    }
}, 2500);
try {
  await authStatus();
} catch (error) {
  $("gate-title").textContent = "Home is out of reach.";
  $("gate-description").textContent = error.message;
  toast(error.message);
}
