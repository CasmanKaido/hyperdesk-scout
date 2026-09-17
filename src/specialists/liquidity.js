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
      const notionalShareBps = market.volume24hUsd > 0
        ? (constraints.maxNotionalUsd / market.volume24hUsd) * 10_000
        : null;
      const reasons = [];
      if (market.liquidityScore < policy.minScore) reasons.push("liquidity_score_below_policy");
      if (market.impactSpreadBps === null) reasons.push("impact_spread_unavailable");
      else if (market.impactSpreadBps > policy.maxSpreadBps) reasons.push("impact_spread_above_policy");
      if (notionalShareBps === null || notionalShareBps > 1) reasons.push("requested_notional_large_vs_24h_volume");

      return {
        symbol: market.symbol,
        acceptable: reasons.length === 0,
        liquidity_score: market.liquidityScore,
        impact_spread_bps: market.impactSpreadBps,
        volume_24h_usd: market.volume24hUsd,
        open_interest_notional_usd: market.openInterestNotionalUsd,
        requested_notional_share_bps: notionalShareBps,
        reasons,
      };
    });

    return { specialist: this.id, status: "completed", policy, markets };
  },
};
