import React, {useEffect, useState} from 'react';

import IncomingCallNotification from './incoming_call_notification';

import {getDaakiaToken} from '../../services/meetingUrlService';

interface IncomingCallData {
    callId: string;
    channelId: string;
    callerName: string;
    callerAvatarUrl: string;
    meetingUrl?: string;
    timestamp: number;
}

// Get incoming call data from window (set by plugin)
const IncomingCallContainer = () => {
    const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(
        (window as any).daakiaIncomingCall || null,
    );

    useEffect(() => {
        const handleIncomingCall = () => {
            setIncomingCall((window as any).daakiaIncomingCall);
        };

        const handleCallCleared = () => {
            setIncomingCall(null);
        };

        window.addEventListener('daakia-incoming-call', handleIncomingCall);
        window.addEventListener('daakia-call-cleared', handleCallCleared);
        window.addEventListener('daakia-call-answered', handleCallCleared);
        window.addEventListener('daakia-call-declined', handleCallCleared);

        return () => {
            window.removeEventListener('daakia-incoming-call', handleIncomingCall);
            window.removeEventListener('daakia-call-cleared', handleCallCleared);
            window.removeEventListener('daakia-call-answered', handleCallCleared);
            window.removeEventListener('daakia-call-declined', handleCallCleared);
        };
    }, []);

    if (!incomingCall) {
        return null;
    }

    const handleAnswer = async () => {
        // Stop ringing sound immediately
        if ((window as any).daakiaStopRinging) {
            (window as any).daakiaStopRinging();
        }

        // Get meeting URL before clearing call state
        const meetingUrl = incomingCall.meetingUrl;

        // Clear call state
        (window as any).daakiaIncomingCall = null;

        // Force re-render and notify components
        window.dispatchEvent(new Event('daakia-call-answered'));

        if (!meetingUrl) {
            // eslint-disable-next-line no-console
            console.error('No meeting URL available for incoming call');
            return;
        }

        // Get user token (same API as start/join) and open widget
        const tokenResult = await getDaakiaToken();
        const token = tokenResult.success ? tokenResult.token : undefined;
        window.dispatchEvent(new CustomEvent('daakia-widget-open', {
            detail: {
                meetingUrl,
                token,
            },
        }));
    };

    const handleDecline = () => {
        // Stop ringing sound immediately
        if ((window as any).daakiaStopRinging) {
            (window as any).daakiaStopRinging();
        }

        // Clear call state
        (window as any).daakiaIncomingCall = null;

        // Force re-render and notify components
        window.dispatchEvent(new Event('daakia-call-declined'));
    };

    return (
        <IncomingCallNotification
            callerName={incomingCall.callerName}
            callerAvatarUrl={incomingCall.callerAvatarUrl}
            onAnswer={handleAnswer}
            onDecline={handleDecline}
        />
    );
};

export default IncomingCallContainer;
