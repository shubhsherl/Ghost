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
        if (v.includes('rc_uid')) {
            id = v.split('=')[1];
        }
        if (v.includes('rc_token')) {
            token = v.split('=')[1];
        }
    });
    return {id, token};
}

function addRoom(room) {
    const params = {rid: room.rid, name: room.roomname, type: room.type};
    models.Room.findOne({rid: room.rid}).then((r) => {
        if (r) {
            r.save(params, {method: 'update'});
        } else {
            models.Room.add(params);
        }
    });
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

function parseBody(body, type) {
    const failResult = {success: false, exist: false, created: false};
    let result;

    if (body) {
        result = JSON.parse(body);
    }
    
    if (!result || !result.success) {
        return failResult;
    }

    switch (type) {
        case 'getUser':
            return result;
        case 'validateUser':
            return {
                exist: true,
                uid: result.user._id,
                username: result.user.username,
            };
        case 'validateRoom':
        case 'validateSelfRoom':
            const r = result.room || result.discussion;
            const room = {
                exist: result.room ? true : false,
                created: result.discussion ? true : false,
                rid: r._id,
                roomname: r.name,
                type: r.t
            };
            if (type === 'validateRoom') {
                addRoom(room);
            }
            return room;
        default:
            return failResult;
    }
}

module.exports = {
    checkAdmin(url, id, token) {
        let user;
        return new Promise((resolve) => {
            request.get({url: api.buildMeUrl(url), headers: api.getHeader(id, token)}, function (e, r, body) {
                user = JSON.parse(body);
                if (user.success) {
                    if (user.roles.indexOf('admin') === -1) {
                        //callee is not admin on RC
                        return Promise.reject(new common.errors.GhostError({
                            message: common.i18n.t('errors.models.user.rc.notAdmin')
                        }));
                    }
                } else {
                    return Promise.reject(new common.errors.GhostError({
                        message: common.i18n.t('errors.models.user.rc.unableToFetch')
                    }));
                }
                resolve(user);
            });
        });
    },

    getUser(id, token, username) {
        return new Promise((resolve) => {
            request.get({url: api.buildUserQueryByToken(), form: {username}, headers: api.getHeader(id, token)}, function (e, r, body) {
                resolve(parseBody(body, 'getUser'));
            });
        });
    },

    getMe(id, token) {
        return new Promise((resolve) => {
            request.get({url: api.buildMeUrl(), headers: api.getHeader(id, token)}, function (e, r, body) {
                resolve(parseBody(body, 'getUser'));
            });
        });
    },

    validateUser(id, token, userName) {
        return new Promise((resolve) => {
            request.get({url: api.buildUserQuery(userName), headers: api.getHeader(id, token)}, function (e, r, body) {
                resolve(parseBody(body, 'validateUser'));
            });
        });
    },

    createSession(req) {
        const { id, token } = getIdToken(req);
        if (!id || !token)
            return req;
        return models.User.findOne({rc_id: id}).then((user) => {
            if (!user || user.get('status') === 'inactive') {
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

        return models.Post.findOne({id: postId, collaborate: 1}, getOptions(post.authors[0])).then((p) => {
            
            if (!p || id !== rcId || !settingsCache.get('can_collaborate')) {
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
        return new Promise((resolve) => {
            request.get({url: api.buildRoomQuery(roomName), headers: api.getHeader(id, token)}, function (e, r, body) {
                resolve(parseBody(body, 'validateRoom'));
            });
        });
    },

    getSelfRoom(id, token, username) {
        return new Promise((resolve) => {
            request.post({url: api.buildParentRoomQuery(), form: {"username": username}, headers: api.getHeader(id, token)}, function (e, r, body) {
                resolve(parseBody(body, 'validateSelfRoom'));
            });
        });
    },

    createDiscussion(id, token, title, username, type = 'c') {
        const failResult = {created: false};
        
        return new Promise((resolve) => {
            if (!settingsCache.get('is_comments')) {
                resolve(failResult);
            }
            
            this.getSelfRoom(id, token, username).then((room) => {
                if (room.exist) {
                    request.post({url: api.buildDiscussionUrl(), form: {prid: room.rid, t_name: title, t: type}, headers: api.getHeader(id, token)}, function (e, r, body) {
                        resolve(parseBody(body, 'validateRoom'));
                    });
                } else {
                    resolve(failResult);
                }
            });
        });
    },

    validateSubscription(id, token, roomId) {
        let subscription;
        return new Promise((resolve) => {
            request.get({url: api.buildSubscriptionQuery(roomId), headers: api.getHeader(id, token)}, function (e, r, body) {
                let result;

                if (body)
                    result = JSON.parse(body);
                subscription = {exist: result && result.success && !!result.subscription};
                resolve(subscription);
            });
        });
    }

};
