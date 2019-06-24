const models = require('../../models');
const settingsCache = require('../../services/settings/cache');
const ALLOWED_INCLUDES = [];

function getParams(data) {
    switch (data.event) {
    case 'roomName':
        return {name: data.name};
    case 'roomType':
        return {type: data.type};
    case 'userName':
        return {rc_username: data.username};
    case 'userEmail':
        return {email: data.email};
    case 'userAvatar':
        return {profile_image: data.avatar};
    case 'userRealname':
        return {name: data.name};
    default:
        return {};
    }
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
            const token = `${frame.original.params.id}/${frame.original.params.token}`;
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
                models.Room.findOne({rid: data.room_id}).then((model) => {
                    if (model) {
                        model.save(getParams(data), {method: 'update'});
                    }
                });
                break;
            case 'userName':
            case 'userEmail':
            case 'userAvatar':
            case 'userRealname':
                models.User.findOne({rc_id: data.user_id}).then((model) => {
                    if (model) {
                        model.save(getParams(data), {method: 'update'});
                    }
                });
                break;
            case 'siteTitle':
                models.Settings.findOne({key: 'title'}).then((s) => {
                    if (s) {
                        s.save({value: data.title}, {method: 'update'});
                    }
                });
                break;
            }
        }
    }
};
