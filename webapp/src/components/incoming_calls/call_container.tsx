import React, {useEffect, useState} from 'react';

import IncomingCallNotification from './incoming_call_notification';

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

    const handleAnswer = () => {
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

        // Open meeting URL in new window and show widget
        if (meetingUrl) {
            const meetingWindow = window.open(meetingUrl, '_blank');
            
            // Show widget when answering call
            window.dispatchEvent(new CustomEvent('daakia-widget-open', {
                detail: {
                    meetingUrl,
                    meetingWindow,
                },
            }));
        } else {
            // eslint-disable-next-line no-console
            console.error('No meeting URL available for incoming call');
        }
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
