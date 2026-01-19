import React from 'react';
import './incoming_call_notification.scss';

interface IncomingCallProps {
    callerName: string;
    callerAvatarUrl: string;
    onAnswer: () => void;
    onDecline: () => void;
}

const IncomingCallNotification: React.FC<IncomingCallProps> = ({
    callerName,
    callerAvatarUrl,
    onAnswer,
    onDecline,
}) => {
    return (
        <div
            className='daakia-incoming-call-banner'
            data-testid='daakia-incoming-call-banner'
        >
            <div className='daakia-incoming-call-banner__inner'>
                {/* Top section: Avatar + Caller info */}
                <div className='daakia-incoming-call-banner__top'>
                    <div className='daakia-incoming-call-banner__avatar-container'>
                        {callerAvatarUrl ? (
                            <img
                                src={callerAvatarUrl}
                                alt={callerName}
                                className='daakia-incoming-call-banner__avatar'
                            />
                        ) : (
                            <div className='daakia-incoming-call-banner__avatar-placeholder'>
                                {callerName.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className='daakia-incoming-call-banner__ring-indicator'/>
                    </div>
                    <div className='daakia-incoming-call-banner__info'>
                        <div className='daakia-incoming-call-banner__call-label'>
                            <i className='icon icon-phone'/>
                            <span>{'Incoming call'}</span>
                        </div>
                        <div className='daakia-incoming-call-banner__caller-name'>
                            {callerName}
                        </div>
                    </div>
                </div>

                {/* Bottom section: Action buttons */}
                <div className='daakia-incoming-call-banner__bottom'>
                    <button
                        className='daakia-incoming-call-banner__button daakia-incoming-call-banner__button--ignore'
                        data-testid='daakia-incoming-call-dismiss'
                        onClick={(e) => {
                            e.stopPropagation();
                            onDecline();
                        }}
                        aria-label='Ignore call'
                    >
                        <i className='icon icon-close'/>
                    </button>
                    <button
                        className='daakia-incoming-call-banner__button daakia-incoming-call-banner__button--join'
                        onClick={(e) => {
                            e.stopPropagation();
                            onAnswer();
                        }}
                        aria-label='Join call'
                    >
                        <i className='icon icon-phone-in-talk'/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IncomingCallNotification;
