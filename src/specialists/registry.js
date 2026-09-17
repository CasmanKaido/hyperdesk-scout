import { fundingSpecialist } from "./funding.js";
import { liquiditySpecialist } from "./liquidity.js";
import { riskSpecialist } from "./risk.js";

const specialists = new Map([
  [fundingSpecialist.id, fundingSpecialist],
  [liquiditySpecialist.id, liquiditySpecialist],
  [riskSpecialist.id, riskSpecialist],
]);

export function getSpecialist(id) {
  const specialist = specialists.get(id);
  if (!specialist) throw new Error(`Unknown specialist: ${id}`);
  return specialist;
}

export function listSpecialists() {
  return [...specialists.values()].map(({ id, name }) => ({ id, name }));
}
