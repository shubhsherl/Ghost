const rcUtils = require('./utils/rc-utils');
const ALLOWED_INCLUDES = [];

module.exports = {
    docName: 'rcapi',

    browse: {
        options: [
            'include',
            'uname',
            'rname',
            'rid',
            'page',
            'limit',
            'fields',
            'filter',
            'order',
            'debug'
        ],
        validation: {
            options: {
                include: ALLOWED_INCLUDES
            }
        },
        permissions: false,
        query(frame) {
            const {uname, rname, rid} = frame.options;
            if (uname) {
                return rcUtils.getUser(uname, 'validateUser')
                    .then((user) => {
                        return user;
                    });
            }
            if (rname) {
                return rcUtils.getRoom({name: rname})
                    .then((room) => {
                        return room;
                    });
            }
            return rcUtils.getRoom({_id: rid})
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
                include: ALLOWED_INCLUDES
            }
        },

        permissions: false,
        query(frame) {
            const username = frame.user.get('rc_username');
            const { title, type } = frame.data.room[0];
            return rcUtils.createDiscussion(frame.original.rc_uid, frame.original.rc_token, title, username, type)
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

            return rcUtils.collaborate(frame.original.rc_uid, rc_id, post_id, post)
                .then((res) => {
                    return res;
                });
        }
    }
};
