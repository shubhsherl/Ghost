const models = require('../../models');
const common = require('../../lib/common');
const rcUtils = require('./utils/rc-utils');
const settingsCache = require('../../services/settings/cache');
const allowedIncludes = ['tags', 'authors'];

module.exports = {
    docName: 'posts',

    browse: {
        options: [
            'include',
            'filter',
            'fields',
            'formats',
            'limit',
            'order',
            'page',
            'debug',
            'absolute_urls'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                formats: {
                    values: models.Post.allowedFormats
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.Post.findPage(frame.options);
        }
    },

    read: {
        options: [
            'include',
            'fields',
            'formats',
            'debug',
            'absolute_urls'
        ],
        data: [
            'id',
            'slug',
            'uuid'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                formats: {
                    values: models.Post.allowedFormats
                }
            }
        },
        permissions: true,
        query(frame) {
            function getModelWithDiscussionRoom(model) {
                const rid = model.get('discussion_room_id');
                if (rid) {
                    return models.Room.findOne({rid: rid}).then((d) => {
                        if (d) {
                            const url = `${settingsCache.get('server_url')}/${d.get('type')==='p'?'group':'channel'}/${d.get('name')}`;
                            model.attributes.discussion_room = url;
                        }
                        return model;
                    });
                }
                return model;
            }
            return models.Post.findOne(frame.data, frame.options)
                .then((model) => {
                    if (!model) {
                        throw new common.errors.NotFoundError({
                            message: common.i18n.t('errors.api.posts.postNotFound')
                        });
                    }
                    if (model.get('is_private') && model.get('room_id')) {
                        return rcUtils.validateSubscription(frame.original.rc_uid, frame.original.rc_token, model.get('room_id'))
                            .then((s) => {
                                if(s.exist) {
                                    return getModelWithDiscussionRoom(model);
                                }
                                throw new common.errors.NotFoundError({
                                    message: common.i18n.t('errors.api.posts.postNotFound')
                                });
                            });
                    }
                    return getModelWithDiscussionRoom(model);
                });
        }
    }
};
