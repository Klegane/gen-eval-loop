import type { ContractData } from "../schemas/contract";
import type { ReportData } from "../schemas/report";
import { nowIso } from "../utils/timestamps";

export function buildReportSkeleton(
  contract: ContractData,
  timestamp: Date = new Date(),
): ReportData {
  const isoTimestamp = nowIso(timestamp);

  return {
    runId: contract.runId,
    artifact: "report",
    sprint: contract.sprint,
    status: "done_with_concerns",
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    whatIBuilt: contract.scope,
    selfCheck: contract.criteria.map((criterion) => ({
      label: criterion.label,
      passed: false,
      note: "Skeleton report: verification not yet executed.",
    })),
    changeLog: ["Skeleton report created for runtime flow testing."],
    knownConcerns: ["Implementation details still need to be supplied by the Generator role."],
    filesChanged: ["TBD"],
  };
}
