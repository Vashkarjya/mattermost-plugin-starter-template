import React from 'react';

import type {Post} from '@mattermost/types/posts';

import './call_post.scss';

const CallPost: React.FC<{post: Post}> = ({post}) => {
    const meetingUrl = post.props?.meeting_url as string;

    const handleJoinCall = () => {
        if (meetingUrl) {
            // Only show widget, don't open new window
            window.dispatchEvent(new CustomEvent('daakia-join-call', {
                detail: {
                    meetingUrl,
                },
            }));
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
                        {meetingUrl && (
                            <div className='daakia-call-buttons'>
                                <button
                                    className='daakia-call-join-btn'
                                    onClick={handleJoinCall}
                                >
                                    <i className='icon icon-phone-outline'/>
                                    {'Join'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CallPost;
