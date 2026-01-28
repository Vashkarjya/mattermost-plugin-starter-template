import React, {useState, useCallback} from 'react';

import './call_widget.scss';

interface SimpleCallWidgetProps {
    isOpen: boolean;
    meetingUrl: string;
    meetingWindow?: Window | null;
    onClose?: () => void;
}

const SimpleCallWidget: React.FC<SimpleCallWidgetProps> = ({
    isOpen,
    meetingUrl,
    meetingWindow,
    onClose,
}) => {
    const [pos, setPos] = useState({x: 80, y: 120});
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({x: 0, y: 0});
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isUpdatingFromRemote, setIsUpdatingFromRemote] = useState(false);

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

    // Listen for messages from meeting window
    React.useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Accept messages from https://stag-web.daakia.co.in
            if (event.origin !== 'https://stag-web.daakia.co.in') {
                return;
            }

            if (event.data.type === 'MIC_TOGGLE') {
                setIsUpdatingFromRemote(true);
                setIsMicOn(event.data.isOn);
                setTimeout(() => setIsUpdatingFromRemote(false), 100);
            }
            if (event.data.type === 'CAMERA_TOGGLE') {
                setIsUpdatingFromRemote(true);
                setIsCameraOn(event.data.isOn);
                setTimeout(() => setIsUpdatingFromRemote(false), 100);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleMicToggle = useCallback(() => {
        if (isUpdatingFromRemote || !meetingWindow || meetingWindow.closed) {
            return;
        }

        const newMicState = !isMicOn;

        // Update local state immediately
        setIsMicOn(newMicState);

        meetingWindow.postMessage({
            type: 'TOGGLE_MIC',
            isOn: newMicState,
            timestamp: Date.now(),
        }, 'https://stag-web.daakia.co.in');
    }, [meetingWindow, isMicOn, isUpdatingFromRemote]);

    const handleCameraToggle = useCallback(() => {
        if (isUpdatingFromRemote || !meetingWindow || meetingWindow.closed) {
            return;
        }

        const newCameraState = !isCameraOn;

        // Update local state immediately
        setIsCameraOn(newCameraState);

        meetingWindow.postMessage({
            type: 'TOGGLE_CAMERA',
            isOn: newCameraState,
            timestamp: Date.now(),
        }, 'https://stag-web.daakia.co.in');
    }, [meetingWindow, isCameraOn, isUpdatingFromRemote]);

    const handleSendMessage = useCallback(() => {
        if (meetingWindow && !meetingWindow.closed) {
            meetingWindow.postMessage({
                type: 'HELLO_FROM_MATTERMOST',
                message: 'Hello World from Mattermost Plugin!',
                timestamp: Date.now(),
            }, 'https://stag-web.daakia.co.in');
        }
    }, [meetingWindow]);

    const handleGoToMeeting = useCallback(() => {
        if (meetingWindow && !meetingWindow.closed) {
            meetingWindow.focus();

            // Send hello world message to meeting window
            meetingWindow.postMessage({
                type: 'HELLO_FROM_MATTERMOST',
                message: 'Hello World from Mattermost Plugin!',
                timestamp: Date.now(),
            }, 'https://stag-web.daakia.co.in');
        } else {
            window.open(meetingUrl, '_blank');
        }
    }, [meetingUrl, meetingWindow]);

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
                            className={`icon ${isExpanded ? 'icon-window-minimize' : 'icon-window-maximize'}`}
                            style={{fontSize: '16px'}}
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

                        {/* Go to Meeting Button */}
                        <button
                            onClick={handleGoToMeeting}
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
                            title='Go to Meeting'
                        >
                            <i
                                className='icon icon-open-in-new'
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

            {/* Expanded View */}
            {isExpanded && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 'calc(100vh - 60px)',
                        fontSize: '18px',
                        color: 'rgba(var(--center-channel-color-rgb), 0.7)',
                    }}
                >
                    <div style={{textAlign: 'center'}}>
                        <i
                            className='icon icon-video'
                            style={{fontSize: '48px', marginBottom: '16px', display: 'block'}}
                        />
                        <div>{'Meeting is running in another tab'}</div>
                        <button
                            onClick={handleGoToMeeting}
                            style={{
                                marginTop: '16px',
                                padding: '12px 24px',
                                background: 'rgb(var(--button-bg-rgb))',
                                color: 'var(--button-color)',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                            }}
                        >
                            {isExpanded ? 'Minimize' : 'Go to Meeting'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SimpleCallWidget;
