import type {Store, Action} from 'redux';

import {getBusinessAccounts} from '../services/meetingUrlService';
import type {GlobalState, CallData, WebSocketEvent, WindowWithDaakia} from '../types';

// Call state management
let activeCall: CallData | null = null;
let ringingTimeout: NodeJS.Timeout | null = null;
const RING_LENGTH = 30000; // 30 seconds

// Helper function to normalize strings for comparison
function normalizeString(str: string | null | undefined): string {
    if (!str) {
        return '';
    }
    return str.trim().toLowerCase();
}

// Helper function to match business account (same logic as meetingUrlService)
function matchBusinessAccountWithTeam(
    businessAccounts: Array<{id: number; account: string}>,
    teamName: string,
): {isCorporateAC: number; businessAccountID: number | null} {
    const normalizedTeamName = normalizeString(teamName);

    if (!normalizedTeamName || businessAccounts.length === 0) {
        return {
            isCorporateAC: 0,
            businessAccountID: null,
        };
    }

    // Check for exact match first
    for (const account of businessAccounts) {
        const normalizedAccountName = normalizeString(account.account);
        if (normalizedAccountName === normalizedTeamName) {
            if (normalizedAccountName === 'personal account') {
                return {isCorporateAC: 0, businessAccountID: null};
            }
            return {isCorporateAC: 1, businessAccountID: account.id};
        }
    }

    // Check for partial match
    for (const account of businessAccounts) {
        const normalizedAccountName = normalizeString(account.account);
        if (
            normalizedTeamName.includes(normalizedAccountName) ||
            normalizedAccountName.includes(normalizedTeamName)
        ) {
            if (normalizedAccountName === 'personal account') {
                return {isCorporateAC: 0, businessAccountID: null};
            }
            return {isCorporateAC: 1, businessAccountID: account.id};
        }
    }

    return {isCorporateAC: 0, businessAccountID: null};
}

// Main call functions
export async function startCall(channelId: string, teamName?: string) {
    try {
        // Dispatch loading state
        window.dispatchEvent(new CustomEvent('daakia-call-loading', {
            detail: {channelId, loading: true},
        }));

        // Determine business account info (same logic as getPersonalMeetingRoomUrl)
        let isCorporateAC = 0;
        let businessAccountID: number | null = null;

        if (teamName) {
            const businessAccountsResponse = await getBusinessAccounts();
            if (businessAccountsResponse && businessAccountsResponse.success === 1) {
                const match = matchBusinessAccountWithTeam(
                    businessAccountsResponse.data,
                    teamName,
                );
                isCorporateAC = match.isCorporateAC;
                businessAccountID = match.businessAccountID;
            }
        }

        // Build headers with CSRF token
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        const cookies = document.cookie.split(';');
        let csrfToken = '';
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'MMCSRF') {
                csrfToken = decodeURIComponent(value);
                break;
            }
        }
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }

        // Get meeting URL from backend (but don't create post yet)
        const queryParams = new URLSearchParams();
        queryParams.append('is_corporate_ac', isCorporateAC.toString());
        if (businessAccountID !== null) {
            queryParams.append('business_account_id', businessAccountID.toString());
        }

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
            // eslint-disable-next-line no-console
            console.error('Failed to get meeting URL:', errorText);

            // Clear loading state
            window.dispatchEvent(new CustomEvent('daakia-call-loading', {
                detail: {channelId, loading: false},
            }));
            return;
        }

        const result = await response.json();

        // Validate response
        if (result.success !== 1 || !result.data?.room_uid || !result.data?.frontend_url) {
            // eslint-disable-next-line no-console
            console.error('Invalid response from meeting URL API:', result);

            // Clear loading state
            window.dispatchEvent(new CustomEvent('daakia-call-loading', {
                detail: {channelId, loading: false},
            }));
            return;
        }

        // Decode room_uid from base64
        const roomUid = atob(result.data.room_uid);
        const encodedRoomUid = btoa(roomUid);
        const meetingUrl = `${result.data.frontend_url}/v1/meeting/${encodedRoomUid}`;

        // Clear loading state
        window.dispatchEvent(new CustomEvent('daakia-call-loading', {
            detail: {channelId, loading: false},
        }));

        // Open widget with meeting URL and channel info
        // Post will be created when VIDEO_CONFERENCE page is reached
        window.dispatchEvent(new CustomEvent('daakia-widget-open', {
            detail: {
                meetingUrl,
                channelId, // For creating post when VIDEO_CONFERENCE is reached
                roomUid: encodedRoomUid, // For creating post
            },
        }));
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error starting call:', error);

        // Clear loading state on error
        window.dispatchEvent(new CustomEvent('daakia-call-loading', {
            detail: {channelId, loading: false},
        }));
    }
}

export function handleCallStarted(event: WebSocketEvent, store: Store<GlobalState, Action>) {
    const currentUserId = store.getState().entities.users.currentUserId;
    const callData = event.data as CallData;

    // Notify channel header button that call started
    window.dispatchEvent(new CustomEvent('daakia-call-started', {
        detail: {
            channel_id: callData.channel_id,
            call_id: callData.call_id,
        },
    }));

    // Don't show ringing UI for the caller
    if (callData.caller_id === currentUserId) {
        return;
    }

    // Show ringing UI via window object (React component will read this)
    activeCall = callData;
    (window as WindowWithDaakia).daakiaIncomingCall = {
        callId: callData.call_id,
        channelId: callData.channel_id,
        callerName: callData.caller_name,
        callerAvatarUrl: callData.caller_avatar_url,
        meetingUrl: callData.meeting_url,
        timestamp: callData.timestamp,
    };

    // Play ring sound
    playRingSound();

    // Trigger a custom event to force React to re-render
    window.dispatchEvent(new Event('daakia-incoming-call'));

    // Auto-dismiss after 30 seconds
    ringingTimeout = setTimeout(() => {
        clearIncomingCall();
    }, RING_LENGTH);
}

export function handleCallEnded(event: WebSocketEvent) {
    const eventData = event.data as {call_id: string; channel_id?: string};
    const callId = eventData.call_id;

    // Notify channel header button that call ended
    if (eventData.channel_id) {
        window.dispatchEvent(new CustomEvent('daakia-call-ended', {
            detail: {
                channel_id: eventData.channel_id,
                call_id: callId,
            },
        }));
    }

    if (activeCall && activeCall.call_id === callId) {
        clearIncomingCall();
    }
}

export function clearIncomingCall() {
    activeCall = null;
    (window as WindowWithDaakia).daakiaIncomingCall = null;
    stopRingSound();
    if (ringingTimeout) {
        clearTimeout(ringingTimeout);
        ringingTimeout = null;
    }

    // Trigger event to update UI
    window.dispatchEvent(new Event('daakia-call-cleared'));
}

// Ring tone management using Mattermost's notificationSounds API (like official Calls plugin)
let currentRingTone: string = 'Calm'; // Default to Calm like Mattermost Calls

export function playRingSound() {
    // Use Mattermost's built-in notificationSounds API (like official Calls plugin)
    const webappUtils = (window as any).WebappUtils;
    if (webappUtils?.notificationSounds?.ring) {
        try {
            webappUtils.notificationSounds.ring(currentRingTone);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to play ring sound via Mattermost API:', error);
        }
    } else {
        // eslint-disable-next-line no-console
        console.debug('Mattermost notificationSounds API not available, ring sound disabled');
    }
}

export function stopRingSound() {
    // Use Mattermost's built-in notificationSounds API (like official Calls plugin)
    const webappUtils = (window as any).WebappUtils;
    if (webappUtils?.notificationSounds?.stopRing) {
        try {
            webappUtils.notificationSounds.stopRing();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to stop ring sound via Mattermost API:', error);
        }
    }
}

// Set ring tone (for future multiple ring tone support)
export function setRingTone(tone: string) {
    // Validate against available Mattermost ring tones
    const availableTones = ['Dynamic', 'Calm', 'Urgent', 'Cheerful'];
    if (availableTones.includes(tone)) {
        currentRingTone = tone;
    } else {
        // eslint-disable-next-line no-console
        console.debug(`Invalid ring tone: ${tone}. Using default 'Calm'`);
        currentRingTone = 'Calm';
    }
}

// Get available ring tones (matching Mattermost Calls)
export function getAvailableRingTones() {
    return ['Dynamic', 'Calm', 'Urgent', 'Cheerful'];
}

// Expose functions to window for components to use
(window as WindowWithDaakia).daakiaStopRinging = stopRingSound;
