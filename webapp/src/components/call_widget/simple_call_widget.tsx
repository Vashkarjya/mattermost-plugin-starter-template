import React, {useState, useCallback, useRef} from 'react';

import './call_widget.scss';

interface SimpleCallWidgetProps {
    isOpen: boolean;
    meetingUrl: string;
    onClose?: () => void;
}

const SimpleCallWidget: React.FC<SimpleCallWidgetProps> = ({
    isOpen,
    meetingUrl,
    onClose,
}) => {
    const [pos, setPos] = useState({x: 80, y: 120});
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({x: 0, y: 0});
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isUpdatingFromRemote, setIsUpdatingFromRemote] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

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

    // Listen for messages from iframe
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Accept messages from https://stag-web.daakia.co.in
            if (event.origin !== 'https://stag-web.daakia.co.in') {
                return;
            }

            if (event.data.type === 'MIC_TOGGLE' || event.data.type === 'MICROPHONE_STATE') {
                setIsUpdatingFromRemote(true);
                setIsMicOn(event.data.isOn || event.data.enabled);
                setTimeout(() => setIsUpdatingFromRemote(false), 100);
            }
            if (event.data.type === 'CAMERA_TOGGLE' || event.data.type === 'CAMERA_STATE') {
                setIsUpdatingFromRemote(true);
                setIsCameraOn(event.data.isOn || event.data.enabled);
                setTimeout(() => setIsUpdatingFromRemote(false), 100);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // No token handling here – widget only manages UI and basic messaging

    const handleMicToggle = useCallback(() => {
        if (isUpdatingFromRemote) {
            return;
        }

        const newMicState = !isMicOn;

        // Update local state immediately
        setIsMicOn(newMicState);

        // Send message to iframe
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'TOGGLE_MIC',
                isOn: newMicState,
                timestamp: Date.now(),
            }, 'https://stag-web.daakia.co.in');
        }
    }, [isMicOn, isUpdatingFromRemote]);

    const handleCameraToggle = useCallback(() => {
        if (isUpdatingFromRemote) {
            return;
        }

        const newCameraState = !isCameraOn;

        // Update local state immediately
        setIsCameraOn(newCameraState);

        // Send message to iframe
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'TOGGLE_CAMERA',
                isOn: newCameraState,
                timestamp: Date.now(),
            }, 'https://stag-web.daakia.co.in');
        }
    }, [isCameraOn, isUpdatingFromRemote]);

    const handleSendMessage = useCallback(() => {
        if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({
                type: 'HELLO_FROM_MATTERMOST',
                message: 'Hello World from Mattermost Plugin!',
                timestamp: Date.now(),
            }, 'https://stag-web.daakia.co.in');
        }
    }, []);

    const handleClose = useCallback(() => {
        setIsExpanded(false);
        if (onClose) {
            onClose();
        }
    }, [onClose]);

    const handleRefresh = useCallback(() => {
        if (iframeRef.current) {
            // For cross-origin iframes we cannot access contentWindow.location,
            // but we *can* reset the src from the parent side to trigger a reload.
            iframeRef.current.src = meetingUrl;
        }
    }, [meetingUrl]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className='daakia-call-widget'
            style={{
                position: 'fixed',
                left: isExpanded ? 0 : pos.x,
                top: isExpanded ? 0 : pos.y,
                width: isExpanded ? '100vw' : 238,
                height: isExpanded ? '100vh' : 116,
                background: 'var(--center-channel-bg)',
                color: 'var(--center-channel-color)',
                borderRadius: isExpanded ? '0' : '8px',
                boxShadow: isExpanded ? 'none' : '0px 0px 0px 2px rgba(var(--center-channel-color-rgb), 0.16), 0px 8px 24px rgba(0, 0, 0, 0.12)',
                zIndex: isExpanded ? 100000 : 99999,
                userSelect: 'none',
                transition: 'width 0.3s ease, height 0.3s ease, border-radius 0.3s ease',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                className='widget-header'
                onMouseDown={onMouseDown}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.08)',
                    cursor: dragging ? 'grabbing' : 'grab',
                    background: 'rgba(var(--center-channel-color-rgb), 0.04)',
                    height: '60px',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    <i
                        className='icon icon-phone'
                        style={{color: 'rgb(var(--button-bg-rgb))', fontSize: '16px'}}
                    />
                    <span style={{fontSize: '14px', fontWeight: 600}}>{'Meeting Active'}</span>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    {/* Refresh button - visible in both states, mainly useful when expanded */}
                    <button
                        onClick={handleRefresh}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'rgba(var(--center-channel-color-rgb), 0.7)',
                        }}
                        title='Refresh meeting'
                    >
                        <i
                            className='icon icon-refresh'
                            style={{fontSize: '16px'}}
                        />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'rgba(var(--center-channel-color-rgb), 0.7)',
                        }}
                        title={isExpanded ? 'Minimize' : 'Expand'}
                    >
                        <i
                            className={`icon ${isExpanded ? 'icon-chevron-down' : 'icon-arrow-expand'}`}
                            style={{fontSize: '18px', fontWeight: 'bold'}}
                        />
                    </button>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'rgba(var(--center-channel-color-rgb), 0.6)',
                        }}
                    >
                        <i
                            className='icon icon-close'
                            style={{fontSize: '16px'}}
                        />
                    </button>
                </div>
            </div>

            {/* Always render iframe but control visibility - never unmount to prevent reload */}
            {meetingUrl && (
                <iframe
                    ref={iframeRef}
                    src={meetingUrl}
                    style={{
                        width: '100%',
                        height: isExpanded ? 'calc(100vh - 60px)' : '0px',
                        border: 'none',
                        borderRadius: '0',
                        opacity: isExpanded ? 1 : 0,
                        pointerEvents: isExpanded ? 'auto' : 'none',
                        transition: 'height 0.3s ease, opacity 0.3s ease',
                        position: isExpanded ? 'fixed' : 'absolute',
                        top: isExpanded ? '60px' : '0',
                        left: isExpanded ? '0' : '0',
                        zIndex: isExpanded ? 99998 : -1,
                        visibility: isExpanded ? 'visible' : 'hidden',
                    }}
                    allow='camera; microphone; display-capture; autoplay; encrypted-media; fullscreen; clipboard-read; clipboard-write; geolocation; payment; usb; serial; xr-spatial-tracking; accelerometer; gyroscope; magnetometer; picture-in-picture; web-share'
                    allowFullScreen={true}
                    title='Daakia Meeting'
                />
            )}

            {/* Compact View - Controls */}
            {!isExpanded && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px 16px',
                        height: '56px',
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', width: '100%'}}>
                        {/* Mic Button - Now Enabled */}
                        <button
                            onClick={handleMicToggle}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isMicOn ? 'rgba(var(--button-bg-rgb), 0.1)' : 'rgba(var(--error-text-color-rgb), 0.1)',
                                color: isMicOn ? 'rgb(var(--button-bg-rgb))' : 'rgb(var(--error-text-color-rgb))',
                            }}
                            title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                        >
                            <i
                                className={`icon ${isMicOn ? 'icon-microphone' : 'icon-microphone-off'}`}
                                style={{fontSize: '12px'}}
                            />
                        </button>

                        {/* Camera Button - Now Enabled */}
                        <button
                            onClick={handleCameraToggle}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isCameraOn ? 'rgba(var(--button-bg-rgb), 0.1)' : 'rgba(var(--error-text-color-rgb), 0.1)',
                                color: isCameraOn ? 'rgb(var(--button-bg-rgb))' : 'rgb(var(--error-text-color-rgb))',
                            }}
                            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                        >
                            <i
                                className={`icon ${isCameraOn ? 'icon-video' : 'icon-video-off'}`}
                                style={{fontSize: '12px'}}
                            />
                        </button>

                        {/* Send Message Button */}
                        <button
                            onClick={handleSendMessage}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(var(--button-bg-rgb), 0.1)',
                                color: 'rgb(var(--button-bg-rgb))',
                            }}
                            title='Send Hello Message'
                        >
                            <i
                                className='icon icon-send'
                                style={{fontSize: '12px'}}
                            />
                        </button>

                        {/* Expand Button */}
                        <button
                            onClick={() => setIsExpanded(true)}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(var(--button-bg-rgb), 0.1)',
                                color: 'rgb(var(--button-bg-rgb))',
                            }}
                            title='Expand Meeting'
                        >
                            <i
                                className='icon icon-window-maximize'
                                style={{fontSize: '12px'}}
                            />
                        </button>

                        {/* End Call Button - Disabled */}
                        <button
                            disabled={true}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: 'none',
                                cursor: 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(var(--error-text-color-rgb), 0.1)',
                                color: 'rgb(var(--error-text-color-rgb))',
                                opacity: 0.5,
                            }}
                        >
                            <i
                                className='icon icon-phone-hangup'
                                style={{fontSize: '12px'}}
                            />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleCallWidget;
