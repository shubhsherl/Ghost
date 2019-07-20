const settingsCache = require('../../../../services/settings/cache');

module.exports = {

    getRCUrl() {
        return settingsCache.get('server_url');
    },

    buildMeUrl(url = null) {
        const base = url || this.getRCUrl();
        return base + '/api/v1/me';
    },

    buildUserQuery(username) {
        return this.getRCUrl() + '/api/v1/users.info?' + `username=${username}`;
    },

    buildRoomQuery(roomname) {
        return this.getRCUrl() + '/api/v1/rooms.info?' + `roomName=${roomname}`;
    },

    buildParentRoomQuery() {
        return this.getRCUrl() + '/api/v1/im.create';
    },

    buildDiscussionUrl() {
        return this.getRCUrl() + '/api/v1/rooms.createDiscussion';
    },

    getHeader(id, token) {
        return {
            'X-Auth-Token': token,
            'X-User-Id': id
        };
    }
}