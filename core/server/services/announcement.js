var common = require('../lib/common'),
    request = require('../lib/request'),
    getMessage = require('./rcservices/message'),
    settingsCache = require('./settings/cache'),
    schema = require('../data/schema').checks,

    defaultPostSlugs = [
        'welcome',
        'the-editor',
        'using-tags',
        'managing-users',
        'private-sites',
        'advanced-markdown',
        'themes'
    ];

function getGhook() {
    var rcUrl = settingsCache.get('server_url');
    var announceToken = settingsCache.get('announce_token');
    // This might one day have multiple entries, for now its always a array
    // and we return the first item or an empty object
    return announceToken ? `${rcUrl}/ghooks/${announceToken}` : null;
}

function ping(post) {
    let announcementData = {},
        hook = getGhook();

    // Quit here if announcement token is not present OR user don't want to announce the post
    if (hook && post.announce) {
        // Only ping when not a page
        if (post.page) {
            return;
        }

        // Don't ping for the default posts.
        // This also handles the case where during ghost's first run
        // models.init() inserts this post but permissions.init() hasn't
        // (can't) run yet.
        if (defaultPostSlugs.indexOf(post.slug) > -1) {
            return;
        }

        if (schema.isPost(post)) {
            announcementData = getMessage(post);
        } else {
            announcementData = {};
        }

        return request(hook, {
            body: JSON.stringify(announcementData),
            headers: {
                'Content-type': 'application/json'
            }
        }).catch(function (err) {
            common.logging.error(new common.errors.GhostError({
                err: err,
                context: common.i18n.t('errors.services.ping.requestFailed.error', {service: 'announcement'}),
                help: common.i18n.t('errors.services.ping.requestFailed.help', {url: 'https://docs.ghost.org'})
            }));
        });
    }
}

function listener(model, options) {
    // CASE: do not ping announcement if we import a database
    // TODO: refactor post.published events to never fire on importing
    if (options && options.importing) {
        return;
    }

    ping(model.toJSON());
}

function listen() {
    common.events.on('post.published', listener);
}

// Public API
module.exports = {
    listen: listen
};
