const policies = {
  conservative: { maxRiskScore: 0.4, maxAbsBasisPercent: 0.75 },
  moderate: { maxRiskScore: 0.65, maxAbsBasisPercent: 1.5 },
  aggressive: { maxRiskScore: 0.85, maxAbsBasisPercent: 3 },
};

export const riskSpecialist = {
  id: "risk",
  name: "Risk Policy Specialist",
  async analyze({ metrics, constraints, funding, liquidity, dataStatus }) {
    const policy = policies[constraints.riskTolerance];
    const fundingBySymbol = new Map(funding.candidates.map((item) => [item.symbol, item]));
    const liquidityBySymbol = new Map(liquidity.markets.map((item) => [item.symbol, item]));

    const decisions = metrics.map((market) => {
      const fundingResult = fundingBySymbol.get(market.symbol);
      const liquidityResult = liquidityBySymbol.get(market.symbol);
      const blockers = [];
      const cautions = [];

      if (dataStatus !== "fresh") blockers.push("market_data_not_fresh");
      if (!fundingResult?.eligible) blockers.push("funding_threshold_not_met");
      if (!liquidityResult?.acceptable) blockers.push("liquidity_policy_failed");
      if (constraints.maxLeverage > market.maxLeverage) blockers.push("leverage_exceeds_market_limit");
      if (market.riskScore > policy.maxRiskScore) blockers.push("risk_score_above_policy");
      if (Math.abs(market.basisPercent) > policy.maxAbsBasisPercent) blockers.push("basis_above_policy");
      if (constraints.maxLeverage > 2) cautions.push("leverage_above_conservative_service_default");
      if (Math.abs(market.fundingAprPercent) > 100) cautions.push("extreme_funding_may_reverse");

      const decision = blockers.length > 0 ? "reject" : cautions.length > 0 ? "caution" : "approve";
      return {
        symbol: market.symbol,
        decision,
        blockers,
        cautions,
        risk_score: market.riskScore,
        basis_percent: market.basisPercent,
        service_leverage_cap: constraints.maxLeverage,
        market_max_leverage: market.maxLeverage,
      };
    });

    return { specialist: this.id, status: "completed", policy, decisions };
  },
};
