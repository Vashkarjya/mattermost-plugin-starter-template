import React, {useState, useEffect} from 'react';

import CallWidget from './call_widget';

interface WidgetState {
    isOpen: boolean;
    meetingUrl?: string;
    shouldCreateCallPost?: boolean;
    callPostData?: {
        channelId: string;
        meetingUrl: string;
        roomUid?: string;
    };
}

const CallWidgetContainer = () => {
    const [widgetState, setWidgetState] = useState<WidgetState>({
        isOpen: (window as any).daakiaCallWidgetOpen || false,
        meetingUrl: (window as any).daakiaCallWidgetUrl,
    });

    useEffect(() => {
        const handleWidgetOpen = (event: CustomEvent) => {
            const detail = event.detail || {};
            setWidgetState({
                isOpen: true,
                meetingUrl: detail.meetingUrl,
                shouldCreateCallPost: detail.channelId ? true : false, // Create post if channelId is provided
                callPostData: detail.channelId ? {
                    channelId: detail.channelId,
                    meetingUrl: detail.meetingUrl,
                    roomUid: detail.roomUid,
                } : undefined,
            });
            (window as any).daakiaCallWidgetOpen = true;
            (window as any).daakiaCallWidgetUrl = detail.meetingUrl;
        };

        const handleWidgetClose = () => {
            setWidgetState({
                isOpen: false,
                meetingUrl: undefined,
                shouldCreateCallPost: false,
                callPostData: undefined,
            });
            (window as any).daakiaCallWidgetOpen = false;
            (window as any).daakiaCallWidgetUrl = undefined;
        };

        const handleWidgetToggle = () => {
            const currentState = (window as any).daakiaCallWidgetOpen || false;
            if (currentState) {
                handleWidgetClose();
            } else {
                handleWidgetOpen(new CustomEvent('daakia-widget-open', {detail: {}}));
            }
        };

        // Listen for join call event (from call posts or incoming calls)
        const handleJoinCall = (event: CustomEvent) => {
            const {meetingUrl} = event.detail || {};
            if (meetingUrl) {
                setWidgetState({
                    isOpen: true,
                    meetingUrl,
                });
                (window as any).daakiaCallWidgetOpen = true;
                (window as any).daakiaCallWidgetUrl = meetingUrl;
            }
        };

        // Listen for call start event (from call button)
        const handleCallStart = () => {
            const currentState = (window as any).daakiaCallWidgetOpen || false;
            if (!currentState) {
                handleWidgetOpen(new CustomEvent('daakia-widget-open', {detail: {}}));
            }
        };

        window.addEventListener('daakia-widget-open', handleWidgetOpen as EventListener);
        window.addEventListener('daakia-widget-close', handleWidgetClose);
        window.addEventListener('daakia-widget-toggle', handleWidgetToggle);
        window.addEventListener('daakia-join-call', handleJoinCall as EventListener);
        window.addEventListener('daakia-open-call-widget', handleCallStart);

        return () => {
            window.removeEventListener('daakia-widget-open', handleWidgetOpen as EventListener);
            window.removeEventListener('daakia-widget-close', handleWidgetClose);
            window.removeEventListener('daakia-widget-toggle', handleWidgetToggle);
            window.removeEventListener('daakia-join-call', handleJoinCall as EventListener);
            window.removeEventListener('daakia-open-call-widget', handleCallStart);
        };
    }, []);

    const handleClose = () => {
        setWidgetState({
            isOpen: false,
            meetingUrl: undefined,
        });
        (window as any).daakiaCallWidgetOpen = false;
        (window as any).daakiaCallWidgetUrl = undefined;
        window.dispatchEvent(new Event('daakia-widget-close'));
    };

    if (!widgetState.isOpen) {
        return null;
    }

    if (!widgetState.meetingUrl) {
        return null;
    }

    return (
        <CallWidget
            isOpen={widgetState.isOpen}
            meetingUrl={widgetState.meetingUrl}
            shouldCreateCallPost={widgetState.shouldCreateCallPost}
            callPostData={widgetState.callPostData}
            onClose={handleClose}
        />
    );
};

export default CallWidgetContainer;
