const thresholds = {
  conservative: { minScore: 0.75, maxSpreadBps: 25 },
  moderate: { minScore: 0.55, maxSpreadBps: 50 },
  aggressive: { minScore: 0.35, maxSpreadBps: 100 },
};

export const liquiditySpecialist = {
  id: "liquidity",
  name: "Liquidity Specialist",
  async analyze({ metrics, constraints }) {
    const policy = thresholds[constraints.riskTolerance];
    const markets = metrics.map((market) => {
      const missingEvidence = ["liquidityScore", "impactSpreadBps", "volume24hUsd", "openInterestNotionalUsd"]
        .filter((key) => !Number.isFinite(market[key]) || market[key] < 0
          || (key === "liquidityScore" && market[key] > 1) || market.missing_evidence?.includes(key));
      const notionalShareBps = !missingEvidence.includes("volume24hUsd") && market.volume24hUsd > 0
        ? (constraints.maxNotionalUsd / market.volume24hUsd) * 10_000
        : null;
      const reasons = missingEvidence.length > 0 ? ["missing_required_evidence"] : [];
      if (Number.isFinite(market.liquidityScore) && market.liquidityScore < policy.minScore) reasons.push("liquidity_score_below_policy");
      if (missingEvidence.includes("impactSpreadBps")) reasons.push("impact_spread_unavailable");
      else if (market.impactSpreadBps > policy.maxSpreadBps) reasons.push("impact_spread_above_policy");
      if (notionalShareBps === null || notionalShareBps > 1) reasons.push("requested_notional_large_vs_24h_volume");

      return {
        symbol: market.symbol,
        acceptable: reasons.length === 0,
        missing_evidence: missingEvidence,
        liquidity_score: missingEvidence.includes("liquidityScore") ? null : market.liquidityScore,
        impact_spread_bps: missingEvidence.includes("impactSpreadBps") ? null : market.impactSpreadBps,
        volume_24h_usd: missingEvidence.includes("volume24hUsd") ? null : market.volume24hUsd,
        open_interest_notional_usd: missingEvidence.includes("openInterestNotionalUsd") ? null : market.openInterestNotionalUsd,
        requested_notional_share_bps: notionalShareBps,
        reasons,
      };
    });

    return { specialist: this.id, status: "completed", policy, markets };
  },
};
