/*eslint-disable */
import React, {useState, useCallback, useMemo, useRef} from 'react';

import {
    getMeetingOrigin,
    sendToggleMic,
    sendToggleCamera,
    sendHelloFromMattermost,
    createDaakiaMessageListener,
} from './integrations';

import './call_widget.scss';

interface SimpleCallWidgetProps {
    isOpen: boolean;
    meetingUrl: string;
    meetingWindow?: Window | null;
    onClose?: () => void;
    useIframe?: boolean;
    token?: string;
}

const SimpleCallWidget: React.FC<SimpleCallWidgetProps> = ({
    isOpen,
    meetingUrl,
    meetingWindow,
    onClose,
    useIframe = false,
    token,
}) => {
    const [pos, setPos] = useState({x: 80, y: 120});
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({x: 0, y: 0});
    const [isExpanded, setIsExpanded] = useState(useIframe); // Auto-expand in iframe mode
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isUpdatingFromRemote, setIsUpdatingFromRemote] = useState(false);
    const [iframeWindow, setIframeWindow] = useState<Window | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const meetingOrigin = useMemo(() => getMeetingOrigin(meetingUrl), [meetingUrl]);

    const effectiveWindow = useIframe ? iframeWindow : meetingWindow;
    const windowReady = useIframe ? Boolean(iframeWindow) : Boolean(meetingWindow && !meetingWindow.closed);

    const onIframeLoad = useCallback(() => {
        if (iframeRef.current?.contentWindow) {
            setIframeWindow(iframeRef.current.contentWindow);
        }
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setDragging(true);
        setOffset({
            x: e.clientX - pos.x,
            y: e.clientY - pos.y,
        });
    }, [pos.x, pos.y]);

    const onMouseMove = useCallback((e: MouseEvent) => {
        if (!dragging) {
            return;
        }
        e.preventDefault();
        setPos({
            x: e.clientX - offset.x,
            y: e.clientY - offset.y,
        });
    }, [dragging, offset]);

    const onMouseUp = useCallback(() => {
        setDragging(false);
    }, []);

    React.useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [dragging, onMouseMove, onMouseUp]);

    // Single listener: controls (mic/camera) + Konnect verify/token. Daakia asks for token; we reply with stored token.
    React.useEffect(() => {
        const handleMessage = createDaakiaMessageListener(
            {
                onMicToggle: (isOn) => {
                    setIsUpdatingFromRemote(true);
                    setIsMicOn(isOn);
                    setTimeout(() => setIsUpdatingFromRemote(false), 100);
                },
                onCameraToggle: (isOn) => {
                    setIsUpdatingFromRemote(true);
                    setIsCameraOn(isOn);
                    setTimeout(() => setIsUpdatingFromRemote(false), 100);
                },
            },
            {
                getToken: () => token,
                onVerified: undefined,
            },
        );
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [token]);

    const handleMicToggle = useCallback(() => {
        if (isUpdatingFromRemote || !meetingOrigin || !windowReady || !effectiveWindow) {
            return;
        }
        const newMicState = !isMicOn;
        setIsMicOn(newMicState);
        sendToggleMic(effectiveWindow, meetingOrigin, newMicState);
    }, [meetingOrigin, windowReady, effectiveWindow, isMicOn, isUpdatingFromRemote]);

    const handleCameraToggle = useCallback(() => {
        if (isUpdatingFromRemote || !meetingOrigin || !windowReady || !effectiveWindow) {
            return;
        }
        const newCameraState = !isCameraOn;
        setIsCameraOn(newCameraState);
        sendToggleCamera(effectiveWindow, meetingOrigin, newCameraState);
    }, [meetingOrigin, windowReady, effectiveWindow, isCameraOn, isUpdatingFromRemote]);

    const handleSendMessage = useCallback(() => {
        if (!meetingOrigin || !windowReady || !effectiveWindow) {
            return;
        }
        sendHelloFromMattermost(effectiveWindow, meetingOrigin, 'Hello World from Mattermost Plugin!');
    }, [meetingOrigin, windowReady, effectiveWindow]);

    const handleGoToMeeting = useCallback(() => {
        if (useIframe) {
            if (!isExpanded) {
                setIsExpanded(true);
            }
            return;
        }
        if (meetingOrigin && effectiveWindow && windowReady) {
            (effectiveWindow as Window).focus();
            sendHelloFromMattermost(effectiveWindow, meetingOrigin, 'Hello World from Mattermost Plugin!');
        } else {
            window.open(meetingUrl, '_blank');
        }
    }, [meetingUrl, meetingOrigin, effectiveWindow, windowReady, useIframe, isExpanded]);

    const handleClose = useCallback(() => {
        setIsExpanded(false);
        if (onClose) {
            onClose();
        }
    }, [onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className={`daakia-call-widget ${isExpanded ? 'daakia-call-widget--expanded' : ''}`}
            style={{
                position: 'fixed',
                left: isExpanded ? 0 : pos.x,
                top: isExpanded ? 0 : pos.y,
                width: isExpanded ? '100vw' : 260,
                height: isExpanded ? '100vh' : 120,
                zIndex: isExpanded ? 100000 : 99999,
            }}
        >
            {/* Header */}
            <div
                className='daakia-call-widget__header'
                onMouseDown={onMouseDown}
                style={{cursor: dragging ? 'grabbing' : 'grab'}}
            >
                <div className='daakia-call-widget__header-title'>
                    <i className='icon icon-phone daakia-call-widget__header-icon'/>
                    <span className='daakia-call-widget__header-label'>{'Meeting Active'}</span>
                </div>
                <div className='daakia-call-widget__header-actions'>
                    <button
                        type='button'
                        className='daakia-call-widget__header-btn daakia-call-widget__header-btn--expand'
                        onClick={() => setIsExpanded(!isExpanded)}
                        title={isExpanded ? 'Minimize' : 'Expand'}
                    >
                        <i className={`icon daakia-call-widget__expand-icon ${isExpanded ? 'icon-arrow-collapse' : 'icon-arrow-expand'}`}/>
                    </button>
                    {!useIframe && (
                        <button
                            type='button'
                            className='daakia-call-widget__header-btn'
                            onClick={handleGoToMeeting}
                            title='Go to Meeting'
                        >
                            <i className='icon icon-open-in-new'/>
                        </button>
                    )}
                    <button
                        type='button'
                        className='daakia-call-widget__header-btn daakia-call-widget__header-btn--close'
                        onClick={handleClose}
                        title='Close'
                    >
                        <i className='icon icon-close'/>
                    </button>
                </div>
            </div>

            {/* Compact View - Controls */}
            {!isExpanded && (
                <div className='daakia-call-widget__controls'>
                    <div className='daakia-call-widget__controls-inner'>
                        {/* Mic Button */}
                        <button
                            type='button'
                            className={`daakia-call-widget__control-btn ${isMicOn ? 'daakia-call-widget__control-btn--on' : 'daakia-call-widget__control-btn--off'}`}
                            onClick={handleMicToggle}
                            title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                        >
                            <i className={`icon ${isMicOn ? 'icon-microphone' : 'icon-microphone-off'}`}/>
                        </button>

                        {/* Camera Button */}
                        <button
                            type='button'
                            className={`daakia-call-widget__control-btn ${isCameraOn ? 'daakia-call-widget__control-btn--on' : 'daakia-call-widget__control-btn--off'}`}
                            onClick={handleCameraToggle}
                            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                        >
                            <i className={`icon ${isCameraOn ? 'icon-video-outline' : 'icon-video-off-outline'}`}/>
                        </button>

                        {/* Send Hello Message */}
                        <button
                            type='button'
                            className='daakia-call-widget__control-btn daakia-call-widget__control-btn--secondary'
                            onClick={handleSendMessage}
                            title='Send Hello Message'
                        >
                            <i className='icon icon-send'/>
                        </button>

                        {/* End Call Button - Disabled */}
                        <button
                            type='button'
                            className='daakia-call-widget__control-btn daakia-call-widget__control-btn--danger'
                            disabled={true}
                            title='End Call'
                        >
                            <i className='icon icon-phone-hangup'/>
                        </button>
                    </div>
                </div>
            )}

            {/* Iframe - always mounted in iframe mode to prevent reload */}
            {useIframe && (
                <div
                    className={`daakia-call-widget__expanded ${isExpanded ? '' : 'daakia-call-widget__expanded--hidden'}`}
                    aria-hidden={!isExpanded}
                >
                    <iframe
                        ref={iframeRef}
                        className='daakia-call-widget__iframe'
                        src={meetingUrl}
                        title='Daakia Meeting'
                        onLoad={onIframeLoad}
                        allow='camera; microphone; display-capture; autoplay; encrypted-media; fullscreen'
                    />
                </div>
            )}

            {/* Expanded View - for new window mode */}
            {isExpanded && !useIframe && (
                <div className='daakia-call-widget__expanded'>
                    <div className='daakia-call-widget__expanded-content'>
                        <i className='icon icon-video-outline daakia-call-widget__expanded-icon'/>
                        <p className='daakia-call-widget__expanded-text'>{'Meeting is running in another tab'}</p>
                        <button
                            type='button'
                            className='daakia-call-widget__expanded-btn'
                            onClick={handleGoToMeeting}
                        >
                            {'Go to Meeting'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleCallWidget;
