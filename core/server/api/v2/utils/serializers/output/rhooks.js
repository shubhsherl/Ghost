const debug = require('ghost-ignition').debug('api:v2:utils:serializers:output:rcapi');

module.exports = {
    all(models, apiConfig, frame) {
        debug('all');

        if (!models) {
            return;
        }
        frame.response = {
            success: true
        };

        debug(frame.response);
    }
};
