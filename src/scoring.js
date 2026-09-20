const HOURS_PER_YEAR = 24 * 365;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const finite = (value) => Number.isFinite(value) ? value : null;
const number = (value, valid = () => true) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && valid(parsed) ? parsed : null;
};

export function calculateMetrics(market) {
  const fundingRate = number(market.funding);
  const markPrice = number(market.markPx, (value) => value > 0);
  const oraclePrice = number(market.oraclePx, (value) => value > 0);
  const maxLeverage = number(market.maxLeverage, (value) => value >= 1);
  const openInterest = number(market.openInterest, (value) => value >= 0);
  const volume24hUsd = number(market.dayNtlVlm, (value) => value >= 0);
  const impactPrices = Array.isArray(market.impactPxs) ? market.impactPxs : [];
  const impactBid = number(impactPrices[0], (value) => value > 0);
  const impactAsk = number(impactPrices[1], (value) => value > 0);

  const fundingAprPercent = fundingRate === null ? null : finite(fundingRate * HOURS_PER_YEAR * 100);
  const basisPercent = markPrice !== null && oraclePrice !== null
    ? finite(((markPrice - oraclePrice) / oraclePrice) * 100)
    : null;
  const impactSpreadBps = impactBid !== null && impactAsk !== null && impactAsk >= impactBid
    ? finite(((impactAsk - impactBid) / (impactAsk / 2 + impactBid / 2)) * 10_000)
    : null;

  const volumeScore = volume24hUsd === null ? null : clamp(Math.log10(Math.max(volume24hUsd, 1)) / 9);
  const oiNotional = openInterest !== null && markPrice !== null ? finite(openInterest * markPrice) : null;
  const openInterestScore = oiNotional === null ? null : clamp(Math.log10(Math.max(oiNotional, 1)) / 9);
  const spreadScore = impactSpreadBps === null ? null : clamp(1 - impactSpreadBps / 100);
  const liquidityScore = [volumeScore, openInterestScore, spreadScore].includes(null)
    ? null : (volumeScore * 0.5) + (openInterestScore * 0.3) + (spreadScore * 0.2);

  const fundingScore = fundingAprPercent === null ? null : clamp(Math.abs(fundingAprPercent) / 100);
  const basisScore = basisPercent === null ? null : clamp(Math.abs(basisPercent) / 2);
  const riskScore = [liquidityScore, basisPercent, fundingAprPercent].includes(null) ? null : clamp(
    (1 - liquidityScore) * 0.6
      + clamp(Math.abs(basisPercent) / 5) * 0.2
      + clamp(Math.abs(fundingAprPercent) / 500) * 0.2,
  );
  const opportunityScore = [fundingScore, basisScore, liquidityScore, riskScore].includes(null) ? null : clamp(
    fundingScore * 0.5 + basisScore * 0.2 + liquidityScore * 0.3 - riskScore * 0.2,
  );

  const riskFlags = ["funding_can_reverse", "basis_not_guaranteed"];
  if (volume24hUsd !== null && volume24hUsd < 1_000_000) riskFlags.push("low_24h_volume");
  if (impactSpreadBps === null) riskFlags.push("impact_prices_unavailable");
  else if (impactSpreadBps > 50) riskFlags.push("wide_impact_spread");
  if (basisPercent !== null && Math.abs(basisPercent) > 1) riskFlags.push("elevated_basis");

  const metrics = {
    fundingRate,
    fundingAprPercent,
    markPrice,
    oraclePrice,
    maxLeverage,
    basisPercent,
    openInterest,
    openInterestNotionalUsd: oiNotional,
    volume24hUsd,
    impactSpreadBps,
    liquidityScore,
    riskScore,
    opportunityScore,
  };
  return {
    ...metrics,
    missing_evidence: Object.keys(metrics).filter((key) => metrics[key] === null),
    basis_description: "Mark-to-oracle divergence, not executable perp-to-spot basis",
    riskFlags,
  };
}
