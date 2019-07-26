const {forEach} = require('lodash');

/**
 * @description set rc_uid and rc_token from req to frame.
 * @param {String} cookie
 * @returns {*}
 */
function getOriginalValues(headers) {
    const {cookie} = headers;
    let rcUid, rcToken;

    if (cookie) {
        forEach(cookie.split(';'), (v) => {
            if (v.includes('rc_uid')) {
                rcUid = v.split('=')[1];
            }
            if (v.includes('rc_token')) {
                rcToken = v.split('=')[1];
            }
        });
    }
    return {rc_uid: rcUid, rc_token: rcToken};
}

module.exports = getOriginalValues;