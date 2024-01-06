import { OverallStatus } from "./types";

export function toShariahStatus(rawStatus: OverallStatus) {
  switch (rawStatus) {
    case "COMPLIANT":
      return "compliant";
    case "NON_COMPLIANT":
      return "non_compliant";
    case "QUESTIONABLE":
      return "doubtful";
    case "UNRATED":
      return "not_covered";
  }
}
