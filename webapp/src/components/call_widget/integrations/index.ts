export {
    getMeetingOrigin,
    sendToggleMic,
    sendToggleCamera,
    sendHelloFromMattermost,
    sendTokenToDaakia,
    sendEndCall,
    createDaakiaMessageListener,
    DAAKIA_INCOMING,
} from './daakia';

export type {DaakiaIncomingType, DaakiaIncomingCallbacks} from './daakia';
