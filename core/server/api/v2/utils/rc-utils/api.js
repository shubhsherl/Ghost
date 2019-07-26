const settingsCache = require('../../../../services/settings/cache');

module.exports = {

    getRCUrl() {
        return settingsCache.get('server_url');
    },

    getToken() {
        return settingsCache.get('announce_token');
    },

    buildMeUrl(url = null) {
        const base = url || this.getRCUrl();
        return base + '/api/v1/me';
    },

    buildUserQuery(username) {
        return this.getRCUrl() + '/api/v1/users.info?' + `username=${username}`;
    },

    buildUserQueryByToken() {
        return this.getRCUrl() + '/ghooks/' + this.getToken() + '/getUser';
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
    
    buildSubscriptionQuery(roomId) {
        return this.getRCUrl() + '/api/v1/subscriptions.getOne?' + `roomId=${roomId}`;
    },

    getHeader(id, token) {
        return {
            'X-Auth-Token': token,
            'X-User-Id': id
        };
    }
};