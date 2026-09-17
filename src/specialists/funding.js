export const fundingSpecialist = {
  id: "funding",
  name: "Funding Specialist",
  async analyze({ metrics, constraints }) {
    const candidates = metrics.map((market) => {
      const apr = market.fundingAprPercent;
      const eligible = Math.abs(apr) >= constraints.minFundingApr;
      const strategyShape = apr >= 0 ? "short_perp_long_spot" : "long_perp_short_spot";

      return {
        symbol: market.symbol,
        eligible,
        funding_rate: market.fundingRate,
        funding_apr_percent: apr,
        strategy_shape: strategyShape,
        hedge_requirement: "External spot hedge availability and costs must be verified",
        evidence: eligible ? "funding_threshold_met" : "below_funding_threshold",
      };
    });

    return {
      specialist: this.id,
      status: "completed",
      candidates,
      limitations: [
        "Current funding is annualized as a snapshot, not forecast yield",
        "Spot borrow availability, spot fees, and cross-venue transfer costs are not included",
      ],
    };
  },
};
