const Promise = require('bluebird');
const request = require('request');
const {forEach} = require('lodash');
const models = require('../../../../models');
const common = require('../../../../lib/common');
const settingsCache = require('../../../../services/settings/cache');
const api = require('./api');

function getIdToken(req) {
    let id, token;
    forEach(req.headers.cookie.split(';'), (v) => {
        if (v.includes('rc_uid'))
            id = v.split('=')[1];
        if (v.includes('rc_token'))
            token = v.split('=')[1];
    });
    return { id, token };
}

function getOptions(userId) {
    return {
        context:
        {
            internal: false,
            external: false,
            user: userId,
            api_key: null,
            app: null,
            integration: null,
            public: false
        },
        filter: '(page:false)+status:[published]',
        formats: 'mobiledoc',
        withRelated: ['tags', 'authors']
    };
}

// TODO: should get the embedded relation from client-side
function getpost(model, post, user) {
    let newPost = model.toJSON();
    newPost.authors.push(user.toJSON());
    post.authors = newPost.authors;
    post.tags = newPost.tags;
    return post;
}

module.exports = {
    checkAdmin(url, id, token) {
        let user;
        return new Promise((resolve) => {
            request.get({ url: api.buildMeUrl(url), headers: api.getHeader(id, token) }, function (e, r, body) {
                user = JSON.parse(body);
                if (user.success) {
                    if (user.roles.indexOf('admin') == -1) {
                        //callee is not admin on RC
                        return Promise.reject(new common.errors.GhostError({
                            message: 'Callee is not an admin, cannot Setup Ghost'
                        }));
                    }
                } else {
                    return Promise.reject(new common.errors.GhostError({
                        message: 'Unable to fetch the details'
                    }));
                }
                resolve(user);
            });
        })
    },

    getUser(id, token, username) {
        let user;
        return new Promise((resolve) => {
            request.get({ url: api.buildUserQuery(username), headers: api.getHeader(id, token) }, function (e, r, body) {
                let result;
                if (body)
                    result = JSON.parse(body);
                if (result && result.success) {
                    user = result;
                } else {
                    user = {
                        success: false,
                    };
                }
                resolve(user);
            });
        });
    },

    getMe(id, token) {
        let user;
        return new Promise((resolve) => {
            request.get({ url: api.buildMeUrl(), headers: api.getHeader(id, token) }, function (e, r, body) {
                let result;
                if (body)
                    result = JSON.parse(body);
                if (result && result.success) {
                    user = result;
                } else {
                    user = {
                        success: false,
                    };
                }
                resolve(user);
            });
        });
    },

    validateUser(id, token, userName) {
        let user;
        return new Promise((resolve) => {
            request.get({ url: api.buildUserQuery(userName), headers: api.getHeader(id, token) }, function (e, r, body) {
                let result;
                if (body)
                    result = JSON.parse(body);
                if (result && result.success) {
                    u = result.user;
                    user = {
                        type: 'rc_users',
                        exist: true,
                        uid: u._id,
                        username: u.username,
                    };
                } else {
                    user = {
                        type: 'rc_users',
                        exist: false,
                    };
                }
                resolve(user);
            });
        });
    },

    createSession(req) {
        const { id, token } = getIdToken(req);
        if (!id || !token)
            return req;
        return models.User.findOne({ rc_id: id }).then((user) => {
            if (!user) {
                return req;
            }
            return this.getMe(id, token)
                .then((u) => {
                    if (!u.success) {
                        return req;
                    }
                    req.user = user;
                    return req;
                });
            });
    },

    // post contains the json of post without embedding the relations
    collaborate(id, token, rcId, postId, post) {
        const failResult = {collaborate: false};

        if (id !== rcId || !settingsCache.get('can_collaborate'))
            return failResult;

        return models.Post.findOne({ id: postId, collaborate: 1}, getOptions(post.authors[0])).then((p) => {

            if (!p) {
                return failResult;
            }

            return models.User.findOne({ rc_id: id }).then((user) => {
                if (!user) {
                    return failResult;
                }

                return this.validateSubscription(id, token, p.get('room_id'))
                    .then((s) => {
                        if (s.exist) {
                            return models.Post.edit(getpost(p, post, user), {id: postId}).then((p) => {
                                return {collaborate: true};
                            });
                        } else {
                            return failResult;
                        }
                    });
                });
        })
    },
    
    validateRoom(id, token, roomName) {
        let room;
        return new Promise((resolve) => {
            request.get({ url: api.buildRoomQuery(roomName), headers: api.getHeader(id, token) }, function (e, r, body) {
                let result;

                if (body)
                    result = JSON.parse(body);

                if (result && result.success) {
                    r = result.room;
                    room = {
                        type: 'rc_rooms',
                        exist: true,
                        rid: r._id,
                        roomname: r.name,
                    };
                } else {
                    room = {
                        type: 'rc_rooms',
                        exist: false,
                    };
                }
                resolve(room);
            });
        });
    },

    validateSubscription(id, token, roomId) {
        let subscription;
        return new Promise((resolve) => {
            request.get({ url: api.buildSubscriptionQuery(roomId), headers: api.getHeader(id, token) }, function (e, r, body) {
                let result;

                if (body)
                    result = JSON.parse(body);
                subscription = {exist: result && result.success && !!result.subscription};
                resolve(subscription);
            });
        });
    }

};
