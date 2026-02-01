import React, {useState, useEffect} from 'react';

import SimpleCallWidget from './simple_call_widget';

interface WidgetState {
    isOpen: boolean;
    meetingUrl?: string;
    meetingWindow?: Window | null;
    token?: string;
}

const CallWidgetContainer = () => {
    const [widgetState, setWidgetState] = useState<WidgetState>({
        isOpen: false,
    });

    useEffect(() => {
        const handleWidgetOpen = (event: CustomEvent) => {
            const detail = event.detail || {};
            setWidgetState({
                isOpen: true,
                meetingUrl: detail.meetingUrl,
                meetingWindow: detail.meetingWindow,
                token: detail.token,
            });
        };

        const handleWidgetClose = () => {
            setWidgetState({
                isOpen: false,
                meetingUrl: undefined,
                meetingWindow: null,
                token: undefined,
            });
        };

        // Listen for join call event (from call posts or incoming calls)
        const handleJoinCall = (event: CustomEvent) => {
            const {meetingUrl, token} = event.detail || {};
            if (meetingUrl) {
                // Don't open new window in iframe mode
                setWidgetState({
                    isOpen: true,
                    meetingUrl,
                    meetingWindow: null, // No external window in iframe mode
                    token,
                });
            }
        };

        window.addEventListener('daakia-widget-open', handleWidgetOpen as EventListener);
        window.addEventListener('daakia-widget-close', handleWidgetClose);
        window.addEventListener('daakia-join-call', handleJoinCall as EventListener);

        return () => {
            window.removeEventListener('daakia-widget-open', handleWidgetOpen as EventListener);
            window.removeEventListener('daakia-widget-close', handleWidgetClose);
            window.removeEventListener('daakia-join-call', handleJoinCall as EventListener);
        };
    }, []);

    const handleClose = () => {
        setWidgetState({
            isOpen: false,
            meetingUrl: undefined,
            meetingWindow: null,
            token: undefined,
        });
        window.dispatchEvent(new Event('daakia-widget-close'));
    };

    if (!widgetState.isOpen || !widgetState.meetingUrl) {
        return null;
    }

    return (
        <SimpleCallWidget
            isOpen={widgetState.isOpen}
            meetingUrl={widgetState.meetingUrl}
            meetingWindow={widgetState.meetingWindow}
            onClose={handleClose}
            useIframe={true}
            token={widgetState.token}
        />
    );
};

export default CallWidgetContainer;
