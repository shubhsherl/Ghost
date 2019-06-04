const debug = require('ghost-ignition').debug('api:v2:utils:serializers:output:rcapi');

module.exports = {
    all(models, apiConfig, frame) {
        debug('all');

        if (!models) {
            return;
        }
        
        frame.response = {
            rc_users: [models]
        };

        debug(frame.response);
    }
};
