import { ListedAsset } from "@prisma/client";
import { FilterSettings } from "@/services/fund/map";
import { toShariahStatus } from "@/lib/musaffa/mappers";

export function isCompliant(listedAsset: ListedAsset, filters: FilterSettings) {
  /**
   * Returns whether a listedAsset is compliant with the user's filters.
   */
  if (!listedAsset.isActive) return false;

  // 1. Allow whitelisted stocks
  const whitelistMatch = filters.whitelist.find((e) => e.id == listedAsset.id);
  if (whitelistMatch) return true;

  // 2. Disallow blacklisted stocks
  const blacklistMatch = filters.blacklist.find((e) => e.id == listedAsset.id);
  if (blacklistMatch) return false;

  // 3. Filter non-compliant stocks ('non-compliant', allowUnrated, allowDoubtful)
  const allowed = ["compliant"];
  if (filters.allowUnrated) allowed.push("unrated");
  if (filters.allowDoubtful) allowed.push("doubtful");

  return allowed.includes(listedAsset.shariahStatus);
}

export function wasPreviouslyNonCompliant(
  previous: string | null,
  filters: FilterSettings
) {
  /**
   * If an asset was 'compliant' and then became 'non-compliant', we want to
   * know if it's still 'non-compliant' in the current report. If it is, we'd
   * need to liquidate it for folks with the 'wait' setting for liquidation.
   */

  function shariah(jsonStr: string) {
    const status = JSON.parse(jsonStr).shariahComplianceStatus;
    return status ? toShariahStatus(status) : "not_covered";
  }

  // No previous screen, continue to wait..
  if (!previous) return false;

  // Check previous status
  const allowed = ["compliant"];
  if (filters.allowUnrated) allowed.push("unrated");
  if (filters.allowDoubtful) allowed.push("doubtful");

  return !allowed.includes(shariah(previous));
}