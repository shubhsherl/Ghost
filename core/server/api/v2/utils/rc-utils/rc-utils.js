const Promise = require('bluebird');
const request = require('request');
const {forEach} = require('lodash');
const models = require('../../../../models');
const rcMongo = require('../../../../data/rc-mongo');
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

function parseResult(result, type) {
    const failResult = {success: false, exist: false, created: false};
    
    if (!result || !result.success) {
        return failResult;
    }

    switch (type) {
        case 'getMe':
            return {
                success: true,
                _id: result._id,
                name: result.name,
                username: result.username,
                emails: result.emails,
                roles: result.roles,
            };
        case 'getUser':
            return result;
        case 'validateUser':
            return {exist: !!result.user};
        case 'getRoom':
            const r = result.room || result.discussion;
            return room = {
                exist: result.room ? true : false,
                created: result.discussion ? true : false,
                rid: r._id || r.rid,
                roomname: r.name,
                type: r.t
            };
        case 'validateSelfRoom':
            const s = result.room;
            return room = {
                exist: true,
                rid: s.rid || s._id,
                roomname: s.name,
                type: s.t
            };
        case 'subscription':
            return {exist: !!result.subscription};
        default:
            return failResult;
    }
}

function parseBody(body, type) {
    let result;
    if (body) {
        result = JSON.parse(body);
    }
    return parseResult(result, type);
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

    // type: getUser, validateUser
    getUser(username, type = 'getUser') {
        return new Promise((resolve) => {
            rcMongo.getUser({username}).then((result) => {
                let user;
                if (!result.error) {
                    user = {success: !!result[0], user: result[0]};
                }
                resolve(parseResult(user, type));
            });
        });
    },

    getMe(id, token) {
        return new Promise((resolve) => {
            request.get({url: api.buildMeUrl(), headers: api.getHeader(id, token)}, function (e, r, body) {
                resolve(parseBody(body, 'getMe'));
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
    collaborate(id, rcId, postId, post) {
        const failResult = {collaborate: false};

        return models.Post.findOne({id: postId, collaborate: 1}, getOptions(post.authors[0])).then((p) => {
            
            if (!p || id !== rcId || !settingsCache.get('can_collaborate')) {
                return failResult;
            }

            return models.User.findOne({ rc_id: id }).then((user) => {
                if (!user) {
                    return failResult;
                }

                return this.validateSubscription(id, p.get('room_id'))
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
    
    getRoom(params) {
        return new Promise((resolve) => {
            rcMongo.getRoom(params).then((result) => {
                let room;
                if (!result.error) {
                    room = {success: !!result[0], room: result[0]};
                }
                resolve(parseResult(room, 'getRoom'));
            });
        });
    },

    getSelfRoom(id, token, username) {
        return new Promise((resolve) => {
            rcMongo.getSelfSubscription({uid: id}).then((result) => {
                if (!result.error && !!result[0]) {
                    const subs = {success: true, room: result[0]};
                    resolve(parseResult(subs, 'validateSelfRoom'));
                    return;
                }
                request.post({url: api.buildParentRoomQuery(), form: {"username": username}, headers: api.getHeader(id, token)}, function (e, r, body) {
                    resolve(parseBody(body, 'validateSelfRoom'));
                });
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
                        resolve(parseBody(body, 'getRoom'));
                    });
                } else {
                    resolve(failResult);
                }
            });
        });
    },

    validateSubscription(uid, rid) {
        return new Promise((resolve) => {
            rcMongo.getSubscription({rid, uid}).then((result) => {
                let subs;
                if (!result.error) {
                    subs = {success: !!result[0], subscription: result[0]};
                }
                resolve(parseResult(subs, 'subscription'));
            });
        });
    }

};
