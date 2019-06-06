const debug = require('ghost-ignition').debug('api:v2:utils:serializers:output:rcapi');

module.exports = {
    all(models, apiConfig, frame) {
        debug('all');

        if (!models) {
            return;
        }
        console.log(models)
        frame.response = {
            data : [models]
        };

        debug(frame.response);
    }
};
