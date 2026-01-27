import React, {useState, useEffect} from 'react';

import SimpleCallWidget from './simple_call_widget';

interface WidgetState {
    isOpen: boolean;
    meetingUrl?: string;
    meetingWindow?: Window | null;
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
            });
        };

        const handleWidgetClose = () => {
            setWidgetState({
                isOpen: false,
                meetingUrl: undefined,
                meetingWindow: null,
            });
        };

        // Listen for join call event (from call posts or incoming calls)
        const handleJoinCall = (event: CustomEvent) => {
            const {meetingUrl} = event.detail || {};
            if (meetingUrl) {
                const meetingWindow = window.open(meetingUrl, '_blank');
                setWidgetState({
                    isOpen: true,
                    meetingUrl,
                    meetingWindow,
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
        />
    );
};

export default CallWidgetContainer;
