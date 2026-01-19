import React from 'react';

import WidgetIconButton from './WidgetIconButton';

import EndCallDropdown from './EndCallDropdown';

interface WidgetControlsProps {
    isMicOn: boolean;
    isCameraOn: boolean;
    onMicToggle: () => void;
    onCameraToggle: () => void;
    onEndCall: () => void;
    onLeaveCall: () => void;
    isHost: boolean;
    disabled?: boolean;
}

const WidgetControls: React.FC<WidgetControlsProps> = ({
    isMicOn,
    isCameraOn,
    onMicToggle,
    onCameraToggle,
    onEndCall,
    onLeaveCall,
    isHost,
    disabled = false,
}) => {
    return (
        <div
            className='daakia-widget-controls'
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 16px',
                gap: 10,
            }}
        >
            <WidgetIconButton
                iconClassName={`icon ${isMicOn ? 'icon-microphone' : 'icon-microphone-off'}`}
                onClick={onMicToggle}
                title={isMicOn ? 'Mute' : 'Unmute'}
                disabled={disabled}
            />
            <WidgetIconButton
                iconClassName={`icon ${isCameraOn ? 'icon-video-outline' : 'icon-video-off-outline'}`}
                onClick={onCameraToggle}
                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                disabled={disabled}
            />
            <EndCallDropdown
                isHost={isHost}
                onEndCall={onEndCall}
                onLeaveCall={onLeaveCall}
                disabled={disabled}
            />
        </div>
    );
};

export default WidgetControls;
