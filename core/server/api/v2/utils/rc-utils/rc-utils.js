const Promise = require('bluebird');
const request = require('request');
const {forEach} = require('lodash');
const models = require('../../../../models');
const common = require('../../../../lib/common');
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
    }
};
