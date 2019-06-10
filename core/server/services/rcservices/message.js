const utils = require('../../services/url/utils');
const urlService = require('../../services/url');
const settingsCache = require('../../services/settings/cache');

function handleImageUrl(url) {
    return urlService.utils.urlFor('image', { image: url }, true);
}

module.exports = (post) => {
    const blogUrl = utils.getBlogUrl();
    console.log(settingsCache.get('icon'));
    let image = post.rc_image ? post.rc_image : (post.feature_image ? post.feature_image : settingsCache.get('cover_image'));
    image = handleImageUrl(image);
    const postUrl = `${blogUrl}/${post.slug}`;
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
                "actions": [
                    {
                        "type": "button",
                        "text": "View",
                        "url": postUrl,
                    }
                ]
            }
        ]
    };
}

