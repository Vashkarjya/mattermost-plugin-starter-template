import type {Store, Action} from 'redux';

import type {GlobalState, CallData, WebSocketEvent, WindowWithDaakia} from '../types';

// Call state management
let activeCall: CallData | null = null;
let ringingTimeout: NodeJS.Timeout | null = null;
const RING_LENGTH = 30000; // 30 seconds

// Utility functions
function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
    }
    return null;
}

// Main call functions
export function startCall(channelId: string) {
    const csrfToken = getCookie('MMCSRF');

    fetch('/plugins/com.daakia.calls/api/v1/calls/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken || '',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({channel_id: channelId}),
        credentials: 'include',
    }).then((response) => {
        if (!response.ok) {
            // eslint-disable-next-line no-console
            console.error('Failed to start call');
        }
        return response.json();
    }).then((data) => {
        // Call started successfully
        return data;
    }).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Error starting call:', error);
    });
}

export function handleCallStarted(event: WebSocketEvent, store: Store<GlobalState, Action>) {
    const currentUserId = store.getState().entities.users.currentUserId;
    const callData = event.data as CallData;

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
    const callId = (event.data as {call_id: string}).call_id;

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
