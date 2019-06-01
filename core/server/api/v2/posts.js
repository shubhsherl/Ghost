const models = require('../../models');
const common = require('../../lib/common');
const urlService = require('../../services/url');
const rcUtils = require('./utils/rc-utils');
const allowedIncludes = ['tags', 'authors', 'authors.roles'];
const unsafeAttrs = ['status', 'authors'];

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
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
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
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            return models.Post.findOne(frame.data, frame.options)
                .then((model) => {
                    if (!model) {
                        throw new common.errors.NotFoundError({
                            message: common.i18n.t('errors.api.posts.postNotFound')
                        });
                    }

                    return model;
                });
        }
    },

    add: {
        statusCode: 201,
        headers: {},
        options: [
            'include',
            'source'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                source: {
                    values: ['html']
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            const toAnnounce = frame.data.posts[0].to_announce || false;
            if (toAnnounce) {
                const roomName = frame.data.posts[0].room_name;
                if (!roomName) {
                    return Promise.reject(new common.errors.NotFoundError({
                        message: 'Please provide a roomName to announce.'
                    }));
                    // throw new common.errors.NotFoundError({
                    //     message: 'Please provide a roomName to annoucne.'
                    // });
                } else {
                    let header = {
                        'X-Auth-Token': 'Snhsgh5Q_q6y-ZlhGaN9AIbzN8iGCZEzfLAXNU9Y29G',
                        'X-User-Id': 'AZG7dyTXMJoPhJHE7'
                    };
                    // validate if the room is accessible by user.
                    return rcUtils.validateRoom('https://open.rocket.chat/api/v1/rooms.info', header, roomName)
                        .then((r, err) => {
                            if (err) {
                                errors.push(err);
                            } else if (!r || !r.exist) {
                                return Promise.reject(new common.errors.NotFoundError({
                                    message: 'Room doesnot exist. Make sure you have access to the room.'
                                }));
                                // throw new common.errors.NotFoundError({
                                //     message: 'Room doesnot exist. Make sure you have access to the room.'
                                // });
                            } else if (r.name === roomName) {
                                frame.data.posts[0].room_id = r.rid;
                            }
                            console.log(frame.data.posts[0])
                            return models.Post.add(frame.data.posts[0], frame.options)
                                .then((model) => {
                                    if (model.get('status') !== 'published') {
                                        this.headers.cacheInvalidate = false;
                                    } else {
                                        this.headers.cacheInvalidate = true;
                                    }
                                    return model;
                                });
                        });
                }
            }
            return models.Post.add(frame.data.posts[0], frame.options)
                .then((model) => {
                    if (model.get('status') !== 'published') {
                        this.headers.cacheInvalidate = false;
                    } else {
                        this.headers.cacheInvalidate = true;
                    }

                    return model;
                });
        }
    },

    edit: {
        headers: {},
        options: [
            'include',
            'id',
            'source'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                id: {
                    required: true
                },
                source: {
                    values: ['html']
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            const toAnnounce = frame.data.posts[0].to_announce || false;
            const status = frame.data.posts[0].status;
            if (toAnnounce && status === 'published') {
                const roomName = frame.data.posts[0].room_name;
                if (!roomName) {
                    return Promise.reject(new common.errors.NotFoundError({
                        message: 'Please provide a roomName to announce.'
                    }));
                } else {
                    let header = {
                        'X-Auth-Token': 'Snhsgh5Q_q6y-ZlhGaN9AIbzN8iGCZEzfLAXNU9Y29G',
                        'X-User-Id': 'AZG7dyTXMJoPhJHE7'
                    };
                    // validate if the room is accessible by user.
                    return rcUtils.validateRoom('https://open.rocket.chat/api/v1/rooms.info', header, roomName)
                        .then((r, err) => {
                            if (err) {
                                errors.push(err);
                            } else if (!r || !r.exist) {
                                return Promise.reject(new common.errors.NotFoundError({
                                    message: 'Room doesnot exist. Make sure you have access to the room.'
                                }));
                            } else if (r.name === roomName) {
                                frame.data.posts[0].room_id = r.rid;
                            }
                            console.log(frame.data.posts[0])
                            return models.Post.edit(frame.data.posts[0], frame.options)
                                .then((model) => {
                                    if (
                                        model.get('status') === 'published' && model.wasChanged() ||
                                        model.get('status') === 'draft' && model.previous('status') === 'published'
                                    ) {
                                        this.headers.cacheInvalidate = true;
                                    } else if (
                                        model.get('status') === 'draft' && model.previous('status') !== 'published' ||
                                        model.get('status') === 'scheduled' && model.wasChanged()
                                    ) {
                                        this.headers.cacheInvalidate = {
                                            value: urlService.utils.urlFor({
                                                relativeUrl: urlService.utils.urlJoin('/p', model.get('uuid'), '/')
                                            })
                                        };
                                    } else {
                                        this.headers.cacheInvalidate = false;
                                    }

                                    return model;
                                });
                        });
                }
            }
            console.log(frame.data.posts[0]);
            return models.Post.edit(frame.data.posts[0], frame.options)
                .then((model) => {
                    if (
                        model.get('status') === 'published' && model.wasChanged() ||
                        model.get('status') === 'draft' && model.previous('status') === 'published'
                    ) {
                        this.headers.cacheInvalidate = true;
                    } else if (
                        model.get('status') === 'draft' && model.previous('status') !== 'published' ||
                        model.get('status') === 'scheduled' && model.wasChanged()
                    ) {
                        this.headers.cacheInvalidate = {
                            value: urlService.utils.urlFor({
                                relativeUrl: urlService.utils.urlJoin('/p', model.get('uuid'), '/')
                            })
                        };
                    } else {
                        this.headers.cacheInvalidate = false;
                    }

                    return model;
                });
        }
    },

    destroy: {
        statusCode: 204,
        headers: {
            cacheInvalidate: true
        },
        options: [
            'include',
            'id'
        ],
        validation: {
            options: {
                include: {
                    values: allowedIncludes
                },
                id: {
                    required: true
                }
            }
        },
        permissions: {
            unsafeAttrs: unsafeAttrs
        },
        query(frame) {
            frame.options.require = true;

            return models.Post.destroy(frame.options)
                .return(null)
                .catch(models.Post.NotFoundError, () => {
                    throw new common.errors.NotFoundError({
                        message: common.i18n.t('errors.api.posts.postNotFound')
                    });
                });
        }
    }
};
