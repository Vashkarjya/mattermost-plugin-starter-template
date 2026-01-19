// Type definitions for the Daakia Calls plugin

export interface GlobalState {
    entities: {
        users: {
            currentUserId: string;
        };
        channels?: {
            currentChannelId?: string;
        };
    };
}

export interface CallData {
    call_id: string;
    channel_id: string;
    caller_id: string;
    caller_name: string;
    caller_avatar_url: string;
    meeting_url?: string;
    timestamp: number;
}

export interface WebSocketEvent {
    data: unknown;
}

export interface WindowWithDaakia extends Window {
    daakiaIncomingCall?: {
        callId: string;
        channelId: string;
        callerName: string;
        callerAvatarUrl: string;
        meetingUrl?: string;
        timestamp: number;
    } | null;
    daakiaStopRinging?: () => void;
}
