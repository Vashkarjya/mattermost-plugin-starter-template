import type {Store, Action} from 'redux';

import {USE_IFRAME_MODE} from '../constants';
import {
    createCallPost,
    endCall,
    getBusinessAccounts,
    getDaakiaToken,
    getPersonalMeetingRoomUrl,
    matchBusinessAccountIdByTeamName,
} from '../services/meetingUrlService';
import type {GlobalState, CallData, WebSocketEvent, WindowWithDaakia} from '../types';

// Call state management
let activeCall: CallData | null = null;
let ringingTimeout: NodeJS.Timeout | null = null;
const RING_LENGTH = 30000; // 30 seconds

/**
 * Start-call API order (fail-fast: if one fails, we stop and don't call the next).
 *
 * API 1 — GET /api/v4/daakia/business-accounts (main Mattermost server)
 *   → Optional: if it fails or empty, we still call API 2 with is_corporate_ac=0.
 *
 * API 2 — GET /plugins/.../api/v1/meeting/personal-room-url (plugin)
 *   → Required. If it fails → stop, clear loading, return (don't call API 3).
 *
 * API 3 — GET /plugins/.../api/v1/meeting/daakia-token (plugin)
 *   → Token for widget/iframe; we use this API only (no token from API 2).
 *
 * API 4 — POST /plugins/.../api/v1/meeting/create-post (plugin)
 *   → Required. If it fails → stop, clear loading, return (don't open widget).
 *
 * Then: dispatch daakia-widget-open with meetingUrl + token (from API 3 only).
 */
function clearCallLoading(channelId: string): void {
    window.dispatchEvent(new CustomEvent('daakia-call-loading', {
        detail: {channelId, loading: false},
    }));
}

export async function startCall(channelId: string, teamName?: string) {
    try {
        window.dispatchEvent(new CustomEvent('daakia-call-loading', {
            detail: {channelId, loading: true},
        }));

        // ——— API 1: business accounts (optional; fallback to is_corporate_ac=0 if fail/empty) ———
        let businessAccountId: number | undefined;
        const accountsResponse = await getBusinessAccounts();
        if (accountsResponse?.success === 1 && accountsResponse.data?.length) {
            if (teamName) {
                const matchedId = matchBusinessAccountIdByTeamName(accountsResponse.data, teamName);
                businessAccountId = matchedId ?? accountsResponse.data[0].id;
            } else {
                businessAccountId = accountsResponse.data[0].id;
            }
        }

        const personalRoomParams = (businessAccountId != null && businessAccountId > 0) ? {is_corporate_ac: '1' as const, business_account_id: businessAccountId} : undefined;

        // ——— API 2: personal room URL (required; fail-fast if this fails) ———
        const meetingResult = await getPersonalMeetingRoomUrl(personalRoomParams);
        if (!meetingResult.success || !meetingResult.meetingUrl) {
            // eslint-disable-next-line no-console
            console.error('Failed to get meeting URL:', meetingResult.error);
            clearCallLoading(channelId);
            return;
        }

        // ——— API 3: Daakia JWT token (for widget/iframe; from this API only) ———
        const tokenResult = await getDaakiaToken();
        const token = tokenResult.success ? tokenResult.token : undefined;

        // ——— API 4: create call post (required; fail-fast if this fails) ———
        const result = await createCallPost({
            channelId,
            meetingUrl: meetingResult.meetingUrl,
        });

        clearCallLoading(channelId);

        if (!result.success) {
            // eslint-disable-next-line no-console
            console.error('Failed to start call:', result.error);
            return;
        }

        const meetingUrl = meetingResult.meetingUrl;
        const meetingWindow = USE_IFRAME_MODE ? undefined : window.open(meetingUrl, '_blank');
        window.dispatchEvent(new CustomEvent('daakia-widget-open', {
            detail: {
                meetingUrl,
                token,
                meetingWindow: meetingWindow ?? null,
            },
        }));
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error starting call:', error);
        clearCallLoading(channelId);
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

// End call function
export async function endActiveCall(callId: string, channelId: string) {
    try {
        const result = await endCall({callId, channelId});
        if (!result.success) {
            // eslint-disable-next-line no-console
            console.error('Failed to end call:', result.error);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error ending call:', error);
    }
}

// Ring tone management using Mattermost's notificationSounds API
const currentRingTone: string = 'Calm'; // Default to Calm like Mattermost Calls

export function playRingSound() {
    // Use Mattermost's built-in notificationSounds API
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
    // Use Mattermost's built-in notificationSounds API
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

// Expose functions to window for components to use
(window as WindowWithDaakia).daakiaStopRinging = stopRingSound;
