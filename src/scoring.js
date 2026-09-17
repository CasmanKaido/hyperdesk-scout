const HOURS_PER_YEAR = 24 * 365;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const finite = (value) => Number.isFinite(value) ? value : 0;

export function calculateMetrics(market) {
  const fundingRate = finite(Number(market.funding));
  const markPrice = finite(Number(market.markPx));
  const oraclePrice = finite(Number(market.oraclePx));
  const openInterest = finite(Number(market.openInterest));
  const volume24hUsd = finite(Number(market.dayNtlVlm));
  const impactBid = Number(market.impactPxs?.[0]);
  const impactAsk = Number(market.impactPxs?.[1]);

  const fundingAprPercent = fundingRate * HOURS_PER_YEAR * 100;
  const basisPercent = oraclePrice > 0
    ? ((markPrice - oraclePrice) / oraclePrice) * 100
    : 0;
  const impactSpreadBps = impactBid > 0 && impactAsk > 0
    ? ((impactAsk - impactBid) / ((impactAsk + impactBid) / 2)) * 10_000
    : null;

  const volumeScore = clamp(Math.log10(Math.max(volume24hUsd, 1)) / 9);
  const oiNotional = openInterest * markPrice;
  const openInterestScore = clamp(Math.log10(Math.max(oiNotional, 1)) / 9);
  const spreadScore = impactSpreadBps === null ? 0.25 : clamp(1 - impactSpreadBps / 100);
  const liquidityScore = (volumeScore * 0.5) + (openInterestScore * 0.3) + (spreadScore * 0.2);

  const fundingScore = clamp(Math.abs(fundingAprPercent) / 100);
  const basisScore = clamp(Math.abs(basisPercent) / 2);
  const riskScore = clamp(
    (1 - liquidityScore) * 0.6
      + clamp(Math.abs(basisPercent) / 5) * 0.2
      + clamp(Math.abs(fundingAprPercent) / 500) * 0.2,
  );
  const opportunityScore = clamp(
    fundingScore * 0.5 + basisScore * 0.2 + liquidityScore * 0.3 - riskScore * 0.2,
  );

  const riskFlags = ["funding_can_reverse", "basis_not_guaranteed"];
  if (volume24hUsd < 1_000_000) riskFlags.push("low_24h_volume");
  if (impactSpreadBps === null) riskFlags.push("impact_prices_unavailable");
  else if (impactSpreadBps > 50) riskFlags.push("wide_impact_spread");
  if (Math.abs(basisPercent) > 1) riskFlags.push("elevated_basis");

  return {
    fundingRate,
    fundingAprPercent,
    markPrice,
    oraclePrice,
    basisPercent,
    openInterest,
    openInterestNotionalUsd: oiNotional,
    volume24hUsd,
    impactSpreadBps,
    liquidityScore,
    riskScore,
    opportunityScore,
    riskFlags,
  };
}
