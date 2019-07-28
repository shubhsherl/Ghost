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
        });
    },

    getUser(id, token, username) {
        let user;
        return new Promise((resolve) => {
            request.get({url: api.buildUserQuery(username), headers: api.getHeader(id, token)}, function (e, r, body) {
                let result;
                if (body) {
                    result = JSON.parse(body);
                }
                if (result && result.success) {
                    user = result;
                } else {
                    user = {
                        success: false
                    };
                }
                resolve(user);
            });
        });
    },

    getMe(id, token) {
        let user;
        return new Promise((resolve) => {
            request.get({url: api.buildMeUrl(), headers: api.getHeader(id, token)}, function (e, r, body) {
                let result;
                if (body) {
                    result = JSON.parse(body);
                }
                if (result && result.success) {
                    user = result;
                } else {
                    user = {
                        success: false
                    };
                }
                resolve(user);
            });
        });
    },

    validateUser(id, token, userName) {
        let user;
        return new Promise((resolve) => {
            request.get({url: api.buildUserQuery(userName), headers: api.getHeader(id, token)}, function (e, r, body) {
                let result;
                if (body) {
                    result = JSON.parse(body);
                }
                if (result && result.success) {
                    const u = result.user;
                    user = {
                        exist: true,
                        uid: u._id,
                        username: u.username
                    };
                } else {
                    user = {
                        exist: false
                    };
                }
                resolve(user);
            });
        });
    },

    createSession(req) {
        const {id, token} = getIdToken(req);
        if (!id || !token) {
            return req;
        }
        return models.User.findOne({rc_id: id}).then((user) => {
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
    
    validateRoom(id, token, roomName) {
        let room;
        return new Promise((resolve) => {
            request.get({url: api.buildRoomQuery(roomName), headers: api.getHeader(id, token)}, function (e, r, body) {
                let result;

                if (body) {
                    result = JSON.parse(body);
                }

                if (result && result.success) {
                    r = result.room;
                    room = {
                        exist: true,
                        rid: r._id,
                        roomname: r.name,
                        type: r.t
                    };
                    addRoom(room);
                } else {
                    room = {
                        exist: false
                    };
                }
                resolve(room);
            });
        });
    },

    getSelfRoom(id, token, username) {
        let room;
        return new Promise((resolve) => {
            request.post({url: api.buildParentRoomQuery(), form: {username: username}, headers: api.getHeader(id, token)}, function (e, r, body) {
                let result;
                
                if (body) {
                    result = JSON.parse(body);
                }
                if (result && result.success) {
                    r = result.room;
                    room = {
                        exist: true,
                        rid: r._id
                    };
                } else {
                    room = {
                        exist: false
                    };
                }
                resolve(room);
            });
        });
    },

    createDiscussion(id, token, title, username, type = 'c') {
        const failResult = {created: false};
        
        let response;
        return new Promise((resolve) => {
            if (!settingsCache.get('is_comments')) {
                resolve(failResult);
            }
            
            this.getSelfRoom(id, token, username).then((room) => {
                if (room.exist) {
                    request.post({url: api.buildDiscussionUrl(), form: {prid: room.rid, t_name: title, t: type}, headers: api.getHeader(id, token)}, function (e, r, body) {
                        let result;

                        if (body) {
                            result = JSON.parse(body);
                        }
                        if (result && result.success) {
                            r = result.discussion;
                            response = {
                                created: true,
                                rid: r._id,
                                roomname: r.name,
                                type: r.t
                            };
                            addRoom(response);
                        } else {
                            response = failResult;
                        }
                        resolve(response);
                    });
                } else {
                    resolve(failResult);
                }
            });
        });
    }
};
