const models = require('../../models');
const Promise = require('bluebird');
const common = require('../../lib/common');
const settingsCache = require('../../services/settings/cache');
const ALLOWED_INCLUDES = [];

function deleteUser(rc_id) {
    let options = {
        context: {
            internal: false,
            external: false,
            user: '1', // if user is deleted from RC, context user will be Owner.
            api_key: null,
            app: null,
            integration: null,
            public: false,
            is_page: false
        }
    };

    return models.User.findOne({rc_id}).then((user) => {
        if(!user) {
            return;
        }
        options.id = user.get('id');
        return models.Base.transaction((t) => {
            options.transacting = t;
            return Promise.all([
                models.Accesstoken.destroyByUser(options),
                models.Refreshtoken.destroyByUser(options),
                models.Post.destroyByAuthor(options)
            ]).then(() => {
                return models.User.destroy(Object.assign({status: 'all'}, options));
            }).return(null);
        })
    }).catch((err) => {
        return Promise.reject(new common.errors.NoPermissionError({
            err: err
        }));
    });
}

module.exports = {
    docName: 'rhooks',

    callbacks: {
        options: [],
        validation: {
            options: {
                include: ALLOWED_INCLUDES
            }
        },
        permissions: false,
        query(frame) {
            const settingsToken = settingsCache.get('settings_token');
            const {original:{params:{token}}} = frame;
            const {data} = frame;

            if (settingsToken !== token) {
                return {success: false};
            }

            switch (data.event) {
            case 'deleteUser':
                deleteUser(data.user_id);
                break;
            }
        }
    }
};
