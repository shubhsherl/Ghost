const debug = require('ghost-ignition').debug('api:v2:utils:serializers:output:rcapi');

module.exports = {
    browse(models, apiConfig, frame) {
        debug('browse');

        if (!models) {
            return;
        }

        frame.response = {
            data : [models]
        };

        debug(frame.response);
    },

    collaborate(models, apiConfig, frame) {
        debug('collaborate');

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
