export const fundingSpecialist = {
  id: "funding",
  name: "Funding Specialist",
  async analyze({ metrics, constraints }) {
    const candidates = metrics.map((market) => {
      const missingEvidence = ["fundingRate", "fundingAprPercent"]
        .filter((key) => !Number.isFinite(market[key]) || market.missing_evidence?.includes(key));
      const apr = Number.isFinite(market.fundingAprPercent) ? market.fundingAprPercent : null;
      const eligible = missingEvidence.length === 0 && Math.abs(apr) >= constraints.minFundingApr;
      const strategyShape = missingEvidence.length > 0 ? null
        : apr >= 0 ? "short_perp_long_spot" : "long_perp_short_spot";

      return {
        symbol: market.symbol,
        eligible,
        funding_rate: Number.isFinite(market.fundingRate) ? market.fundingRate : null,
        funding_apr_percent: apr,
        strategy_shape: strategyShape,
        strategy_status: "hypothetical_unverified_hedge",
        missing_evidence: missingEvidence,
        hedge_requirement: "External spot hedge availability and costs must be verified",
        evidence: missingEvidence.length > 0 ? "missing_required_evidence"
          : eligible ? "funding_threshold_met" : "below_funding_threshold",
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
