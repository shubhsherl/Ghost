const rcUtils = require('./utils/rc-utils');
const ALLOWED_INCLUDES = [];

module.exports = {
    docName: 'rcapi',

    browse: {
        options: [
            'include',
            'uname',
            'rname',
            'page',
            'limit',
            'fields',
            'filter',
            'order',
            'debug'
        ],
        validation: {
            options: {
                include: ALLOWED_INCLUDES,
            }
        },
        permissions: false,
        query(frame) {
            let username = frame.options.uname;
            let roomname = frame.options.rname;
            if (username)
                return rcUtils.validateUser(frame.original.rc_uid, frame.original.rc_token, username)
                    .then((user) => {
                        return user;
                    });
            return rcUtils.validateRoom(frame.original.rc_uid, frame.original.rc_token, roomname)
                .then((room) => {
                    return room;
                });
        }
    },

    discussion: {
        options: [],
        data: ['room'],
        validation: {
            options: {
                include: ALLOWED_INCLUDES,
            }
        },
        permissions: false,
        query(frame) {
            const username = frame.user.get('rc_username');
            const {title} = frame.data.room[0];
            return rcUtils.createDiscussion(frame.original.rc_uid, frame.original.rc_token, title, username)
                .then((room) => {
                    return room;
                });
        }
    },

    collaborate: {
        options: [],
        data: [
            'collaboration'
        ],
        validation: {
            options: {
                include: ALLOWED_INCLUDES,
            }
        },
        permissions: false,
        query(frame) {
            const {rc_id, post_id, post} = frame.data.collaboration[0]
            
            return rcUtils.collaborate(frame.original.rc_uid, frame.original.rc_token, rc_id, post_id, post)
                .then((res) => {
                    return res;
                });
        }
    }
};
