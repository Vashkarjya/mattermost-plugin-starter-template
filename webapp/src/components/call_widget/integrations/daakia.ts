/**
 * Daakia postMessage integration: widget ↔ meeting tab.
 * Konnect-style: Daakia asks for verification (DAAKIA_VERIFY_KONNECT) then token (DAAKIA_READY);
 * we reply KONNECT_VERIFIED and TOKEN_FROM_MATTERMOST when asked.
 * Order: all SENDING first, then all RECEIVING.
 */

import {ALLOWED_POSTMESSAGE_ORIGINS, POSTMESSAGE_SOURCE_CALL_WIDGET} from '../../../constants';

// ----- Konnect verification / token request (Daakia → Widget, we reply) -----
/** Daakia sends this to verify the host is Konnect. We reply with KONNECT_VERIFIED. */
export const DAAKIA_VERIFY_KONNECT = 'DAAKIA_VERIFY_KONNECT';

/** We reply with this after DAAKIA_VERIFY_KONNECT. */
export const KONNECT_VERIFIED = 'KONNECT_VERIFIED';

/** Daakia sends this when it wants the user token. We reply with TOKEN_FROM_MATTERMOST. */
export const DAAKIA_READY = 'DAAKIA_READY';

function normalizeOrigin(origin: string): string {
    return typeof origin === 'string' ? origin.replace(/\/$/, '') : '';
}

function isOriginAllowed(origin: string): boolean {
    return ALLOWED_POSTMESSAGE_ORIGINS.has(normalizeOrigin(origin));
}

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

/** Send END_CALL to Daakia. */
export function sendEndCall(
    meetingWindow: Window,
    meetingOrigin: string,
    endType: 'leave' | 'end' | 'removed' = 'end',
): void {
    meetingWindow.postMessage(
        {
            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
            type: 'END_CALL',
            endType,
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
    END_CALL: 'END_CALL',
} as const;

export type DaakiaIncomingType = typeof DAAKIA_INCOMING[keyof typeof DAAKIA_INCOMING];

/** Callbacks for incoming Daakia messages. */
export interface DaakiaIncomingCallbacks {
    onMicToggle?: (isOn: boolean) => void;
    onCameraToggle?: (isOn: boolean) => void;
    onEndCall?: () => void;
}

/** Options for Konnect verification / token: when Daakia asks, we reply with stored token. */
export interface KonnectTokenOptions {

    /** Return current user token when Daakia sends DAAKIA_READY. Token is already fetched and stored when opening the widget. */
    getToken: () => string | undefined;

    /** Called after we send KONNECT_VERIFIED (optional). */
    onVerified?: () => void;
}

/**
 * Create a message listener for Daakia postMessages.
 * Handles: MIC_TOGGLE, CAMERA_TOGGLE (controls); DAAKIA_VERIFY_KONNECT → reply KONNECT_VERIFIED;
 * DAAKIA_READY → reply TOKEN_FROM_MATTERMOST with token from getToken().
 * Use with window.addEventListener('message', listener).
 * Only accepts origins from ALLOWED_POSTMESSAGE_ORIGINS (normalized).
 */
export function createDaakiaMessageListener(
    callbacks: DaakiaIncomingCallbacks,
    konnectOptions?: KonnectTokenOptions,
): (event: MessageEvent) => void {
    return (event: MessageEvent) => {
        if (!isOriginAllowed(event.origin)) {
            return;
        }

        const data = event.data;
        if (!data || typeof data.type !== 'string') {
            return;
        }

        const source = event.source as Window | null;
        const origin = event.origin;

        switch (data.type) {
        case DAAKIA_INCOMING.MIC_TOGGLE: {
            callbacks.onMicToggle?.(Boolean(data.isOn));
            break;
        }
        case DAAKIA_INCOMING.CAMERA_TOGGLE: {
            callbacks.onCameraToggle?.(Boolean(data.isOn));
            break;
        }
        case DAAKIA_INCOMING.END_CALL: {
            callbacks.onEndCall?.();
            break;
        }
        case DAAKIA_VERIFY_KONNECT: {
            // eslint-disable-next-line no-console
            console.log('[Konnect] Got ask: DAAKIA_VERIFY_KONNECT');
            if (source && source !== window) {
                try {
                    source.postMessage(
                        {
                            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
                            type: KONNECT_VERIFIED,
                            timestamp: Date.now(),
                        },
                        origin,
                    );
                    // eslint-disable-next-line no-console
                    console.log('[Konnect] Sending: KONNECT_VERIFIED');
                    konnectOptions?.onVerified?.();
                } catch {
                    // ignore
                }
            }
            break;
        }
        case DAAKIA_READY: {
            // eslint-disable-next-line no-console
            console.log('[Konnect] Got ask: DAAKIA_READY (token requested)');
            const token = konnectOptions?.getToken?.();
            if (source && source !== window && token) {
                try {
                    source.postMessage(
                        {
                            source: POSTMESSAGE_SOURCE_CALL_WIDGET,
                            type: 'TOKEN_FROM_MATTERMOST',
                            token,
                            timestamp: Date.now(),
                        },
                        origin,
                    );
                    // eslint-disable-next-line no-console
                    console.log('[Konnect] Sending: TOKEN_FROM_MATTERMOST');
                } catch {
                    // ignore
                }
            } else if (!token) {
                // eslint-disable-next-line no-console
                console.log('[Konnect] Not sending token: no token available');
            }
            break;
        }
        }
    };
}
