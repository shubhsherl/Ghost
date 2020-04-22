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
    }
};
