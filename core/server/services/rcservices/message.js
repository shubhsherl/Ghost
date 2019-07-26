const getExcerpt = require('../../data/meta/excerpt');
const imageLib = require('../../lib/image');
const utils = require('../../services/url/utils');
const urlService = require('../../services/url');
const settingsCache = require('../../services/settings/cache');

function handleImageUrl(url) {
    return urlService.utils.urlFor('image', {image: url}, true);
}

module.exports = (post) => {
    const avatar = imageLib.blogIcon.getIconUrl(true);
    const blogUrl = utils.getBlogUrl();
    const postUrl = `${blogUrl}${post.slug}`;
    const collaborateUrl = `${blogUrl}ghost/editor/post/${post.id}`;
    let actions = [{
        type: "button",
        text: "View",
        url: postUrl,
    }];

    if (post.discussion_room_id) {
        actions.push({
            type: 'button',
            text: 'Discussion',
            msg_processing_type: 'openRoom',
            open_room_by_id: true,
            rid: post.discussion_room_id,
        });
    }

    if (post.collaborate)
        actions.push({
            type: "button",
            text: "Collaborate",
            url: collaborateUrl,
        });

    const image = post.rc_image ? post.rc_image : (post.feature_image ? post.feature_image : settingsCache.get('cover_image'));
    const shortDescription = post.html ? getExcerpt(post.html) : 'No Description';
    
    return {
        alias: settingsCache.get('title'),
        avatar: avatar,
        roomId: post.room_id,
        userId: post.primary_author.rc_id,
        text: `@here: @${post.primary_author.rc_username} published an article`,
        attachments: [
            {
                title: post.rc_title || post.title,
                description: post.rc_description || shortDescription,
                image_url: handleImageUrl(image),
                button_alignment: 'horizontal',
                actions: actions
            }
        ]
    };
};

