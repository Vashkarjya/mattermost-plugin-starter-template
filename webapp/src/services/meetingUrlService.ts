// Meeting URL Service - Handles getting meeting URLs and creating call posts

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
    error?: string;
}

/**
 * Gets personal meeting room URL from backend
 */
export async function getPersonalMeetingRoomUrl(): Promise<GetMeetingUrlResult> {
    // Return hardcoded test URL for testing
    return {
        success: true,
        meetingUrl: 'http://localhost:3000/v1/meeting/Nzk5NTY2NTk0Mjk2',
    };

    /* Original API call - commented out for testing
    try {
        const response = await fetch(
            `${window.location.origin}/plugins/com.daakia.calls/api/v1/meeting/personal-room-url?is_corporate_ac=0`,
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
            return {
                success: false,
                error: errorText || 'Failed to get meeting URL',
            };
        }

        const data = await response.json();

        if (data.success !== 1 || !data.data?.room_uid || !data.data?.frontend_url) {
            return {
                success: false,
                error: 'Invalid response from meeting URL API',
            };
        }

        // Decode room_uid from base64 and construct meeting URL
        const roomUid = atob(data.data.room_uid);
        const encodedRoomUid = btoa(roomUid);
        const meetingUrl = `${data.data.frontend_url}/v1/meeting/${encodedRoomUid}`;

        return {
            success: true,
            meetingUrl,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get meeting URL',
        };
    }
    */
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
