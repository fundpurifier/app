import { OverallStatus } from "./types";

export function toShariahStatus(rawStatus: OverallStatus) {
  switch (rawStatus) {
    case "HALAL":
      return "compliant";
    case "NOT HALAL":
      return "non_compliant";
    case "DOUBTFUL":
      return "doubtful";
    case "NOT COVERED":
    case "NOT_UNDER_COVERAGE":
      return "not_covered";
  }
}
