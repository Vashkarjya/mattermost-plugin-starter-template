// Constants for the Daakia Calls plugin

export const RING_LENGTH = 50000; // 50 seconds
export const CALL_POST_TYPE = 'custom_daakia_call';

/** Allowed postMessage origins (widget ↔ meeting tab). */
export const ALLOWED_POSTMESSAGE_ORIGINS = new Set([
    'https://www.daakia.co.in',
    'https://stag-web.daakia.co.in',
    'http://localhost:3000',
    'http://localhost:3001',
]);

/** Source for outgoing messages from the call widget. */
export const POSTMESSAGE_SOURCE_CALL_WIDGET = 'DAAKIA_CALL_WIDGET';
