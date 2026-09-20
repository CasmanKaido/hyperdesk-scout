const form = document.querySelector("#analysis-form");
const chatForm = document.querySelector("#chat-form");
const conversationLog = document.querySelector("#conversation-log");
const constraintsDisclosure = document.querySelector("#constraints-disclosure");
const reviewButton = document.querySelector("#review-plan");
const approveButton = document.querySelector("#approve-plan");
const reviseButton = document.querySelector("#revise-plan");
const retryButton = document.querySelector("#retry-analysis");
const buttonLabel = reviewButton.querySelector(".button-label");
const objectiveInput = document.querySelector("#objective-message");
const generatePlanButton = document.querySelector("#generate-plan");
const plannerButtonLabel = generatePlanButton.querySelector(".planner-button-label");
const plannerStatus = document.querySelector("#planner-status");
const symbolsInput = document.querySelector("#symbols");
const symbolsError = document.querySelector("#symbols-error");
const formError = document.querySelector("#form-error");
const emptyState = document.querySelector("#empty-state");
const planState = document.querySelector("#plan-state");
const planObjective = document.querySelector("#plan-objective");
const aiPlanContext = document.querySelector("#ai-plan-context");
const aiPlanSummary = document.querySelector("#ai-plan-summary");
const aiPlanProvider = document.querySelector("#ai-plan-provider");
const aiPlanAssumptions = document.querySelector("#ai-plan-assumptions");
const loadingState = document.querySelector("#loading-state");
const errorState = document.querySelector("#error-state");
const errorMessage = document.querySelector("#error-message");
const resultState = document.querySelector("#result-state");
const resultSummary = document.querySelector("#result-summary");
const candidateResults = document.querySelector("#candidate-results");
const workflowResults = document.querySelector("#workflow-results");
const evidenceResults = document.querySelector("#evidence-results");
const analysisPanel = document.querySelector(".analysis-panel");
const analysisStatus = document.querySelector("#analysis-status");
const serviceStatus = document.querySelector("#service-status");
const headerStatus = document.querySelector(".header-status");
let pendingInput = null;
let latestAIPlan = null;
let latestAnalysis = null;
let conversationHistory = [];
let aiDraftEdited = false;
let hasActivePlan = false;
let busy = false;
let pendingInfo = null;
let suggestedDefaults = ["symbols", "risk_tolerance", "max_leverage", "max_notional_usd", "min_funding_apr"];
const infoConfirmation = document.querySelector("#info-confirmation");
const infoQuery = document.querySelector("#info-query");
const fetchOverviewButton = document.querySelector("#fetch-overview");
const manualPlanButton = document.querySelector("#use-manual-plan");
const overviewState = document.querySelector("#overview-state");

function syncControls() {
  generatePlanButton.disabled = busy;
  objectiveInput.disabled = busy;
  reviewButton.disabled = busy || !hasActivePlan;
  reviewButton.hidden = !hasActivePlan || Boolean(pendingInfo) || Boolean(pendingInput) || busy;
  approveButton.disabled = busy || !pendingInput;
  retryButton.disabled = busy || !pendingInput;
  reviseButton.disabled = busy;
  manualPlanButton.disabled = busy;
  fetchOverviewButton.disabled = busy || !pendingInfo;
  for (const input of form.querySelectorAll("input, select, textarea, button")) input.disabled = busy;
}

function clearApprovals() {
  archiveResearch();
  pendingInput = null;
  pendingInfo = null;
  infoConfirmation.hidden = true;
  if (!planState.hidden) showView("empty");
  syncControls();
}

function archiveResearch() {
  const active = !overviewState.hidden ? overviewState : !resultState.hidden ? resultState : null;
  if (!active || analysisPanel.hidden) return;
  const snapshot = active.cloneNode(true);
  snapshot.removeAttribute("id");
  for (const node of snapshot.querySelectorAll("[id]")) node.removeAttribute("id");
  const archive = element("details", { className: "supporting-details research-archive" }, [
    element("summary", { text: active === overviewState ? `Previous market evidence · ${latestAnalysis?.query?.symbols?.join(", ") || "snapshot"}` : "Previous strategy result" }),
    snapshot,
  ]);
  analysisPanel.before(archive);
  showView("empty");
}

function defaultsLabel() {
  const labels = { symbols: "markets", risk_tolerance: "risk tolerance", max_leverage: "leverage cap", max_notional_usd: "notional limit", min_funding_apr: "funding threshold", objective: "objective" };
  return suggestedDefaults.length
    ? `Suggested defaults (not user-supplied): ${suggestedDefaults.map(field => labels[field] || sentence(field)).join(", ")}.`
    : "No suggested defaults remain in these constraints.";
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, signDisplay: "auto" });

const reasonLabels = {
  market_data_not_fresh: "Market data was not fresh",
  funding_threshold_not_met: "Funding did not meet the requested threshold",
  liquidity_policy_failed: "Liquidity did not satisfy the selected risk policy",
  leverage_exceeds_market_limit: "Requested leverage exceeds the market limit",
  risk_score_above_policy: "Risk score exceeds the selected policy",
  basis_above_policy: "Absolute basis exceeds the selected policy",
  leverage_above_conservative_service_default: "Leverage is above the conservative service default",
  extreme_funding_may_reverse: "Extreme funding may reverse quickly",
  liquidity_score_below_policy: "Liquidity score is below policy",
  impact_spread_unavailable: "Impact spread is unavailable",
  impact_spread_above_policy: "Impact spread is above policy",
  requested_notional_large_vs_24h_volume: "Requested notional is large relative to 24-hour volume",
};

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) node.setAttribute(name, String(value));
    }
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

function formatNumber(value, fallback = "—") {
  return Number.isFinite(value) ? decimal.format(value) : fallback;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${percent.format(value)}%` : "—";
}

function formatCurrency(value, compact = false) {
  if (!Number.isFinite(value)) return "—";
  return (compact ? compactCurrency : currency).format(value);
}

function formatDate(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatAge(milliseconds) {
  if (!Number.isFinite(milliseconds)) return "Unavailable";
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(1)} s`;
}

function sentence(value) {
  if (!value) return "Unavailable";
  return reasonLabels[value] || String(value).replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function showView(view) {
  analysisPanel.hidden = view === "empty";
  if (view !== "empty") conversationLog.append(analysisPanel);
  overviewState.hidden = view !== "overview";
  emptyState.hidden = view !== "empty";
  planState.hidden = view !== "plan";
  loadingState.hidden = view !== "loading";
  errorState.hidden = view !== "error";
  resultState.hidden = view !== "result";
  analysisPanel.setAttribute("aria-busy", view === "loading" ? "true" : "false");
}

function validateSymbols() {
  const values = symbolsInput.value
    .split(/[\s,]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const unique = [...new Set(values)];

  let message = "";
  if (unique.length === 0) message = "Enter at least one market symbol, such as BTC.";
  else if (unique.length > 20) message = "Use no more than 20 market symbols per analysis.";
  else if (unique.some((value) => !/^[A-Z0-9:_-]{1,30}$/.test(value))) {
    message = "Symbols can contain letters, numbers, colons, underscores, and hyphens only.";
  }

  symbolsError.textContent = message;
  symbolsInput.setAttribute("aria-invalid", message ? "true" : "false");
  return message ? null : unique;
}

function collectInput() {
  formError.textContent = "";
  const symbols = validateSymbols();
  if (!symbols) return null;

  const maxLeverage = Number(form.elements.max_leverage.value);
  const maxNotionalUsd = Number(form.elements.max_notional_usd.value);
  const minFundingApr = Number(form.elements.min_funding_apr.value);

  if (!form.checkValidity()) {
    formError.textContent = "Review the highlighted limits before running the analysis.";
    form.reportValidity();
    return null;
  }

  return {
    objective: "market_neutral_income",
    symbols,
    risk_tolerance: form.elements.risk_tolerance.value,
    max_leverage: maxLeverage,
    max_notional_usd: maxNotionalUsd,
    min_funding_apr: minFundingApr,
  };
}

function definitionList(items, className = "result-meta") {
  const list = element("dl", { className });
  for (const [term, description] of items) {
    list.append(element("div", {}, [
      element("dt", { text: term }),
      element("dd", { text: description }),
    ]));
  }
  return list;
}

function sectionHeading(title, description, count) {
  const headingCopy = element("div", {}, [
    element("h3", { text: title }),
    description ? element("p", { text: description }) : null,
  ]);
  const children = [headingCopy];
  if (count !== undefined) children.push(element("span", { className: "evidence-count", text: count }));
  return element("div", { className: "section-heading" }, children);
}

function renderSummary(data) {
  const hasCandidates = data.synthesis?.outcome === "review_candidates";
  const hero = element("section", {
    className: "result-hero",
    attrs: { "data-outcome": data.synthesis?.outcome || "unknown" },
  });

  hero.append(element("div", { className: "result-topline" }, [
    element("span", {
      className: "state-chip",
      text: hasCandidates ? "Review candidates found" : "No candidate passed",
    }),
    element("span", {
      className: "evidence-count",
      text: data.provenance?.data_status === "fresh" ? "Fresh evidence" : "Stale evidence",
    }),
  ]));

  hero.append(element("h3", {
    text: hasCandidates
      ? `${data.synthesis.opportunities.length} market${data.synthesis.opportunities.length === 1 ? "" : "s"} reached the review boundary.`
      : "The current evidence does not support a review candidate.",
  }));
  hero.append(element("p", { text: data.synthesis?.next_action || "Review the evidence before taking any action." }));
  hero.append(definitionList([
    ["Data source", data.provenance?.source || "Unavailable"],
    ["Fetched", formatDate(data.provenance?.fetched_at)],
    ["Evidence age", formatAge(data.provenance?.age_ms)],
  ]));

  resultSummary.replaceChildren(hero);
}

function metric(term, value) {
  return element("div", {}, [element("dt", { text: term }), element("dd", { text: value })]);
}

function renderCandidate(candidate) {
  const row = element("article", {
    className: "candidate-row",
    attrs: { "data-decision": candidate.decision },
  });
  row.append(element("div", { className: "candidate-head" }, [
    element("span", { className: "candidate-symbol", text: candidate.symbol }),
    element("span", {
      className: "decision-badge",
      text: candidate.decision === "approve" ? "Policy pass" : "Review caution",
      attrs: { "data-decision": candidate.decision },
    }),
  ]));
  row.append(element("dl", { className: "metric-grid" }, [
    metric("Funding APR", formatPercent(candidate.funding_apr_percent)),
    metric("Basis", formatPercent(candidate.basis_percent)),
    metric("Liquidity", Number.isFinite(candidate.liquidity_score) ? `${Math.round(candidate.liquidity_score * 100)} / 100` : "—"),
    metric("Impact spread", Number.isFinite(candidate.impact_spread_bps) ? `${formatNumber(candidate.impact_spread_bps)} bps` : "—"),
    metric("Risk score", Number.isFinite(candidate.risk_score) ? `${Math.round(candidate.risk_score * 100)} / 100` : "—"),
    metric("Review limit", `${formatCurrency(candidate.max_notional_usd, true)} · ${formatNumber(candidate.max_leverage)}×`),
  ]));
  row.append(element("p", { className: "subsection-label", text: "Strategy shape" }));
  row.append(element("p", { text: sentence(candidate.strategy_shape) }));

  if (candidate.cautions?.length) {
    row.append(element("ul", { className: "caution-list" }, candidate.cautions.map((item) => element("li", { text: sentence(item) }))));
  }
  return row;
}

function renderCandidates(data) {
  const section = element("section", { className: "result-section" });
  const opportunities = data.synthesis?.opportunities || [];
  const rejected = data.synthesis?.rejected || [];
  section.append(sectionHeading("Decision summary", "Candidates are review boundaries, not execution instructions.", opportunities.length + rejected.length));

  if (opportunities.length) {
    section.append(element("div", { className: "candidate-list" }, opportunities.map(renderCandidate)));
  } else {
    section.append(element("p", { text: "No requested market passed every funding, liquidity, freshness, and risk constraint." }));
  }

  if (rejected.length) {
    section.append(element("p", { className: "subsection-label", text: "Rejected markets" }));
    section.append(element("div", { className: "rejection-list" }, rejected.map((item) => {
      const reasons = item.blockers?.map(sentence).join(" · ") || "Rejected by the active policy";
      return element("article", { className: "rejection-row" }, [
        element("div", { className: "rejection-head" }, [
          element("span", { className: "rejection-symbol", text: item.symbol }),
          element("span", { className: "decision-badge", text: "Rejected", attrs: { "data-decision": "reject" } }),
        ]),
        element("p", { text: reasons }),
      ]);
    })));
  }

  if (data.unavailable_symbols?.length) {
    section.append(element("p", { className: "subsection-label", text: "Unavailable symbols" }));
    section.append(element("p", { text: `${data.unavailable_symbols.join(", ")} did not appear in the current Hyperliquid snapshot.` }));
  }

  candidateResults.replaceChildren(section);
}

function renderWorkflow(data) {
  const section = element("section", { className: "result-section" });
  const trace = data.workflow?.trace || [];
  section.append(sectionHeading("Orchestration trace", "Every specialist completed against the same evidence snapshot.", trace.length));
  section.append(definitionList([
    ["Router", "LiquidFlux"],
    ["Marketplace-listed", "Funding Specialist"],
    ["External services", "None connected"],
    ["Service spend", "0 USDT"],
  ], "execution-ledger"));
  section.append(element("div", { className: "workflow-trace" }, trace.map((item) => element("div", { className: "workflow-stage" }, [
    element("span", { className: "workflow-name" }, [
      element("span", { className: "workflow-check", text: "✓", attrs: { "aria-hidden": "true" } }),
      element("span", { text: `${sentence(item.specialist)} specialist` }),
    ]),
    element("span", { className: "workflow-meta", text: `${item.evidence_count} evidence · ${item.status}` }),
  ]))));

  if (data.conflicts?.length) {
    section.append(element("p", { className: "subsection-label", text: "Detected conflicts" }));
    section.append(element("div", { className: "conflict-list" }, data.conflicts.map((conflict) => element("article", { className: "conflict-row" }, [
      element("strong", { text: `${conflict.symbol} · ${sentence(conflict.type)}` }),
      element("p", { text: conflict.summary }),
    ]))));
  }

  workflowResults.replaceChildren(section);
}

function table(headers, rows) {
  const tableNode = element("table", { className: "evidence-table" });
  tableNode.append(element("thead", {}, element("tr", {}, headers.map((header) => element("th", { text: header, attrs: { scope: "col" } })))));
  tableNode.append(element("tbody", {}, rows.map((row) => element("tr", {}, row.map((value) => element("td", { text: value }))))));
  return element("div", { className: "evidence-table-wrap" }, tableNode);
}

function specialistDetails(title, subtitle, tableNode) {
  return element("details", { className: "specialist-detail" }, [
    element("summary", { className: "specialist-summary" }, [
      element("span", {}, [element("strong", { text: title }), element("small", { text: subtitle })]),
    ]),
    tableNode,
  ]);
}

function renderEvidence(data) {
  const section = element("section", { className: "result-section" });
  const funding = data.specialist_outputs?.funding;
  const liquidity = data.specialist_outputs?.liquidity;
  const risk = data.specialist_outputs?.risk;
  section.append(sectionHeading("Specialist evidence", "Inspect the calculations and policy outcomes behind the synthesis."));

  const stack = element("div", { className: "specialist-stack" });
  stack.append(specialistDetails(
    "Funding Specialist",
    `${funding?.candidates?.length || 0} markets checked against ${formatPercent(data.constraints?.min_funding_apr)} minimum APR`,
    table(
      ["Market", "Eligible", "Funding APR", "Funding rate", "Strategy"],
      (funding?.candidates || []).map((item) => [
        item.symbol,
        item.eligible ? "Yes" : "No",
        formatPercent(item.funding_apr_percent),
        formatNumber(item.funding_rate),
        sentence(item.strategy_shape),
      ]),
    ),
  ));
  stack.append(specialistDetails(
    "Liquidity Specialist",
    `${liquidity?.markets?.length || 0} markets tested for depth and impact`,
    table(
      ["Market", "Acceptable", "Liquidity", "Impact spread", "24h volume", "Open interest"],
      (liquidity?.markets || []).map((item) => [
        item.symbol,
        item.acceptable ? "Yes" : "No",
        Number.isFinite(item.liquidity_score) ? `${Math.round(item.liquidity_score * 100)} / 100` : "—",
        Number.isFinite(item.impact_spread_bps) ? `${formatNumber(item.impact_spread_bps)} bps` : "—",
        formatCurrency(item.volume_24h_usd, true),
        formatCurrency(item.open_interest_notional_usd, true),
      ]),
    ),
  ));
  stack.append(specialistDetails(
    "Risk Policy Specialist",
    `${risk?.decisions?.length || 0} decisions under the ${data.constraints?.risk_tolerance || "selected"} policy`,
    table(
      ["Market", "Decision", "Risk score", "Basis", "Blockers", "Cautions"],
      (risk?.decisions || []).map((item) => [
        item.symbol,
        sentence(item.decision),
        Number.isFinite(item.risk_score) ? `${Math.round(item.risk_score * 100)} / 100` : "—",
        formatPercent(item.basis_percent),
        item.blockers?.length ? item.blockers.map(sentence).join("; ") : "None",
        item.cautions?.length ? item.cautions.map(sentence).join("; ") : "None",
      ]),
    ),
  ));

  const raw = element("details", { className: "raw-evidence" }, [
    element("summary", { text: "View complete structured response" }),
    element("pre", { text: JSON.stringify(data, null, 2) }),
  ]);
  section.append(stack, raw);
  evidenceResults.replaceChildren(section);
}

function renderResult(data) {
  renderSummary(data);
  renderCandidates(data);
  renderWorkflow(data);
  renderEvidence(data);
  showView("result");
  analysisStatus.textContent = `Analysis complete. ${data.synthesis?.opportunities?.length || 0} review candidates and ${data.synthesis?.rejected?.length || 0} rejected markets.`;
  requestAnimationFrame(() => {
    resultState.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });
}

function planFields(plan) {
  return {
    objective: "market_neutral_income",
    symbols: [...plan.symbols],
    risk_tolerance: plan.risk_tolerance,
    max_leverage: plan.max_leverage,
    max_notional_usd: plan.max_notional_usd,
    min_funding_apr: plan.min_funding_apr,
  };
}

function analysisContext(data) {
  if (!data) return null;
  if (data.markets && data.evidence) return {
    query: data.query,
    evidence: data.evidence,
    analysis: data.analysis,
    markets: data.markets.map((market) => ({
      symbol: market.symbol, status: market.status, facts: market.facts, calculations: market.calculations,
      funding_history: market.research?.funding_history ? {
        status: market.research.funding_history.status,
        coverage: market.research.funding_history.coverage,
        retrospective_simple_apr_pct: market.research.funding_history.retrospective_simple_apr_pct,
        positive_share: market.research.funding_history.positive_share,
        sign_reversals: market.research.funding_history.sign_reversals,
        stale: market.research.funding_history.stale,
      } : null,
      order_book: market.research?.order_book ? {
        status: market.research.order_book.status, spread_bps: market.research.order_book.spread_bps,
        bid_visible_notional_within_10bps: market.research.order_book.bid_visible_notional_within_10bps,
        ask_visible_notional_within_10bps: market.research.order_book.ask_visible_notional_within_10bps,
        stale: market.research.order_book.stale,
      } : null,
    })),
  };
  return {
    generated_at: data.generated_at,
    provenance: {
      source: data.provenance?.source,
      data_status: data.provenance?.data_status,
      fetched_at: data.provenance?.fetched_at,
    },
    constraints: data.constraints,
    opportunities: (data.synthesis?.opportunities || []).map((item) => ({
      symbol: item.symbol,
      decision: item.decision,
      funding_apr_percent: item.funding_apr_percent,
      liquidity_score: item.liquidity_score,
      impact_spread_bps: item.impact_spread_bps,
      risk_score: item.risk_score,
      basis_percent: item.basis_percent,
      cautions: item.cautions,
    })),
    rejected: data.synthesis?.rejected || [],
    conflicts: data.conflicts || [],
    unavailable_symbols: data.unavailable_symbols || [],
    next_action: data.synthesis?.next_action,
  };
}

function planSnapshot(plan) {
  return definitionList([
    ["Markets", plan.symbols.join(", ")],
    ["Risk", sentence(plan.risk_tolerance)],
    ["Leverage", `${formatNumber(plan.max_leverage)}× max`],
    ["Notional", formatCurrency(plan.max_notional_usd)],
    ["Funding", `${formatNumber(plan.min_funding_apr)}% min APR`],
  ], "chat-plan-grid");
}

function rememberTurn(role, content) {
  conversationHistory.push({ role, content: String(content ?? "").slice(0, 1000) });
  conversationHistory = conversationHistory.slice(-12);
}

function appendMessage(role, text, { meta = "", plan = null, pending = false } = {}) {
  const message = element("article", {
    className: `message message-${role}`,
    attrs: pending ? { "data-state": "pending" } : {},
  }, [
    element("span", { className: "message-author", text: role === "user" ? "You" : "LiquidFlux" }),
    element("p", { text }),
    meta ? element("span", { className: "message-meta", text: meta }) : null,
    plan ? planSnapshot(plan) : null,
  ]);
  document.querySelector("#chat-welcome").hidden = true;
  conversationLog.append(message);
  requestAnimationFrame(() => message.scrollIntoView({
    block: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  }));
  return message;
}

function setPlannerStatus(message, state = "idle") {
  plannerStatus.textContent = message;
  plannerStatus.dataset.state = state;
}

function populateConstraints(plan) {
  symbolsInput.value = plan.symbols.join(", ");
  form.elements.max_leverage.value = String(plan.max_leverage);
  form.elements.max_notional_usd.value = String(plan.max_notional_usd);
  form.elements.min_funding_apr.value = String(plan.min_funding_apr);
  const riskInput = form.querySelector(`input[name="risk_tolerance"][value="${plan.risk_tolerance}"]`);
  if (riskInput) riskInput.checked = true;
  validateSymbols();
}

async function generateAIPlan() {
  if (busy) return;
  const message = objectiveInput.value.trim();
  if (message.length < 1 || message.length > 1000) {
    setPlannerStatus("Write between 1 and 1,000 characters.", "error");
    objectiveInput.focus();
    return;
  }

  if (pendingInfo && /^(yes|y|ok|okay|confirm|sure|go ahead)[.!]?$/i.test(message)) {
    appendMessage("user", message);
    rememberTurn("user", message);
    objectiveInput.value = "";
    await fetchOverview();
    return;
  }
  clearApprovals();
  const payload = { message };
  if (conversationHistory.length) payload.conversation = [...conversationHistory];

  if (hasActivePlan) {
    const currentInput = collectInput();
    if (!currentInput) return;
    payload.current_plan = planFields(currentInput);
  }
  const context = analysisContext(latestAnalysis);
  if (context) payload.analysis_context = context;

  appendMessage("user", message);
  objectiveInput.value = "";
  busy = true;
  syncControls();
  plannerButtonLabel.textContent = "Thinking";
  setPlannerStatus("Understanding your request…");
  const pendingMessage = appendMessage("assistant", "Thinking through your request…", { pending: true });

  try {
    const response = await fetch("/api/v1/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || `The planner returned HTTP ${response.status}.`);
      error.code = data?.error;
      throw error;
    }

    pendingMessage.remove();
    rememberTurn("user", message);
    rememberTurn("assistant", data.intent === "market_information"
      ? `Information scope: symbols=${JSON.stringify(data.symbols)}; topics=${JSON.stringify(data.topics)}. ${data.reply}`
      : data.reply);
    const providerName = data.provider === "groq" ? "Groq" : "Gemini";
    const messageMeta = {
      market_information: `${providerName} · information only`,
      plan_update: `${providerName} · plan updated`,
      result_explanation: `${providerName} · grounded in current evidence`,
      clarification: `${providerName} · clarification`,
      unsupported: `${providerName} · outside current scope`,
    };
    const replyMessage = appendMessage("assistant", data.reply, {
      meta: messageMeta[data.intent],
      plan: data.intent === "plan_update" ? data : null,
    });

    if (data.intent === "plan_update") {
      latestAIPlan = data;
      suggestedDefaults = [...(data.suggested_defaults || [])];
      replyMessage.append(element("p", { className: "default-note", text: defaultsLabel() }));
      hasActivePlan = true;
      aiDraftEdited = false;
      populateConstraints(data);
      pendingInput = null;
      latestAnalysis = null;
      showView("empty");
      conversationLog.append(reviewButton);
      analysisStatus.textContent = "Conversation updated the plan. No market-data service was called.";
      setPlannerStatus("Plan updated. Continue the conversation or review the specialist plan.", "success");
    } else if (data.intent === "market_information") {
      pendingInfo = { symbols: [...data.symbols], topics: [...data.topics], question: message };
      infoQuery.textContent = `Fetch ${pendingInfo.topics.map(sentence).join(", ")} for ${pendingInfo.symbols.join(", ")}?`;
      infoConfirmation.hidden = false;
      conversationLog.append(infoConfirmation);
      setPlannerStatus("Confirm with the free fetch button or reply yes. Other messages replace this pending request.", "success");
    } else if (data.intent === "result_explanation") {
      setPlannerStatus("Answer grounded in the latest displayed analysis evidence.", "success");
    } else {

      setPlannerStatus("Reply received. You can clarify naturally or continue with manual controls.", "success");
    }
    objectiveInput.focus();
  } catch (error) {
    pendingMessage.remove();
    let fallback;
    if (error.code === "ai_unavailable") {
      fallback = "AI conversation is not configured on this deployment. You can still edit the constraints manually.";
    } else if (error.code === "ai_provider_unavailable") {
      fallback = "The AI providers are temporarily unavailable. Your current plan is unchanged, and manual controls still work.";
    } else if (error instanceof TypeError) {
      fallback = "I could not reach the planner. Your current plan is unchanged; try again or use manual controls.";
    } else {
      fallback = `${error.message} Your current plan is unchanged.`;
    }
    appendMessage("assistant", fallback, { meta: "Conversation error" });
    setPlannerStatus(fallback, "error");
  } finally {
    busy = false;
    syncControls();
    objectiveInput.focus();
    plannerButtonLabel.textContent = "Send";
  }
}

function reviewPlan() {
  if (busy || !hasActivePlan) return;
  clearApprovals();
  const input = collectInput();
  if (!input) return;

  pendingInput = input;
  document.querySelector("#review-constraints").replaceChildren(planSnapshot(input));
  document.querySelector("#review-defaults").textContent = defaultsLabel();
  syncControls();
  planObjective.textContent = `I’ll evaluate ${input.symbols.join(", ")} for market-neutral funding income using the limits below.`;
  if (latestAIPlan) {
    const notes = [
      ...latestAIPlan.assumptions.map((item) => `Assumption: ${item}`),
      ...latestAIPlan.missing_information.map((item) => `Missing: ${item}`),
    ];
    aiPlanSummary.textContent = `${latestAIPlan.summary}${aiDraftEdited ? " The generated constraints were edited before review." : ""}`;
    aiPlanProvider.textContent = `${latestAIPlan.provider} · ${latestAIPlan.model}`;
    aiPlanAssumptions.textContent = notes.length ? notes.join(" · ") : "No additional assumptions or missing information";
    aiPlanContext.hidden = notes.length === 0;
  } else {
    aiPlanContext.hidden = true;
  }
  showView("plan");
  analysisStatus.textContent = "Specialist plan ready for review. No service has been called.";
  requestAnimationFrame(() => {
    planState.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  });
}

async function executeAnalysis() {
  if (busy || !pendingInput) return;
  busy = true;
  syncControls();
  showView("loading");
  reviewButton.disabled = true;
  approveButton.disabled = true;
  buttonLabel.textContent = "Workflow running";
  analysisStatus.textContent = "Analysis started. Funding and liquidity specialists are reading current Hyperliquid evidence.";

  let serviceResponded = false;
  try {
    const response = await fetch("/api/v1/orchestrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingInput),
    });
    serviceResponded = true;
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message || `The service returned HTTP ${response.status}.`);
    }
    latestAnalysis = data;
    renderResult(data);
    const candidateCount = data.synthesis?.opportunities?.length || 0;
    const rejectedCount = data.synthesis?.rejected?.length || 0;
    const resultMessage = candidateCount
      ? `${candidateCount} market${candidateCount === 1 ? " reached" : "s reached"} the review boundary. Ask me about any decision, risk score, rejection, or constraint in this result.`
      : `No market passed every active constraint. ${rejectedCount} market${rejectedCount === 1 ? " was" : "s were"} rejected; ask me why or revise the plan naturally.`;
    appendMessage("assistant", resultMessage, {
      meta: "Live Hyperliquid evidence · no execution",
    });
    rememberTurn("assistant", resultMessage);
    pendingInput = null;
  } catch (error) {
    if (!serviceResponded) {
      errorMessage.textContent = "We could not reach LiquidFlux. Check your connection and try again.";
    } else if (error instanceof TypeError) {
      console.error("LiquidFlux result rendering failed", error);
      errorMessage.textContent = "LiquidFlux responded, but the result could not be displayed. Try the analysis again.";
    } else {
      errorMessage.textContent = `${error.message} Adjust the constraints or try again.`;
    }
    showView("error");
    analysisStatus.textContent = "Analysis failed. Review the error and try again.";
  } finally {
    busy = false;
    syncControls();
    buttonLabel.textContent = "Review specialist plan";
  }
}

function overviewSummary(data) {
  return (data.markets || []).map((market) => {
    if (market.status !== "available") return `${market.symbol}: market data is unavailable.`;
    const facts = market.facts || {};
    const calculations = market.calculations || {};
    const parts = [];
    if (facts.funding) parts.push(`hourly funding is ${Number.isFinite(facts.funding.hourly_rate) ? `${facts.funding.hourly_rate * 100}%` : "unavailable"} (${formatPercent(calculations.funding?.annualized_simple_percent)} simple annualized snapshot, not a forecast)`);
    if (facts.basis) parts.push(`mark/oracle deviation is ${formatPercent(calculations.basis?.mark_oracle_deviation_percent)}, not executable spot/perp basis`);
    if (facts.liquidity) parts.push(`24-hour volume is ${formatCurrency(facts.liquidity.volume_24h_usd, true)} and impact spread is ${formatNumber(calculations.liquidity?.impact_spread_bps)} bps`);
    if (facts.risk) parts.push(`the venue leverage limit is ${formatNumber(facts.risk.max_leverage)}×, not a recommendation`);
    const history = market.research?.funding_history;
    if (history?.status === "available" || history?.status === "limited") parts.push(`over 72 hours, ${formatPercent((history.positive_share ?? NaN) * 100)} of observed funding settlements were positive, with ${history.sign_reversals ?? "unknown"} sign reversals and ${formatPercent(history.retrospective_simple_apr_pct)} retrospective simple APR`);
    const book = market.research?.order_book;
    if (book?.status === "available" || book?.status === "limited") parts.push(`the visible book spread is ${formatNumber(book.spread_bps)} bps, with ${formatCurrency(book.bid_visible_notional_within_10bps, true)} bid and ${formatCurrency(book.ask_visible_notional_within_10bps, true)} ask notional within 10 bps`);
    return `${market.symbol}: ${parts.join("; ")}.`;
  }).join("\n\n");
}

function renderOverview(data) {
  const evidence = data.evidence || {};
  overviewState.replaceChildren(sectionHeading("Market information", "Read-only snapshot · no strategy or execution"));
  overviewState.append(definitionList([
    ["Source", evidence.source || "Unavailable"],
    ["Fetched", formatDate(evidence.fetched_at)],
    ["Age at response", formatAge(evidence.age_ms)],
    ["Data status", sentence(evidence.data_status)],
    ["Cache", sentence(evidence.cache_status)],
  ]));
  overviewState.append(element("p", { text: "Snapshot values can change after retrieval. Annualized funding is a simple extrapolation, not a forecast or guaranteed return. Mark/oracle deviation is not a spot hedge basis. Missing facts are shown as —; market leverage limits are not recommendations." }));
  for (const market of data.markets || []) {
    const facts = market.facts || {};
    const calculations = market.calculations || {};
    const rows = [];
    if (facts.funding || calculations.funding) rows.push(
      ["Hourly funding rate (decimal)", Number.isFinite(facts.funding?.hourly_rate) ? String(facts.funding.hourly_rate) : "—"],
      ["Simple annualized funding (calculated)", formatPercent(calculations.funding?.annualized_simple_percent)],
    );
    if (facts.basis || calculations.basis) rows.push(
      ["Mark price", formatCurrency(facts.basis?.mark_price)],
      ["Oracle price", formatCurrency(facts.basis?.oracle_price)],
      ["Mark/oracle deviation (calculated)", formatPercent(calculations.basis?.mark_oracle_deviation_percent)],
    );
    if (facts.liquidity || calculations.liquidity) rows.push(
      ["Liquidity mark price", formatCurrency(facts.liquidity?.mark_price)],
      ["Open interest (base units)", formatNumber(facts.liquidity?.open_interest_base)],
      ["24-hour volume", formatCurrency(facts.liquidity?.volume_24h_usd)],
      ["Impact bid / ask", `${formatCurrency(facts.liquidity?.impact_bid_price)} / ${formatCurrency(facts.liquidity?.impact_ask_price)}`],
      ["Open interest notional (calculated)", formatCurrency(calculations.liquidity?.open_interest_notional_usd)],
      ["Impact spread (calculated, bps)", formatNumber(calculations.liquidity?.impact_spread_bps)],
    );
    if (facts.risk) rows.push(
      ["Market maximum leverage", formatNumber(facts.risk.max_leverage)],
      ["Delisted", typeof facts.risk.is_delisted === "boolean" ? (facts.risk.is_delisted ? "Yes" : "No") : "—"],
    );
    const history = market.research?.funding_history;
    if (history && history.status !== "not_requested") rows.push(
      ["72h funding coverage", Number.isFinite(history.coverage) ? formatPercent(history.coverage * 100) : "—"],
      ["Observed hourly settlements", history.observed_samples ?? "—"],
      ["Retrospective simple APR", formatPercent(history.retrospective_simple_apr_pct)],
      ["Positive settlement share", Number.isFinite(history.positive_share) ? formatPercent(history.positive_share * 100) : "—"],
      ["Funding sign reversals", history.sign_reversals ?? "—"],
    );
    const book = market.research?.order_book;
    if (book && book.status !== "not_requested") rows.push(
      ["Visible book spread", `${formatNumber(book.spread_bps)} bps`],
      ["Bid notional within 10 bps", formatCurrency(book.bid_visible_notional_within_10bps, true)],
      ["Ask notional within 10 bps", formatCurrency(book.ask_visible_notional_within_10bps, true)],
      ["Order-book age", formatAge(book.age_ms)],
    );
    overviewState.append(sectionHeading(market.symbol, `Status: ${sentence(market.status)}`), definitionList(rows));
    for (const notice of market.notices || []) overviewState.append(element("p", { text: sentence(notice) }));
  }
  for (const notice of data.notices || []) overviewState.append(element("p", { text: sentence(notice) }));
  overviewState.append(element("details", { className: "raw-evidence" }, [
    element("summary", { text: "Inspect source evidence and calculations" }),
    element("pre", { text: JSON.stringify(data, null, 2) }),
  ]));
  const details = element("details", { className: "supporting-details" }, [
    element("summary", { text: "Inspect market facts, calculations, and limitations" }),
    ...overviewState.children,
  ]);
  const analysis = data.analysis?.status === "completed" ? data.analysis : null;
  const findings = analysis ? element("ul", { className: "analysis-findings" }, analysis.findings.map((finding) =>
    element("li", {}, [element("span", { text: finding.text }), element("small", { text: finding.evidence_ids.join(" · ") })]))) : null;
  overviewState.replaceChildren(...[
    element("span", { className: "message-author", text: analysis ? `LiquidFlux · ${analysis.provider} analysis` : "LiquidFlux · deterministic market evidence" }),
    element("p", { className: "overview-answer", text: analysis?.answer || overviewSummary(data) }),
    findings,
    analysis?.caveats?.length ? element("p", { className: "analysis-caveats", text: `Limits: ${analysis.caveats.join(" · ")}` }) : null,
    element("p", { className: "message-meta", text: `${evidence.source || "Unknown source"} · fetched ${formatDate(evidence.fetched_at)} · ${sentence(evidence.data_status)} at retrieval` }),
    details,
  ].filter(Boolean));
  showView("overview");
  requestAnimationFrame(() => overviewState.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  }));
}

async function fetchOverview() {
  if (busy || !pendingInfo) return;
  const query = { symbols: [...pendingInfo.symbols], topics: [...pendingInfo.topics], question: pendingInfo.question };
  clearApprovals();
  busy = true;
  syncControls();
  setPlannerStatus(`Fetching read-only information for ${query.symbols.join(", ")}…`);
  const progress = appendMessage("assistant", "Fetching the confirmed market information…", { pending: true });
  try {
    const response = await fetch("/api/v1/market-overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || `Market information returned HTTP ${response.status}.`);
    renderOverview(data);
    latestAnalysis = data;
    const reply = `Market information fetched for ${query.symbols.join(", ")}: ${query.topics.join(", ")}. Source: ${data.evidence?.source || "unavailable"}; fetched ${formatDate(data.evidence?.fetched_at)}. No strategy or execution was included.`;
    rememberTurn("assistant", `${overviewSummary(data)} ${reply}`);
    setPlannerStatus("Ask me about these facts, compare another market, or explore a strategy.", "success");
  } catch (error) {
    // Retry only the still-visible exact query; any new message invalidates it.
    pendingInfo = query;
    infoConfirmation.hidden = false;
    appendMessage("assistant", `Market information could not be fetched: ${error.message}. You can retry the confirmed query.`, { meta: "Information error" });
    setPlannerStatus("Fetch failed. Retry for free or send a different request.", "error");
  } finally {
    progress.remove();
    busy = false;
    syncControls();
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Service unavailable");
    const health = await response.json();
    serviceStatus.textContent = health.status === "ok" ? "Service online" : "Service degraded";
    headerStatus.dataset.state = health.status === "ok" ? "online" : "offline";
  } catch {
    serviceStatus.textContent = "Service unavailable";
    headerStatus.dataset.state = "offline";
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generateAIPlan();
});
objectiveInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});
objectiveInput.addEventListener("input", () => {
  if (plannerStatus.dataset.state === "error") {
    setPlannerStatus("Ask a question or tell me what you’d like to research.");
  }
});
form.addEventListener("input", (event) => {
  if (busy) return;
  clearApprovals();
  suggestedDefaults = suggestedDefaults.filter((field) => field !== event.target.name);
  syncControls();
  if (!planState.hidden || !resultState.hidden) {
    showView("empty");
    analysisStatus.textContent = "Constraints changed. Review the updated specialist plan before running analysis.";
  }
  if (!latestAIPlan) return;
  aiDraftEdited = true;
  setPlannerStatus("AI-drafted constraints edited. Your current values will be used for review.", "success");
});
symbolsInput.addEventListener("blur", validateSymbols);
symbolsInput.addEventListener("input", () => {
  if (symbolsInput.getAttribute("aria-invalid") === "true") validateSymbols();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  reviewPlan();
});
reviewButton.addEventListener("click", reviewPlan);
approveButton.addEventListener("click", executeAnalysis);
reviseButton.addEventListener("click", () => {
  if (busy) return;
  clearApprovals();
  showView("empty");
  analysisStatus.textContent = "Specialist plan closed. Continue the conversation or edit the constraints.";
  objectiveInput.focus();
});
retryButton.addEventListener("click", executeAnalysis);

fetchOverviewButton.addEventListener("click", () => fetchOverview());
manualPlanButton.addEventListener("click", () => {
  if (busy || !collectInput()) return;
  clearApprovals();
  hasActivePlan = true;
  latestAIPlan = null;
  appendMessage("assistant", `Manual strategy activated for review. ${defaultsLabel()}`);
  syncControls();
  reviewPlan();
});

for (const starter of document.querySelectorAll("[data-prompt]")) {
  starter.addEventListener("click", () => {
    if (busy) return;
    objectiveInput.value = starter.dataset.prompt;
    objectiveInput.focus();
  });
}

showView("empty");
syncControls();
checkHealth();
