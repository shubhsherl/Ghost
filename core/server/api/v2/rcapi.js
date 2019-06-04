const rcUtils = require('./utils/rc-utils');
const ALLOWED_INCLUDES = [];

module.exports = {
    docName: 'rcapi',

    browse: {
        options: [
            'include',
            'name',
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
            let username = frame.options.name;

            return rcUtils.validateUser(frame.original.rc_uid, frame.original.rc_token, username)
                .then((user) =>{
                    return user;
                })
        }
    }
};
