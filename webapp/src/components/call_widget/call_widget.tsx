import React, {useState, useEffect, useCallback} from 'react';

import {WidgetHeader, WidgetControls} from './components';
import {LoadingOverlay} from './loading_overlay';

import {createCallPost} from '../../services/meetingUrlService';

import './call_widget.scss';

// Daakia iframe origin
const DAAKIA_ORIGIN = 'http://localhost:3001';

interface CallWidgetProps {
    isOpen: boolean;
    meetingUrl: string; // Required - no fallback
    shouldCreateCallPost?: boolean; // If true, create call post when VIDEO_CONFERENCE is reached
    callPostData?: {
        channelId: string;
        meetingUrl: string;
        roomUid?: string;
    };
    onClose?: () => void;
}

const CallWidget: React.FC<CallWidgetProps> = ({
    isOpen,
    meetingUrl,
    shouldCreateCallPost = false,
    callPostData,
    onClose,
}) => {
    // Calculate initial position at top left (matching daakia_vc)
    const getInitialPosition = useCallback(() => {
        const margin = 80;
        return {
            x: margin,
            y: margin + 40,
        };
    }, []);

    const [pos, setPos] = useState(() => getInitialPosition());
    const [dragging, setDragging] = useState(false);
    const [offset, setOffset] = useState({x: 0, y: 0});
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMicOn, setIsMicOn] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [pageState, setPageState] = useState<'PREJOIN' | 'VIDEO_CONFERENCE' | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [callPostCreated, setCallPostCreated] = useState(false);

    // Reset position and page state when widget opens
    useEffect(() => {
        if (isOpen) {
            setPos(getInitialPosition());
            setPageState(null); // Reset to null until we receive PAGE_STATE from iframe
            setIsHost(false); // Reset host status
            setCallPostCreated(false); // Reset call post created flag
        }
    }, [isOpen, getInitialPosition]);

    // Create call post when VIDEO_CONFERENCE page is reached (matching reference implementation)
    useEffect(() => {
        if (pageState === 'VIDEO_CONFERENCE' && shouldCreateCallPost && callPostData && !callPostCreated) {
            createCallPost({
                channelId: callPostData.channelId,
                meetingUrl: callPostData.meetingUrl,
                roomUid: callPostData.roomUid,
            }).then((result) => {
                if (result.success) {
                    setCallPostCreated(true);
                    // eslint-disable-next-line no-console
                    console.log('Call post created successfully:', result.postId);
                } else {
                    // eslint-disable-next-line no-console
                    console.error('Failed to create call post:', result.error);
                }
            }).catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Error creating call post:', error);
            });
        }
    }, [pageState, shouldCreateCallPost, callPostData, callPostCreated]);

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

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [dragging, onMouseMove, onMouseUp]);

    const handleClose = useCallback(() => {
        setIsExpanded(false);
        setPageState(null);
        if (onClose) {
            onClose();
        }
    }, [onClose]);

    // Determine if controls should be disabled (disabled when on PREJOIN page or initial state)
    // Only show controls when explicitly on VIDEO_CONFERENCE page
    const areControlsDisabled = pageState !== 'VIDEO_CONFERENCE';

    // Listen for messages from iframe (Daakia meeting)
    useEffect(() => {
        const handleIframeMessage = (event: MessageEvent) => {
            // Only accept from Daakia origin
            if (event.origin !== DAAKIA_ORIGIN) {
                return;
            }

            switch (event.data.type) {
            case 'PAGE_STATE':
                // Track which page the iframe is on (PREJOIN or VIDEO_CONFERENCE)
                setPageState(event.data.page);

                // Request host status when entering VIDEO_CONFERENCE page
                if (event.data.page === 'VIDEO_CONFERENCE') {
                    const iframe = document.querySelector(`iframe[src*="${DAAKIA_ORIGIN}"]`) as HTMLIFrameElement;
                    if (iframe?.contentWindow) {
                        iframe.contentWindow.postMessage({
                            type: 'REQUEST_HOST_STATUS',
                        }, DAAKIA_ORIGIN);
                    }
                }
                break;
            case 'HOST_STATUS':
                // Track if user is host/moderator
                setIsHost(event.data.isHost === true);
                break;
            case 'MICROPHONE_STATE':
                setIsMicOn(event.data.enabled);
                break;
            case 'CAMERA_STATE':
                setIsCameraOn(event.data.enabled);
                break;
            case 'CALL_ENDED':
                setIsMicOn(false);
                setIsCameraOn(false);
                setPageState(null);
                setIsHost(false);
                handleClose();
                break;
            }
        };

        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, [handleClose]);

    const handleMicToggle = useCallback(() => {
        setIsMicOn(!isMicOn);
        const iframe = document.querySelector(`iframe[src*="${DAAKIA_ORIGIN}"]`) as HTMLIFrameElement;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'TOGGLE_MICROPHONE',
            }, DAAKIA_ORIGIN);
        }
    }, [isMicOn]);

    const handleCameraToggle = useCallback(() => {
        setIsCameraOn(!isCameraOn);
        const iframe = document.querySelector(`iframe[src*="${DAAKIA_ORIGIN}"]`) as HTMLIFrameElement;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'TOGGLE_CAMERA',
            }, DAAKIA_ORIGIN);
        }
    }, [isCameraOn]);

    const handleEndCall = useCallback(() => {
        // End call for everyone (host only)
        const iframe = document.querySelector('iframe[src*="localhost:3001"]') as HTMLIFrameElement;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'END_CALL',
                endType: 'end', // End call for everyone
            }, 'http://localhost:3001');
        }
        setIsMicOn(false);
        setIsCameraOn(false);
        setIsHost(false);
        handleClose();
    }, [handleClose]);

    const handleLeaveCall = useCallback(() => {
        // Leave call (user leaves but call continues)
        const iframe = document.querySelector(`iframe[src*="${DAAKIA_ORIGIN}"]`) as HTMLIFrameElement;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'LEAVE_CALL',
                endType: 'leave', // User leaves call
            }, DAAKIA_ORIGIN);
        }
        setIsMicOn(false);
        setIsCameraOn(false);
        setIsHost(false);
        handleClose();
    }, [handleClose]);

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
            <WidgetHeader
                isExpanded={isExpanded}
                dragging={dragging}
                onMouseDown={onMouseDown}
                onExpandToggle={() => setIsExpanded(!isExpanded)}
                onClose={handleClose}
            />

            {/* Always render iframe but control visibility - never unmount to prevent reload */}
            {meetingUrl && (
                <iframe
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

            {/* Loading overlay when expanded and on PREJOIN or initial state */}
            <LoadingOverlay
                isExpanded={isExpanded}
                show={areControlsDisabled}
            />

            {/* Compact View - Controls or Connecting State */}
            {!isExpanded && (
                <>
                    {areControlsDisabled ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '12px 16px',
                                height: '56px',
                                color: 'var(--center-channel-color)',
                                fontSize: '14px',
                                fontWeight: 500,
                            }}
                        >
                            <i
                                className='icon icon-spinner icon-spin'
                                style={{
                                    marginRight: '8px',
                                    fontSize: '16px',
                                }}
                            />
                            {'Connecting...'}
                        </div>
                    ) : (
                        <WidgetControls
                            isMicOn={isMicOn}
                            isCameraOn={isCameraOn}
                            onMicToggle={handleMicToggle}
                            onCameraToggle={handleCameraToggle}
                            onEndCall={handleEndCall}
                            onLeaveCall={handleLeaveCall}
                            isHost={isHost}
                            disabled={areControlsDisabled}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default CallWidget;
