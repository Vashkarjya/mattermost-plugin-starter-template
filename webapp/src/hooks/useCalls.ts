import type {Store, Action} from 'redux';

import {createCallPost, endCall, getPersonalMeetingRoomUrl} from '../services/meetingUrlService';
import type {GlobalState, CallData, WebSocketEvent, WindowWithDaakia} from '../types';

// Call state management
let activeCall: CallData | null = null;
let ringingTimeout: NodeJS.Timeout | null = null;
const RING_LENGTH = 30000; // 30 seconds

// Main call functions
export async function startCall(channelId: string) {
    try {
        // Dispatch loading state
        window.dispatchEvent(new CustomEvent('daakia-call-loading', {
            detail: {channelId, loading: true},
        }));

        // Get meeting URL from backend
        const meetingResult = await getPersonalMeetingRoomUrl();

        if (!meetingResult.success || !meetingResult.meetingUrl) {
            // eslint-disable-next-line no-console
            console.error('Failed to get meeting URL:', meetingResult.error);

            // Clear loading state
            window.dispatchEvent(new CustomEvent('daakia-call-loading', {
                detail: {channelId, loading: false},
            }));
            return;
        }

        // Create call post with real meeting URL
        const result = await createCallPost({
            channelId,
            meetingUrl: meetingResult.meetingUrl,
        });

        // Clear loading state
        window.dispatchEvent(new CustomEvent('daakia-call-loading', {
            detail: {channelId, loading: false},
        }));

        if (result.success) {
            // Show widget with meeting info and token
            window.dispatchEvent(new CustomEvent('daakia-widget-open', {
                detail: {
                    meetingUrl: meetingResult.meetingUrl,
                    token: meetingResult.token,
                },
            }));
        } else {
            // eslint-disable-next-line no-console
            console.error('Failed to start call:', result.error);
        }
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
