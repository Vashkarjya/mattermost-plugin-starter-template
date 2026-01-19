import React from 'react';

interface LoadingOverlayProps {
    isExpanded: boolean;
    show: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isExpanded,
    show,
}) => {
    if (!isExpanded || !show) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: '60px',
                left: 0,
                width: '100vw',
                height: 'calc(100vh - 60px)',
                background: 'var(--center-channel-bg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                color: 'var(--center-channel-color)',
            }}
        >
            <i
                className='icon icon-spinner icon-spin'
                style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    color: 'rgb(var(--button-bg-rgb))',
                }}
            />
            <div
                style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    marginBottom: '8px',
                }}
            >
                {'Setting up...'}
            </div>
            <div
                style={{
                    fontSize: '14px',
                    opacity: 0.72,
                }}
            >
                {'Great things are about to happen'}
            </div>
        </div>
    );
};

export default LoadingOverlay;
