import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
class Node {
  constructor() { this.children = []; this.listeners = {}; this.dataset = {}; this.attrs = {}; this.value = ''; this.hidden = true; this.disabled = false; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  querySelector() { return new Node(); }
  querySelectorAll() { return Object.values(this.elements || {}); }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  remove() { this.removed = true; }
  focus() {}
  scrollTo() {}
  scrollIntoView() {}
  checkValidity() { return true; }
  reportValidity() {}
}
function setup() {
  const nodes = new Map();
  const get = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  get('#symbols').value = 'BTC, ETH, SOL';
  get('#analysis-form').elements = Object.fromEntries(Object.entries({ max_leverage: '2', max_notional_usd: '1000', min_funding_apr: '5', risk_tolerance: 'moderate' }).map(([key, value]) => [key, Object.assign(new Node(), { value, name: key })]));
  const calls = [];
  const responses = [];
  const context = vm.createContext({
    document: { querySelector: get, createElement: () => new Node() },
    window: { matchMedia: () => ({ matches: true }) },
    requestAnimationFrame: (fn) => fn(), console,
    fetch: async (url, options) => {
      if (url === '/health') return { ok: true, json: async () => ({ status: 'ok' }) };
      calls.push({ url, body: JSON.parse(options.body) });
      const response = responses.shift();
      if (typeof response === 'function') return response();
      return { ok: true, json: async () => response };
    },
  });
  vm.runInContext(source, context);
  const run = (code) => vm.runInContext(code, context);
  const send = async (message, response) => {
    if (response !== undefined) responses.push(response);
    get('#objective-message').value = message;
    await run('generateAIPlan()');
  };
  return { get, run, send, calls, responses };
}
const information = { intent: 'market_information', symbols: ['BTC'], topics: ['funding'], reply: 'Fetch BTC funding?', summary: 'BTC funding', assumptions: [], missing_information: [] };
const overview = { query: { symbols: ['BTC'], topics: ['funding'] }, evidence: { source: 'Hyperliquid', fetched_at: '2026-09-19T00:00:00Z', age_ms: 10, cache_status: 'miss', data_status: 'fresh' }, markets: [{ symbol: 'BTC', status: 'available', facts: { funding: { hourly_rate: 0.00001 } }, calculations: { funding: { annualized_simple_percent: 8.76 } }, notices: [] }], notices: [], execution_included: false };
const plan = { intent: 'plan_update', symbols: ['ETH'], risk_tolerance: 'moderate', max_leverage: 2, max_notional_usd: 1000, min_funding_apr: 5, suggested_defaults: ['max_leverage'], reply: 'Strategy drafted.', summary: 'ETH strategy', assumptions: [], missing_information: [], provider: 'gemini', model: 'test' };
const text = (node) => [node.textContent, ...node.children.map(text)].join(' ');

test('information confirms the exact query without AI and preserves evidence for short followups', async () => {
  const app = setup();
  assert.equal(app.get('#review-plan').disabled, true);
  await app.send('BTC', information);
  assert.equal(app.run('hasActivePlan'), false);
  assert.equal(app.get('#review-plan').disabled, true);
  app.run('reviewPlan()');
  assert.equal(app.run('pendingInput'), null);
  await app.send('yes', overview);
  assert.deepEqual(app.calls.map(c => c.url), ['/api/v1/plan', '/api/v1/market-overview']);
  assert.deepEqual(app.calls[1].body, { symbols: ['BTC'], topics: ['funding'] });
  assert.equal(app.get('#overview-state').hidden, false);
  assert.match(text(app.get('#overview-state')), /8.76%/);
  assert.match(text(app.get('#overview-state')), /0.00001/);
  assert.match(text(app.get('#overview-state')), /not a forecast/);
  assert.match(text(app.get('#overview-state')), /Hyperliquid/);
  await app.send('why', { intent: 'result_explanation', reply: 'Snapshot explanation.' });
  assert.deepEqual(app.calls[2].body.analysis_context, overview);
  assert.equal('current_plan' in app.calls[2].body, false);
  assert.equal(app.run('latestAIPlan'), null);
});

test('other messages clear stale information actions while retaining scope in history', async () => {
  const app = setup();
  await app.send('BTC', information);
  await app.send('risk', { intent: 'clarification', reply: 'Which risk fact?' });
  assert.equal(app.run('pendingInfo'), null);
  assert.equal(app.get('#info-confirmation').hidden, true);
  assert.match(app.calls[1].body.conversation[1].content, /symbols=\["BTC"\]; topics=\["funding"\]/);
  await app.run('fetchOverview()');
  assert.equal(app.calls.length, 2);
  await app.send('yes', { intent: 'clarification', reply: 'Please specify a market.' });
  assert.equal(app.calls[2].url, '/api/v1/plan');
});

test('only actual plan updates replace latestAIPlan; review and chat label defaults', async () => {
  const app = setup();
  await app.send('Create a strategy', plan);
  assert.match(text(app.get('#conversation-log')), /Suggested defaults.*Max leverage/);
  app.run('reviewPlan()');
  assert.match(app.get('#review-defaults').textContent, /Max leverage/);
  assert.notEqual(app.run('pendingInput'), null);
  await app.send('explain', { intent: 'result_explanation', reply: 'Explanation without strategy fields.' });
  assert.equal(app.run('latestAIPlan.summary'), 'ETH strategy');
  assert.equal(app.run('pendingInput'), null);
  await app.run('executeAnalysis()');
  assert.equal(app.calls.length, 2);
  app.run('reviewPlan()');
  app.get('#revise-plan').listeners.click();
  assert.equal(app.run('pendingInput'), null);
});

test('manual edits do not activate defaults; explicit manual use does and labels them', () => {
  const app = setup();
  app.get('#analysis-form').listeners.input({ target: { name: 'max_leverage' } });
  assert.equal(app.run('hasActivePlan'), false);
  assert.equal(app.get('#review-plan').disabled, true);
  app.get('#use-manual-plan').listeners.click();
  assert.equal(app.run('hasActivePlan'), true);
  assert.match(app.get('#review-defaults').textContent, /not user-supplied/);
  assert.doesNotMatch(app.get('#review-defaults').textContent, /Max leverage/);
});

test('shared busy guard blocks overlapping chat, info, analysis and manual changes', async () => {
  const app = setup();
  await app.send('BTC', information);
  let finish;
  app.responses.push(() => new Promise(resolve => { finish = resolve; }));
  const fetching = app.run('fetchOverview()');
  assert.equal(app.get('#objective-message').disabled, true);
  assert.equal(app.get('#analysis-form').elements.max_leverage.disabled, true);
  await app.send('new request');
  await app.run('fetchOverview()');
  await app.run('executeAnalysis()');
  app.get('#use-manual-plan').listeners.click();
  assert.equal(app.calls.length, 2);
  assert.equal(app.run('hasActivePlan'), false);
  finish({ ok: true, json: async () => overview });
  await fetching;
  assert.equal(app.get('#objective-message').disabled, false);
  assert.equal(app.get('#analysis-form').elements.max_leverage.disabled, false);
});

test('failed overview can retry exact query, and history is bounded', async () => {
  const app = setup();
  await app.send('BTC', information);
  app.responses.push(() => Promise.resolve({ ok: false, json: async () => ({ message: 'Unavailable' }) }));
  await app.run('fetchOverview()');
  assert.equal(app.get('#info-confirmation').hidden, false);
  assert.equal(app.get('#fetch-overview').disabled, false);
  app.responses.push(overview);
  await app.run('fetchOverview()');
  assert.deepEqual(app.calls[1].body, app.calls[2].body);
  app.run('for (let i = 0; i < 20; i++) rememberTurn("assistant", "x".repeat(2000))');
  assert.equal(app.run('conversationHistory.length'), 12);
  assert.equal(app.run('conversationHistory.every(turn => turn.content.length <= 1000)'), true);
});
