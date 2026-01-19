// Meeting URL Service - Handles getting meeting URLs and creating call posts
// Similar to daakia-mattermost-web implementation

// Get CSRF token from cookie
function getCSRFFromCookie(): string {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'MMCSRF') {
            return decodeURIComponent(value);
        }
    }
    return '';
}

// Business Account interface matching Mattermost API response
export interface BusinessAccount {
    id: number;
    user_id: number;
    status: string;
    corporate_status: string;
    organization_account_id: number;
    is_admin: number;
    account: string;
}

export interface BusinessAccountsResponse {
    success: number;
    data: BusinessAccount[];
}

export interface GetMeetingUrlParams {
    isCorporateAC?: number;
    businessAccountID?: number;
    teamName?: string; // Team name to match with business account
}

export interface GetMeetingUrlResult {
    success: boolean;
    meetingUrl?: string;
    roomUid?: string;
    error?: string;
}

/**
 * Fetches business accounts from Mattermost API
 * This is called from frontend only - backend does NOT call this API
 */
export async function getBusinessAccounts(): Promise<BusinessAccountsResponse | null> {
    try {
        const response = await fetch(
            `${window.location.origin}/api/v4/daakia/business-accounts`,
            {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        );

        if (!response.ok) {
            // eslint-disable-next-line no-console
            console.error('Failed to get business accounts:', response.statusText);
            return null;
        }

        const data = await response.json();
        return data as BusinessAccountsResponse;
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching business accounts:', error);
        return null;
    }
}

/**
 * Normalize strings for comparison (matching reference implementation)
 */
function normalizeString(str: string | null | undefined): string {
    if (!str) {
        return '';
    }
    return str.trim().toLowerCase();
}

/**
 * Matches business account with team name and returns is_corporate_ac and business_account_id
 * All matching logic is handled in frontend - backend only receives the final values
 * Uses same pattern as reference implementation with exact and partial matching
 */
function matchBusinessAccountWithTeam(
    businessAccounts: BusinessAccount[],
    teamName: string,
): {isCorporateAC: number; businessAccountID: number | null} {
    const normalizedTeamName = normalizeString(teamName);

    if (!normalizedTeamName || businessAccounts.length === 0) {
        return {
            isCorporateAC: 0,
            businessAccountID: null,
        };
    }

    // Preprocess: Create hash map for O(1) exact match lookup
    const accountMap = new Map<string, BusinessAccount>();
    const normalizedAccountNames: Array<{name: string; account: BusinessAccount}> = [];

    for (const account of businessAccounts) {
        const normalizedAccountName = normalizeString(account.account);
        if (normalizedAccountName) {
            accountMap.set(normalizedAccountName, account);
            normalizedAccountNames.push({name: normalizedAccountName, account});
        }
    }

    // Strategy 1: Exact match - O(1) lookup using hash map
    const exactMatch = accountMap.get(normalizedTeamName);
    if (exactMatch) {
        // If account name is "Personal Account", it's not corporate
        if (normalizeString(exactMatch.account) === 'personal account') {
            return {
                isCorporateAC: 0,
                businessAccountID: null,
            };
        }

        // Otherwise, it's a corporate account - use id (matching reference implementation)
        return {
            isCorporateAC: 1,
            businessAccountID: exactMatch.id,
        };
    }

    // Strategy 2: Partial match - optimized iteration
    for (const {name: normalizedAccountName, account} of normalizedAccountNames) {
        if (!normalizedAccountName || !normalizedTeamName) {
            continue;
        }

        // Check if either string contains the other (bidirectional partial match)
        if (
            normalizedTeamName.includes(normalizedAccountName) ||
            normalizedAccountName.includes(normalizedTeamName)
        ) {
            // If account name is "Personal Account", it's not corporate
            if (normalizeString(account.account) === 'personal account') {
                return {
                    isCorporateAC: 0,
                    businessAccountID: null,
                };
            }

            // Otherwise, it's a corporate account - use id
            return {
                isCorporateAC: 1,
                businessAccountID: account.id,
            };
        }
    }

    // No match found, default to personal account
    return {
        isCorporateAC: 0,
        businessAccountID: null,
    };
}

/**
 * Fetches personal meeting room URL from backend
 * Frontend handles all business account matching logic and passes is_corporate_ac and business_account_id to backend
 */
export async function getPersonalMeetingRoomUrl(
    params: GetMeetingUrlParams = {},
): Promise<GetMeetingUrlResult> {
    try {
        let isCorporateAC = params.isCorporateAC;
        let businessAccountID = params.businessAccountID;

        // Step 1: Always fetch business accounts from Mattermost API (matching reference implementation)
        const businessAccountsResponse = await getBusinessAccounts();

        // Step 2: Match team name with business account (if teamName provided)
        if (businessAccountsResponse && businessAccountsResponse.success === 1 && params.teamName) {
            // Frontend handles all matching logic
            const match = matchBusinessAccountWithTeam(
                businessAccountsResponse.data,
                params.teamName,
            );
            isCorporateAC = match.isCorporateAC;
            if (match.businessAccountID === null) {
                businessAccountID = undefined;
            } else {
                businessAccountID = match.businessAccountID;
            }
        } else {
            // If business accounts API fails or no teamName, default to personal account
            isCorporateAC = 0;
            businessAccountID = undefined;
        }

        // Default to 0 (personal account) if still undefined
        if (isCorporateAC === undefined) {
            isCorporateAC = 0;
        }

        // Pass is_corporate_ac and business_account_id to backend
        // Backend will use these to call Daakia backend API
        const queryParams = new URLSearchParams();
        queryParams.append('is_corporate_ac', isCorporateAC.toString());
        if (businessAccountID !== undefined && businessAccountID !== null) {
            queryParams.append('business_account_id', businessAccountID.toString());
        }

        // Call plugin backend endpoint with the determined params
        const response = await fetch(
            `${window.location.origin}/plugins/com.daakia.calls/api/v1/meeting/personal-room-url?${queryParams.toString()}`,
            {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to get personal meeting room URL';

            try {
                const errorData = JSON.parse(errorText);
                if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.detailed_error) {
                    errorMessage = errorData.detailed_error;
                }
            } catch {
                if (errorText) {
                    errorMessage = errorText;
                }
            }

            return {
                success: false,
                error: errorMessage,
            };
        }

        const data = await response.json();

        // Validate that room_uid exists - return error if missing (no hardcoded fallback)
        if (data.success !== 1 || !data.data?.room_uid || data.data.room_uid === '') {
            const errorMessage = data.message ? data.message : 'Failed to get personal meeting room URL: room_uid not returned from API';
            return {
                success: false,
                error: errorMessage,
            };
        }

        // Decode room_uid from base64
        const roomUid = atob(data.data.room_uid);

        // Validate decoded room_uid is not empty
        if (roomUid === '') {
            return {
                success: false,
                error: 'Invalid room_uid received from API',
            };
        }

        // Get Daakia frontend URL from backend response (from plugin configuration)
        // If not provided, return error instead of using fallback
        if (!data.data.frontend_url || data.data.frontend_url === '') {
            return {
                success: false,
                error: 'Daakia frontend URL not configured',
            };
        }

        const daakiaFrontendURL = data.data.frontend_url;

        // Construct meeting URL using Daakia frontend URL as base
        const encodedRoomUid = btoa(roomUid);
        const meetingUrl = `${daakiaFrontendURL}/v1/meeting/${encodedRoomUid}`;

        return {
            success: true,
            meetingUrl,
            roomUid,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch personal meeting room URL';

        return {
            success: false,
            error: errorMessage,
        };
    }
}

export interface CreateCallPostParams {
    channelId: string;
    meetingUrl: string;
    roomUid?: string;
}

export interface CreateCallPostResult {
    success: boolean;
    postId?: string;
    error?: string;
}

/**
 * Creates a call post in the channel when a call is started
 */
export async function createCallPost(
    params: CreateCallPostParams,
): Promise<CreateCallPostResult> {
    try {
        // Build headers with CSRF token (required for POST requests)
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Get CSRF token from cookie
        const csrfToken = getCSRFFromCookie();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(
            `${window.location.origin}/plugins/com.daakia.calls/api/v1/meeting/create-post`,
            {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({
                    channel_id: params.channelId,
                    meeting_url: params.meetingUrl,
                    room_uid: params.roomUid ? params.roomUid : '',
                }),
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to create call post';

            try {
                const errorData = JSON.parse(errorText);
                if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.detailed_error) {
                    errorMessage = errorData.detailed_error;
                }
            } catch {
                if (errorText) {
                    errorMessage = errorText;
                }
            }

            return {
                success: false,
                error: errorMessage,
            };
        }

        const post = await response.json();

        return {
            success: true,
            postId: post.id,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create call post';

        return {
            success: false,
            error: errorMessage,
        };
    }
}

export interface EndCallParams {
    callId: string;
    channelId: string;
}

export interface EndCallResult {
    success: boolean;
    error?: string;
}

/**
 * Ends a call and notifies others to stop ringing
 * Uses /calls/end endpoint (same as calls API)
 */
export async function endCall(
    params: EndCallParams,
): Promise<EndCallResult> {
    try {
        // Build headers with CSRF token (required for POST requests)
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Get CSRF token from cookie
        const csrfToken = getCSRFFromCookie();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        const response = await fetch(
            `${window.location.origin}/plugins/com.daakia.calls/api/v1/calls/end`,
            {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({
                    call_id: params.callId,
                    channel_id: params.channelId,
                }),
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to end call';

            try {
                const errorData = JSON.parse(errorText);
                if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.detailed_error) {
                    errorMessage = errorData.detailed_error;
                }
            } catch {
                if (errorText) {
                    errorMessage = errorText;
                }
            }

            return {
                success: false,
                error: errorMessage,
            };
        }

        return {
            success: true,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to end call';

        return {
            success: false,
            error: errorMessage,
        };
    }
}
