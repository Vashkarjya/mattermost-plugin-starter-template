// Meeting URL Service - Handles getting meeting URLs and creating call posts
/*eslint-disable */
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

export interface GetMeetingUrlResult {
    success: boolean;
    meetingUrl?: string;
    token?: string;
    error?: string;
}

/** Business account from GET /api/v4/daakia/business-accounts (main Mattermost server, same as calendar). */
export interface BusinessAccount {
    id: number;
    user_id: number;
    status: string;
    corporate_status: string;
    organization_account_id?: number;
    is_admin: number;
    account: string;
}

export interface BusinessAccountResponse {
    success: number;
    data: BusinessAccount[];
    message?: string;
}

/** Params for getPersonalMeetingRoomUrl. is_corporate_ac is always 1; business_account_id from matched team. */
export interface GetPersonalMeetingRoomUrlParams {
    is_corporate_ac: '1';
    business_account_id: number;
}

// Toggle between test URL and API call
const USE_TEST_URL = true;

/** Token sent to Daakia in test mode (no real API call). */
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IjkyN2UzY2EzLTdlYTUtNDllYy04NGQyLTNlODgzZjhlZTdmOCIsInVzZXJEYXRhIjoiKzkxNzAwMjI0Mjc1OCIsImlhdCI6MTc2OTk3MzY2OCwiZXhwIjoxODAxNTMxMjY4fQ.Plj0QXdQ8t0eleUwnvS2PIF1zZTl_x-BRLT0R6Y9bVA';

const PLUGIN_API_BASE = `${window.location.origin}/plugins/com.daakia.calls-v2/api/v1`;

/**
 * Fetches business accounts from main Mattermost server (same API as calendar in daakia-mattermost-web).
 * GET /api/v4/daakia/business-accounts - used to match team name → business_account_id for personal-room-url.
 */
export async function getBusinessAccounts(): Promise<BusinessAccountResponse | null> {
    try {
        const url = `${window.location.origin}/api/v4/daakia/business-accounts`;
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Finds business_account_id by matching team name with account name (case-insensitive).
 * Falls back to "Personal Account" if present, else first account.
 */
export function matchBusinessAccountIdByTeamName(
    accounts: BusinessAccount[],
    teamName: string,
): number | null {
    if (!accounts?.length) {
        return null;
    }
    const normalized = teamName.trim().toLowerCase();
    const exact = accounts.find((a) => a.account?.trim().toLowerCase() === normalized);
    if (exact) {
        return exact.id;
    }
    const includes = accounts.find((a) => a.account?.trim().toLowerCase().includes(normalized) || normalized.includes(a.account?.trim().toLowerCase()));
    if (includes) {
        return includes.id;
    }
    const personal = accounts.find((a) => a.account?.trim().toLowerCase() === 'personal account');
    if (personal) {
        return personal.id;
    }
    return accounts[0].id;
}

export interface GetDaakiaTokenResult {
    success: boolean;
    token?: string;
    error?: string;
}

/**
 * Gets the current user's Daakia JWT from the plugin.
 * Used when starting a call, joining from a post, or picking up so the widget can pass it to the iframe.
 * In test mode (USE_TEST_URL), returns TEST_TOKEN without calling the API.
 */
export async function getDaakiaToken(): Promise<GetDaakiaTokenResult> {
    if (USE_TEST_URL) {
        return {success: true, token: TEST_TOKEN};
    }
    try {
        const response = await fetch(`${PLUGIN_API_BASE}/meeting/daakia-token`, {
            method: 'GET',
            credentials: 'include',
            headers: {'Content-Type': 'application/json'},
        });

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: errorText || 'Failed to get Daakia token',
            };
        }

        const data = await response.json();

        if (data.success !== 1 || !data.token) {
            return {
                success: false,
                error: data.message || 'Invalid response from Daakia token API',
            };
        }

        return {
            success: true,
            token: data.token,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get Daakia token',
        };
    }
}

/**
 * Gets personal meeting room URL from plugin backend.
 * Pass params with is_corporate_ac=1 and business_account_id when you have a valid id from getBusinessAccounts (main server).
 * When params is undefined, uses is_corporate_ac=0 and no business_account_id (fallback when no business account or empty).
 */
export async function getPersonalMeetingRoomUrl(params?: GetPersonalMeetingRoomUrlParams): Promise<GetMeetingUrlResult> {
    if (USE_TEST_URL) {
        return {
            success: true,
            meetingUrl: 'http://localhost:3000/v1/meeting/Nzk5NTY2NTk0Mjk2',
            // No token in test mode — not needed for local/dev testing
        };
    }

    const query = new URLSearchParams();
    if (params?.business_account_id != null && params.business_account_id > 0) {
        query.set('is_corporate_ac', params.is_corporate_ac);
        query.set('business_account_id', String(params.business_account_id));
    } else {
        query.set('is_corporate_ac', '0');
    }

    try {
        const response = await fetch(
            `${PLUGIN_API_BASE}/meeting/personal-room-url?${query.toString()}`,
            {
                method: 'GET',
                credentials: 'include',
                headers: {'Content-Type': 'application/json'},
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                error: errorText || 'Failed to get meeting URL',
            };
        }

        const data = await response.json();

        if (data.success !== 1 || !data.data?.room_uid || !data.data?.frontend_url) {
            return {
                success: false,
                error: data.message || 'Invalid response from meeting URL API',
            };
        }

        const roomUid = atob(data.data.room_uid);
        const encodedRoomUid = btoa(roomUid);
        const meetingUrl = `${data.data.frontend_url}/v1/meeting/${encodedRoomUid}`;

        return {
            success: true,
            meetingUrl,
            token: data.data.token,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get meeting URL',
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
            `${window.location.origin}/plugins/com.daakia.calls-v2/api/v1/meeting/create-post`,
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
            `${window.location.origin}/plugins/com.daakia.calls-v2/api/v1/calls/end`,
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
