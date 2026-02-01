/**
 * Daakia postMessage integration: widget ↔ meeting tab.
 * Order: all SENDING first, then all RECEIVING.
 */

import {ALLOWED_POSTMESSAGE_ORIGINS, POSTMESSAGE_SOURCE_CALL_WIDGET} from '../../../constants';

// =============================================================================
// SENDING (Widget → Daakia meeting tab)
// =============================================================================

/** Get allowed origin from meeting URL, or null if invalid/not allowed. */
export function getMeetingOrigin(meetingUrl: string): string | null {
    try {
        const origin = new URL(meetingUrl).origin;
        return ALLOWED_POSTMESSAGE_ORIGINS.has(origin) ? origin : null;
    } catch {
        return null;
    }
}

/** Send TOGGLE_MIC to Daakia. Only call when meetingWindow is open and origin is valid. */
export function sendToggleMic(
    meetingWindow: Window,
    meetingOrigin: string,
    isOn: boolean,
): void {
    meetingWindow.postMessage(
        {
            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
            type: 'TOGGLE_MIC',
            isOn,
            timestamp: Date.now(),
        },
        meetingOrigin,
    );
}

/** Send TOGGLE_CAMERA to Daakia. Only call when meetingWindow is open and origin is valid. */
export function sendToggleCamera(
    meetingWindow: Window,
    meetingOrigin: string,
    isOn: boolean,
): void {
    meetingWindow.postMessage(
        {
            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
            type: 'TOGGLE_CAMERA',
            isOn,
            timestamp: Date.now(),
        },
        meetingOrigin,
    );
}

/** Send token to Daakia when iframe loads. */
export function sendTokenToDaakia(
    meetingWindow: Window,
    meetingOrigin: string,
    token: string,
): void {
    console.log('Sending TOKEN_FROM_MATTERMOST to origin:', meetingOrigin);
    meetingWindow.postMessage(
        {
            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
            type: 'TOKEN_FROM_MATTERMOST',
            token,
            timestamp: Date.now(),
        },
        meetingOrigin,
    );
}

/** Send HELLO_FROM_MATTERMOST to Daakia (e.g. on "Go to meeting" or "Send message"). */
export function sendHelloFromMattermost(
    meetingWindow: Window,
    meetingOrigin: string,
    message: string = 'Hello World from Mattermost Plugin!',
): void {
    meetingWindow.postMessage(
        {
            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
            type: 'HELLO_FROM_MATTERMOST',
            message,
            timestamp: Date.now(),
        },
        meetingOrigin,
    );
}

// =============================================================================
// RECEIVING (Daakia meeting tab → Widget)
// =============================================================================

/** Incoming message types from Daakia (Daakia may not send `source` yet). */
export const DAAKIA_INCOMING = {
    MIC_TOGGLE: 'MIC_TOGGLE',
    CAMERA_TOGGLE: 'CAMERA_TOGGLE',
} as const;

export type DaakiaIncomingType = typeof DAAKIA_INCOMING[keyof typeof DAAKIA_INCOMING];

/** Callbacks for incoming Daakia messages. */
export interface DaakiaIncomingCallbacks {
    onMicToggle?: (isOn: boolean) => void;
    onCameraToggle?: (isOn: boolean) => void;
}

/**
 * Create a message listener for Daakia postMessages.
 * Use with window.addEventListener('message', listener).
 * Only accepts origins from ALLOWED_POSTMESSAGE_ORIGINS; does not require source (backward compat).
 */
export function createDaakiaMessageListener(callbacks: DaakiaIncomingCallbacks): (event: MessageEvent) => void {
    return (event: MessageEvent) => {
        if (!ALLOWED_POSTMESSAGE_ORIGINS.has(event.origin)) {
            return;
        }

        const data = event.data;
        if (!data || typeof data.type !== 'string') {
            return;
        }

        switch (data.type) {
        case DAAKIA_INCOMING.MIC_TOGGLE: {
            callbacks.onMicToggle?.(Boolean(data.isOn));
            break;
        }
        case DAAKIA_INCOMING.CAMERA_TOGGLE: {
            callbacks.onCameraToggle?.(Boolean(data.isOn));
            break;
        }
        }
    };
}
