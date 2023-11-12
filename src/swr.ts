// List of all the SWR paths used in the application
export const ACTIVITY_LOG_KEY = (portfolioId: string) => `/activity-log?portfolioId=${portfolioId}`;
export const LIST_OF_FUNDS = () => `/list-of-funds`;
export const ACCOUNT_STATS = () => `/account-stats`;
export const PORTFOLIO = (portfolioId: string) => `/portfolio?portfolioId=${portfolioId}`;


// Extract the query params from the URL
// Usage: const { portfolioId } = params(ACTIVITY_LOG_KEY(''));
export function params(url: string): Record<string, string> {
    const urlObj = new URL(url, 'http://dummy.com');
    const params = new URLSearchParams(urlObj.search);
    const queryParams: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
        queryParams[key] = value;
    }

    return queryParams;
}