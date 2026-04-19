import { reddit_dm, reddit_comment } from './reddit.js';
import { x_dm, x_reply } from './x.js';
import { unsupported } from './unsupported.js';

export const drivers = {
    reddit_dm,
    reddit_comment,
    x_dm,
    x_reply,
    facebook_msg:   unsupported('Facebook Graph API does not allow cold DMs. Send manually.'),
    instagram_dm:   unsupported('Instagram requires the user to message your Business account first.'),
    tiktok_comment: unsupported('TikTok has no public comment-post endpoint.'),
};
