const Promise = require('bluebird');
const request = require('request');
const settingsCache = require('../../../services/settings/cache');
const common = require('../../../lib/common');

function getRCUrl() {
    return settingsCache.get('server_url');
}

function buildMeUrl(url = null) {
    const base = url || getRCUrl();
    return base + '/api/v1/me';
}

function buildUserQuery(username) {
    return getRCUrl() + '/api/v1/users.info?' + `username=${username}`;
}

function buildRoomQuery(roomname) {
    return getRCUrl() + '/api/v1/rooms.info?' + `roomName=${roomname}`;
}

function getHeader(id, token) {
    return {
        'X-Auth-Token': token,
        'X-User-Id': id
    };
}

module.exports = {
    checkAdmin(url, id, token) {
        let user;
        return new Promise((resolve) => {
            request.get({ url: buildMeUrl(url), headers: getHeader(id, token) }, function (e, r, body) {
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
            request.get({ url: buildUserQuery(username), headers: getHeader(id, token) }, function (e, r, body) {
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
            request.get({ url: buildMeUrl(), headers: getHeader(id, token) }, function (e, r, body) {
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
            request.get({ url: buildUserQuery(userName), headers: getHeader(id, token) }, function (e, r, body) {
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

    validateRoom(id, token, roomName) {
        let room;
        return new Promise((resolve) => {
            request.get({ url: buildRoomQuery(roomName), headers: getHeader(id, token) }, function (e, r, body) {
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
