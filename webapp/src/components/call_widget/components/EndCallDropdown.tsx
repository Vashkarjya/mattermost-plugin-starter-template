import React, {useState, useRef, useEffect} from 'react';

import WidgetIconButton from './WidgetIconButton';

interface EndCallDropdownProps {
    isHost: boolean;
    onEndCall: () => void;
    onLeaveCall: () => void;
    disabled?: boolean;
}

const EndCallDropdown: React.FC<EndCallDropdownProps> = ({
    isHost,
    onEndCall,
    onLeaveCall,
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({top: 0, right: 0});

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        if (!disabled) {
            if (!isOpen && buttonRef.current) {
                // Calculate position for dropdown when opening
                const rect = buttonRef.current.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.top, // Button's top position
                    right: window.innerWidth - rect.right, // Distance from right edge
                });
            }
            setIsOpen(!isOpen);
        }
    };

    const handleEndCall = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setIsOpen(false);
        onEndCall();
    };

    const handleLeaveCall = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setIsOpen(false);
        onLeaveCall();
    };

    // If not host, show simple button (no dropdown)
    if (!isHost) {
        return (
            <WidgetIconButton
                iconClassName='icon icon-phone-hangup'
                onClick={onLeaveCall}
                title='Leave call'
                danger={true}
                disabled={disabled}
            />
        );
    }

    return (
        <>
            <div
                ref={buttonRef}
                style={{
                    position: 'relative',
                }}
            >
                <WidgetIconButton
                    iconClassName='icon icon-phone-hangup'
                    onClick={handleToggle}
                    title='End call options'
                    danger={true}
                    disabled={disabled}
                />
            </div>
            {isOpen && (
                <>
                    {/* Backdrop to close dropdown */}
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 100000,
                        }}
                        onClick={() => setIsOpen(false)}
                    />
                    {/* Dropdown menu */}
                    <div
                        ref={dropdownRef}
                        style={{
                            position: 'fixed',
                            top: `${dropdownPosition.top}px`, // Button's top position
                            right: `${dropdownPosition.right}px`,
                            transform: 'translateY(-100%)', // Position above the calculated point
                            background: 'var(--center-channel-bg)',
                            border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
                            borderRadius: '4px',
                            boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.16)',
                            minWidth: '160px',
                            zIndex: 100001,
                            overflow: 'hidden',
                        }}
                        onClick={(e) => {
                            // Prevent backdrop click from closing dropdown when clicking inside
                            e.stopPropagation();
                        }}
                    >
                        <button
                            onClick={handleEndCall}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--error-text)',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(var(--error-text-rgb), 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <i className='icon icon-phone-hangup'/>
                            <span>{'End call for everyone'}</span>
                        </button>
                        <div
                            style={{
                                height: '1px',
                                background: 'rgba(var(--center-channel-color-rgb), 0.16)',
                                margin: '4px 0',
                            }}
                        />
                        <button
                            onClick={handleLeaveCall}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--center-channel-color)',
                                fontSize: '14px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(var(--center-channel-color-rgb), 0.08)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <i className='icon icon-sign-out'/>
                            <span>{'Leave call'}</span>
                        </button>
                    </div>
                </>
            )}
        </>
    );
};

export default EndCallDropdown;
