const $ = (id) => document.getElementById(id);
let sequence = 0;
let snapshot = { handoffs: [], history: [], preferences: {} };
let ready = false;
let busy = false;
let currentView = "home";
const requests = [];
const escapeHtml = (value) =>
  String(value).replace(
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

function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.add("hidden"), 4500);
}

async function rpc(method, params = {}, log = true) {
  const request = { jsonrpc: "2.0", id: ++sequence, method, params };
  const response = await fetch("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok)
    throw new Error(
      `Connection error (${response.status}). Your action was not confirmed. Please check the home status before retrying.`,
    );
  const body = await response.json();
  if (log) {
    requests.unshift({
      method,
      params,
      result: body.result?.isError ? "tool error" : body.error || "ok",
      at: clock(Date.now()),
    });
    requests.splice(40);
    $("request-log").textContent = requests
      .map(
        (entry) =>
          `${entry.at}  ${entry.method}\n${JSON.stringify(entry.params)}\n→ ${JSON.stringify(entry.result)}`,
      )
      .join("\n\n");
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

function actions(item, large = false) {
  const id = escapeHtml(item.id);
  if (["waiting", "needs_attention"].includes(item.status))
    return `<button class="button ${large ? "cream" : "primary"}" data-action="acknowledge_arrival" data-id="${id}">I’ve seen it ✓</button><button class="button secondary" data-action="cancel_handoff" data-id="${id}">Dismiss</button>`;
  if (item.status === "acknowledged")
    return `<button class="button ${large ? "cream" : "primary"}" data-action="complete_handoff" data-id="${id}">It’s received ✓</button><button class="button secondary" data-action="cancel_handoff" data-id="${id}">Cancel handoff</button>`;
  return "";
}

function description(item) {
  if (item.status === "waiting")
    return "Waiting for the resident to acknowledge. A visible prompt stays here until they do.";
  if (item.status === "needs_attention")
    return "No acknowledgement yet. This stays in the attention queue. No external alert has been sent.";
  if (item.status === "acknowledged") return snapshot.preferences.instructions;
  if (item.status === "completed")
    return "The resident confirmed this handoff is complete.";
  return "Dismissed by the resident.";
}

function render() {
  const active = snapshot.handoffs.filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  );
  $("active-count").textContent = active.length;
  $("done-count").textContent = snapshot.handoffs.filter(
    (item) => item.status === "completed",
  ).length;
  $("quiet-label").textContent = snapshot.preferences.quietMode
    ? "Quiet mode on"
    : "Quiet mode off";
  $("quiet-toggle").setAttribute(
    "aria-pressed",
    String(Boolean(snapshot.preferences.quietMode)),
  );
  const list = active.length ? active : snapshot.handoffs.slice(0, 2);
  const handoffHtml = list
    .map(
      (item) =>
        `<article class="handoff"><div class="handoff-top"><h4>${item.kind === "parcel" ? "▧ Parcel at the door" : "♧ A visitor is here"}</h4><span class="status ${escapeHtml(item.status)}">${escapeHtml(item.status.replaceAll("_", " "))}</span></div><p>${escapeHtml(description(item))}</p>${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}<div class="actions">${actions(item)}</div></article>`,
    )
    .join("");
  const nextHtml =
    handoffHtml ||
    '<div class="empty"><span>⌂</span><b>All quiet at the moment.</b><p>When someone arrives, their next step will appear here.</p></div>';
  if ($("handoffs").innerHTML !== nextHtml) $("handoffs").innerHTML = nextHtml;
  const next = active[0];
  const residentHtml = next
    ? `<article class="resident-card"><span class="pill">${next.status === "needs_attention" ? "STILL WAITING FOR YOU" : "AT YOUR DOOR"}</span><h2>${next.kind === "parcel" ? "Your parcel is here." : "You have a visitor."}</h2><p>${escapeHtml(description(next))}</p>${actions(next, true)}</article>`
    : '<article class="resident-card"><span class="pill">YOU’RE ALL CAUGHT UP</span><h2>Nothing needs you right now.</h2><p>We’ll keep the next arrival visible here.</p></article>';
  if ($("resident-content").innerHTML !== residentHtml)
    $("resident-content").innerHTML = residentHtml;
  $("history-content").innerHTML = snapshot.history.length
    ? snapshot.history
        .map(
          (entry) =>
            `<div class="history-entry"><time>${escapeHtml(clock(entry.at))}</time><div>${escapeHtml(entry.action)}<small>Handoff ${escapeHtml(entry.handoff_id.slice(0, 8))}</small></div></div>`,
        )
        .join("")
    : '<p class="muted">No handoffs yet. Try recording a parcel arrival.</p>';
}

async function refresh(log = false) {
  snapshot = await tool("home_status", {}, log);
  render();
  $("connection").textContent = "● MCP connected";
}

function message(text, author = "assistant") {
  const element = document.createElement("div");
  element.className = `message ${author === "user" ? "user" : "assistant"}-message`;
  element.textContent = text;
  $("messages").append(element);
  $("messages").scrollTop = $("messages").scrollHeight;
}

async function perform(fn) {
  if (busy) return;
  if (!ready)
    return toast("The connection is not ready. Please reload and try again.");
  busy = true;
  try {
    await fn();
    await refresh();
  } catch (error) {
    toast(error.message);
    message(error.message);
  } finally {
    busy = false;
  }
}

async function arrive(kind) {
  const result = await tool("record_arrival", {
    eventKey: crypto.randomUUID(),
    kind,
  });
  message(
    `I’ve recorded a ${kind} arrival. The resident display will keep it visible until it is acknowledged. This is a manually entered demo event.`,
  );
  toast(`${kind === "parcel" ? "Parcel" : "Visitor"} arrival recorded.`);
  return result;
}

async function chat(text) {
  if (!text.trim()) return;
  message(text, "user");
  $("chat-input").value = "";
  const value = text.toLowerCase().replace(/[’']/g, "");
  await perform(async () => {
    await refresh();
    if (/quiet|silent|sound/.test(value)) {
      const enabled = !/off|disable/.test(value);
      await tool("set_quiet_mode", { enabled });
      message(
        enabled
          ? "Quiet mode is on. Arrivals stay visible in this app without a sound. Your physical doorbell settings are unchanged."
          : "Quiet mode is off. Your physical doorbell settings are unchanged.",
      );
    } else if (/received|complete|collected|delivered/.test(value)) {
      const item = snapshot.handoffs.find(
        (item) => item.status === "acknowledged",
      );
      if (!item)
        return message(
          "Please acknowledge the arrival first using “I’ve seen it”. I won’t mark a handoff complete before you have seen it.",
        );
      await tool("complete_handoff", { handoffId: item.id });
      message(
        "All done. I’ve marked the handoff as received and saved it in the history.",
      );
    } else if (/seen|acknowledge|got it/.test(value)) {
      const item = snapshot.handoffs.find((item) =>
        ["waiting", "needs_attention"].includes(item.status),
      );
      if (!item)
        return message("There isn’t an arrival waiting for acknowledgement.");
      const result = await tool("acknowledge_arrival", { handoffId: item.id });
      message(
        `You’ve acknowledged the arrival. Your saved handoff instructions are: “${result.instructions}” These instructions are shown here; they have not been sent to a visitor.`,
      );
    } else if (/parcel.*(arriv|here)|record.*parcel/.test(value))
      await arrive("parcel");
    else if (/visitor.*(arriv|here)|record.*visitor/.test(value))
      await arrive("visitor");
    else if (/home|status|happening|arrival|door|waiting/.test(value)) {
      const open = snapshot.handoffs.filter(
        (item) => !["completed", "cancelled"].includes(item.status),
      );
      message(
        open.length
          ? `There ${open.length === 1 ? "is 1 open handoff" : `are ${open.length} open handoffs`}. ${open.filter((item) => item.status === "needs_attention").length} need attention. Quiet mode is ${snapshot.preferences.quietMode ? "on" : "off"}. Your latest ${open[0].kind} is ${open[0].status.replaceAll("_", " ")}.`
          : "Everything is caught up. No arrivals need your attention right now.",
      );
    } else
      message(
        "Try “Check my home”, “Turn quiet mode on”, “A parcel is here”, “I’ve seen the latest arrival”, or “The parcel is received”. This local simulator uses these explicit intent shortcuts.",
      );
  });
}

document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document
      .querySelectorAll(".view")
      .forEach((view) =>
        view.classList.toggle("hidden", view.id !== currentView),
      );
    document
      .querySelectorAll(".nav")
      .forEach((nav) => nav.classList.toggle("active", nav === button));
    $("view-label").textContent = button.textContent.trim();
  }),
);
$("demo-start").addEventListener("click", () =>
  perform(() => arrive("parcel")),
);
$("parcel-button").addEventListener("click", () =>
  perform(() => arrive("parcel")),
);
$("visitor-button").addEventListener("click", () =>
  perform(() => arrive("visitor")),
);
$("quiet-toggle").addEventListener("click", () =>
  perform(() =>
    tool("set_quiet_mode", { enabled: !snapshot.preferences.quietMode }),
  ),
);
$("chat-form").addEventListener("submit", (event) => {
  event.preventDefault();
  chat($("chat-input").value);
});
document
  .querySelectorAll("[data-prompt]")
  .forEach((button) =>
    button.addEventListener("click", () => chat(button.dataset.prompt)),
  );
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  perform(async () => {
    const result = await tool(button.dataset.action, {
      handoffId: button.dataset.id,
    });
    const text = {
      acknowledge_arrival:
        "Acknowledged. Your handoff instructions are now visible.",
      complete_handoff: "Received. This handoff is complete.",
      cancel_handoff: "The handoff has been dismissed.",
    }[button.dataset.action];
    message(text + (result.instructions ? ` ${result.instructions}` : ""));
    toast(text);
  });
});
document.addEventListener("keydown", (event) => {
  if (
    currentView !== "resident" ||
    !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)
  )
    return;
  const buttons = [...$("resident").querySelectorAll("button")];
  if (!buttons.length) return;
  event.preventDefault();
  const next =
    buttons.indexOf(document.activeElement) +
    (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1);
  buttons[(next + buttons.length) % buttons.length].focus();
});
$("summary-button").addEventListener("click", async () => {
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
});
$("date").textContent = new Date().toLocaleDateString([], {
  weekday: "short",
  day: "numeric",
  month: "long",
});
try {
  const init = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "doorstep-browser", version: "0.1.0" },
  });
  $("protocol-version").textContent = init.protocolVersion;
  await fetch("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  });
  const listing = await rpc("tools/list");
  $("tool-count").textContent = listing.tools.length;
  ready = true;
  await refresh(true);
  setInterval(async () => {
    if (!busy)
      try {
        await refresh();
      } catch {
        $("connection").textContent = "○ Reconnecting…";
      }
  }, 2500);
} catch (error) {
  $("connection").textContent = "○ Connection unavailable";
  toast(error.message);
}
