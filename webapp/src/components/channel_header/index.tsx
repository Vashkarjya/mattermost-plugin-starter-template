import React, {useState, useEffect} from 'react';
import styled from 'styled-components';

interface ChannelHeaderButtonProps {
    channel?: {
        id: string;
    };
}

const ChannelHeaderButton: React.FC<ChannelHeaderButtonProps> = ({channel}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [hasActiveCall, setHasActiveCall] = useState(false);

    useEffect(() => {
        if (!channel?.id) {
            return () => {};
        }

        // Listen for call started events
        const handleCallStarted = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail?.channel_id === channel.id) {
                setHasActiveCall(true);
            }
        };

        // Listen for call ended events
        const handleCallEnded = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail?.channel_id === channel.id) {
                setHasActiveCall(false);
            }
        };

        // Listen for loading state from startCall
        const handleCallLoading = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail?.channelId === channel.id) {
                setIsLoading(customEvent.detail?.loading || false);
            }
        };

        window.addEventListener('daakia-call-started', handleCallStarted);
        window.addEventListener('daakia-call-ended', handleCallEnded);
        window.addEventListener('daakia-call-loading', handleCallLoading);

        return () => {
            window.removeEventListener('daakia-call-started', handleCallStarted);
            window.removeEventListener('daakia-call-ended', handleCallEnded);
            window.removeEventListener('daakia-call-loading', handleCallLoading);
        };
    }, [channel?.id]);

    const getButtonTitle = () => {
        if (isLoading) {
            return 'Loading meeting...';
        }
        if (hasActiveCall) {
            return 'Call in progress';
        }
        return 'Start Call';
    };

    const renderButtonContent = () => {
        if (isLoading) {
            return (
                <>
                    <LoadingIcon className='icon icon-loading-outline icon-spin'/>
                    <CallButtonText>{'Loading...'}</CallButtonText>
                </>
            );
        }

        if (hasActiveCall) {
            return (
                <>
                    <PhoneIcon className='icon icon-phone'/>
                    <CallButtonText>{'Call in progress'}</CallButtonText>
                </>
            );
        }

        return (
            <>
                <PhoneIcon className='icon icon-phone-outline'/>
                <CallButtonText>{'Call'}</CallButtonText>
            </>
        );
    };

    return (
        <CallButton
            id='daakia-calls-button'
            className='style--none call-button'
            disabled={isLoading || hasActiveCall}
            $isActive={hasActiveCall}
            $isLoading={isLoading}
            title={getButtonTitle()}
            aria-label={getButtonTitle()}
        >
            {renderButtonContent()}
        </CallButton>
    );
};

const CallButton = styled.button<{$isActive?: boolean; $isLoading?: boolean}>`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.04)')};
    color: ${(props) => (props.$isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.75)')};
    cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
    opacity: ${(props) => (props.disabled ? 0.5 : 1)};
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.88);
    }

    &:active:not(:disabled) {
        background: rgba(var(--center-channel-color-rgb), 0.12);
    }
`;

const PhoneIcon = styled.i`
    font-size: 14px;
    line-height: 14px;
    color: inherit;

    &::before {
        margin: 0;
    }
`;

const LoadingIcon = styled.i`
    font-size: 16px;
    line-height: 16px;
    color: inherit;

    &::before {
        margin: 0;
    }
`;

const CallButtonText = styled.span`
    padding: 1px 0;
    margin: 0 6px;
    font-size: 12px;
    font-weight: 600;
    line-height: 9px;
    color: inherit;
`;

export default ChannelHeaderButton;
