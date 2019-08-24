const _ = require('lodash'),
    rcMongo = require('../../data/rc-mongo'),
    settingsCache = require('../../services/settings/cache');



/**
 * Returns a verified email, if exist
 * @return {String}
 */
function getVerifiedEmail(emails) {
    let email = emails[0].address;
    _.forEach(emails, (e) => {
        if(e.verified)
            email = e.address;
    });
    return email;
}

/**
 * Returns avatarUrl
 *
 * @return {String}
 */
function getAvatar(username, url) {
    if (!url) {
        url = settingsCache.get('server_url');
    }
    return `${url.replace(/\/$/, '')}/avatar/${username}`;
}

// Pass array of objects with id and get object with key :id
function parseArrayToObject(array) {
    let object = {};
    _.each(array, (user) =>{
        object[user._id] = user;
    });
    return object;
}

users = async function getUsers(models) {
    if(!models) {
        return models;
    }
    const rc_uids = _.map(models.data, (model) => {return model.attributes.rc_id});
    const rcUsers = await rcMongo.getUser({_id: {$in: rc_uids}});
    if(!rcUsers.error) {
        const userObjects = parseArrayToObject(rcUsers);
        models.data = _.map(models.data, (model) => {
            const id = model.attributes.rc_id;
            if (userObjects[id]) {
                model.attributes.name = userObjects[id].name;
                model.attributes.email = getVerifiedEmail(userObjects[id].emails);
                model.attributes.rc_username = userObjects[id].username;
                model.attributes.profile_image = getAvatar(userObjects[id].username);
            }
            return model;
        });
    }
    return models;
}

user = async function getUser(model) {
    if(!model) {
        return model;
    }

    const rcUser = await rcMongo.getUser({_id: model.get('rc_id')});

    if (!rcUser.error && rcUser[0]) {
        model.attributes.rc_username = rcUser[0].username;
        model.attributes.name = rcUser[0].name;
        model.attributes.email = getVerifiedEmail(rcUser[0].emails);
        model.attributes.profile_image = getAvatar(rcUser[0].username);
    }
    return model;
}

authors = async function getAuthors(model) {
    if(!model) {
        return model;
    }
    let authors = model.related('authors');
    let rc_uids = [];
    
    _.each(authors.models, (model) => {
        rc_uids.push(model.get('rc_id'));
    });

    const rcUsers = await rcMongo.getUser({_id: {$in: rc_uids}});

    if(!rcUsers.error) {
        const userObjects = parseArrayToObject(rcUsers);
        _.each(authors.models, (model) => {
            const id = model.attributes.rc_id;
            if (userObjects[id]) {
                model.attributes.name = userObjects[id].name;
                model.attributes.email = getVerifiedEmail(userObjects[id].emails);
                model.attributes.rc_username = userObjects[id].username;
                model.attributes.profile_image = getAvatar(userObjects[id].username);
            }
        });
    }
    return model;
}

module.exports.user = user;
module.exports.users = users;
module.exports.authors = authors;