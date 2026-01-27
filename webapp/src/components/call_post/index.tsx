import React from 'react';

import type {Post} from '@mattermost/types/posts';

import {endActiveCall} from '../../hooks/useCalls';

import './call_post.scss';

const CallPost: React.FC<{post: Post}> = ({post}) => {
    const callId = post.id;
    const channelId = post.channel_id;
    const isCallActive = post.props?.call_active as boolean;
    const meetingUrl = post.props?.meeting_url as string;

    const handleEndCall = async () => {
        if (callId && channelId) {
            await endActiveCall(callId, channelId);
        }
    };

    const handleJoinCall = () => {
        if (meetingUrl) {
            window.open(meetingUrl, '_blank');
        }
    };

    // Use standard post-message structure to inherit ALL modern post styling
    return (
        <div className='post-message'>
            <div
                className='post-message__text'
                dir='auto'
            >
                <div className='daakia-call-content'>
                    <div className='daakia-call-icon'>
                        <i className='icon icon-phone'/>
                    </div>
                    <div className='daakia-call-info'>
                        <span className='daakia-call-title'>
                            {post.message ? post.message : 'Call started'}
                        </span>
                        <div className='daakia-call-buttons'>
                            {meetingUrl && (
                                <button
                                    className='daakia-call-join-btn'
                                    onClick={handleJoinCall}
                                >
                                    <i className='icon icon-phone-outline'/>
                                    {'Join'}
                                </button>
                            )}
                            {isCallActive && (
                                <button
                                    className='daakia-call-end-btn'
                                    onClick={handleEndCall}
                                >
                                    <i className='icon icon-phone-hangup'/>
                                    {'End Call'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallPost;
