const utils = require('../../services/url/utils');
const urlService = require('../../services/url');
const settingsCache = require('../../services/settings/cache');

function handleImageUrl(url) {
    return urlService.utils.urlFor('image', { image: url }, true);
}

module.exports = (post) => {
    const blogUrl = utils.getBlogUrl();
    const postUrl = `${blogUrl}${post.slug}`;
    const collaborateUrl = `${blogUrl}/ghost/editor/post/${post.id}`;
    const actions = [
        {
            "type": "button",
            "text": "View",
            "url": postUrl
        }
    ];
    if(post.discussion_room_id && post.discussion_room_name) {
        actions.push({
            "type": "button",
            "text": "Discussion",
            "url": `/channel/${post.discussion_room_name}`
        });
    }

    if (post.collaborate) {
        actions.push({
            "type": "button",
            "text": "Collaborate",
            "url": collaborateUrl,
        });
    }
    let image = post.rc_image ? post.rc_image : (post.feature_image ? post.feature_image : settingsCache.get('cover_image'));
    image = handleImageUrl(image);
    let shortDescription = post.html.replace(/<[^>]*>?/gm, ' ');
    shortDescription = shortDescription.length > 500 ? `${shortDescription.substring(1, 500)}...` : shortDescription;
    return {
        "alias": settingsCache.get('title'),
        "avatar": handleImageUrl(settingsCache.get('icon')),
        "roomId": post.room_id,
        "userId": post.primary_author.rc_id,
        "text": `@here: @${post.primary_author.rc_username} published an article`,
        "attachments": [
            {
                "title": post.rc_title || post.title,
                "description": post.rc_description || shortDescription,
                "image_url": image,
                "button_alignment": "horizontal",
                "actions": actions
            }
        ]
    };
}

