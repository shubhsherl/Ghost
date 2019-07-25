const models = require('../../models');
const Promise = require('bluebird');
const common = require('../../lib/common');
const settingsCache = require('../../services/settings/cache');
const ALLOWED_INCLUDES = [];

function getParams(data) {
    const url = settingsCache.get('server_url').replace(/\/$/, '');
    switch (data.event) {
    case 'roomName':
        return {name: data.name};
    case 'roomType':
        return {type: data.type};
    case 'userName':
        return {rc_username: data.username, profile_image: `${url}/avatar/${data.username}`};
    case 'userEmail':
        return {email: data.email};
    case 'userRealname':
        return {name: data.name};
    default:
        return {};
    }
}

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
            const defaultRoom = settingsCache.get('room_id');
            const {original:{params:{token}}} = frame;
            const {data} = frame;

            if (settingsToken !== token) {
                return {success: false};
            }

            switch (data.event) {
            case 'roomName':
                if (defaultRoom === data.room_id) {
                    models.Settings.findOne({key: 'room_name'}).then((s) => {
                        if (s) {
                            s.save({value: data.name}, {method: 'update'});
                        }
                    });
                }
            case 'roomType':
                if (data.room_id) {
                    models.Room.findOne({rid: data.room_id}).then((model) => {
                        if (model) {
                            model.save(getParams(data), {method: 'update'});
                        }
                    });
                }
                break;
            case 'userName':
            case 'userEmail':
            case 'userRealname':
                models.User.findOne({rc_id: data.user_id}).then((model) => {
                    if (model) {
                        model.save(getParams(data), {method: 'update'});
                    }
                });
                break;
            case 'deleteUser':
                deleteUser(data.user_id);
                break;
            case 'siteTitle':
                models.Settings.findOne({key: 'title'}).then((s) => {
                    if (s && s.get('value') !== data.title) {
                        s.save({value: data.title}, {method: 'update'});
                    }
                });
                break;
            }
        }
    }
};
