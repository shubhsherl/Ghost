const debug = require('ghost-ignition').debug('api:v2:utils:serializers:output:users');
const common = require('../../../../../lib/common');
const mapper = require('./utils/mapper');

module.exports = {
    browse(models, apiConfig, frame) {
        debug('browse');

        frame.response = {
            users: models.data.map(model => mapper.mapUser(model, frame)),
            meta: models.meta
        };

        debug(frame.response);
    },

    exist(model, apiConfig, frame) {
        debug('exist');
        
        if (!model) {
            frame.response = {
                users: [{
                    exist: false
                }]
            };
        } else {
            const user = model.toJSON(frame.options);
            frame.response = {
                users: [{
                    exist: true,
                    status: user.status,
                    slug: user.slug
                }]
            };
        }

        debug(frame.response);
    },

    read(model, apiConfig, frame) {
        debug('read');

        frame.response = {
            users: [mapper.mapUser(model, frame)]
        };

        debug(frame.response);
    },

    edit() {
        debug('edit');
        this.read(...arguments);
    },

    transferOwnership(models, apiConfig, frame) {
        debug('transferOwnership');

        frame.response = {
            users: models.map(model => model.toJSON(frame.options))
        };

        debug(frame.response);
    }
};
