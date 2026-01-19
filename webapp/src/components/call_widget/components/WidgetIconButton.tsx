import React from 'react';

interface WidgetIconButtonProps {
    iconClassName: string;
    onClick?: () => void;
    title?: string;
    danger?: boolean;
    disabled?: boolean;
}

const WidgetIconButton: React.FC<WidgetIconButtonProps> = ({
    iconClassName,
    onClick,
    title,
    danger = false,
    disabled = false,
}) => {
    return (
        <button
            onClick={(e) => {
                if (e) {
                    e.stopPropagation();
                }
                if (!disabled) {
                    onClick?.();
                }
            }}
            className={`daakia-widget-button ${danger ? 'daakia-widget-button--danger' : ''}`}
            title={title}
            disabled={disabled}
            style={{
                color: danger ? 'var(--error-text)' : 'rgba(var(--center-channel-color-rgb), 0.72)',
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
            }}
        >
            <i className={iconClassName}/>
        </button>
    );
};

export default WidgetIconButton;
