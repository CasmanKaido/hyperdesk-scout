const form = document.querySelector("#analysis-form");
const reviewButton = document.querySelector("#review-plan");
const approveButton = document.querySelector("#approve-plan");
const reviseButton = document.querySelector("#revise-plan");
const retryButton = document.querySelector("#retry-analysis");
const buttonLabel = reviewButton.querySelector(".button-label");
const symbolsInput = document.querySelector("#symbols");
const symbolsError = document.querySelector("#symbols-error");
const formError = document.querySelector("#form-error");
const emptyState = document.querySelector("#empty-state");
const planState = document.querySelector("#plan-state");
const planObjective = document.querySelector("#plan-objective");
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

function reviewPlan() {
  const input = collectInput();
  if (!input) return;

  pendingInput = input;
  planObjective.textContent = `Objective: evaluate ${input.symbols.join(", ")} for market-neutral funding income under a ${input.risk_tolerance} risk policy, ${formatNumber(input.max_leverage)}× leverage cap, and ${formatCurrency(input.max_notional_usd)} notional limit.`;
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
  if (!pendingInput) return;

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
    renderResult(data);
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
    reviewButton.disabled = false;
    approveButton.disabled = false;
    buttonLabel.textContent = "Review specialist plan";
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

symbolsInput.addEventListener("blur", validateSymbols);
symbolsInput.addEventListener("input", () => {
  if (symbolsInput.getAttribute("aria-invalid") === "true") validateSymbols();
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  reviewPlan();
});
approveButton.addEventListener("click", executeAnalysis);
reviseButton.addEventListener("click", () => {
  showView("empty");
  analysisStatus.textContent = "Specialist plan closed. Update the constraints and review it again.";
  symbolsInput.focus();
});
retryButton.addEventListener("click", executeAnalysis);

showView("empty");
checkHealth();
