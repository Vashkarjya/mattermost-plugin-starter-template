// Constants for the Daakia Calls plugin

export const RING_LENGTH = 50000; // 50 seconds
export const CALL_POST_TYPE = 'custom_daakia_call';

/**
 * true  = meeting loads inside Mattermost (iframe).
 * false = meeting opens in a new browser tab/window.
 * Change this to toggle between iframe and "open in window" mode.
 */
export const USE_IFRAME_MODE = true;

/** Allowed postMessage origins (widget ↔ meeting tab). */
export const ALLOWED_POSTMESSAGE_ORIGINS = new Set([
    'https://www.daakia.co.in',
    'https://stag-web.daakia.co.in',
    'http://localhost:3000',
    'http://localhost:3001',
]);

/** Source for outgoing messages from the call widget. */
export const POSTMESSAGE_SOURCE_CALL_WIDGET = 'DAAKIA_CALL_WIDGET';
