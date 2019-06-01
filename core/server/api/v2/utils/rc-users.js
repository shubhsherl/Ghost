const Promise = require('bluebird');
const request = require('request');
const common = require('../../../lib/common');
const models = require('../../../models');

module.exports = async function getRCUsers(apiUrl, header) {
    const options = { context: { internal: true } };
    let author_id;
    models.Role.findOne({name: 'Author'})
        .then((role)=>{
            author_id = role.id;
        });
    return new Promise((resolve) => {
        let users, offset = 0, total = 1, count = 10;
        let fetched = false;
        for (offset; offset < total;) {
            request.get({ url: buidApiUrl(apiUrl, offset, count), headers: header }, function (e, r, body) {
                let result = JSON.parse(body);
                if (result.success) {
                    total = result.total;
                    //offset += result.count;
                    users = result.users;
                    // Check if RC gives admin callee result.
                    // if (users && users[0] && !users[0].password) {
                    //     throw new common.errors.InternalServerError({message: 'Doesnot have admin access in RC.'});    
                    // }
                    users.forEach(user => {
                        models.User.findOne({ rc_id: user._id }, options)
                            .then((u) => {
                                // Don't save if User is already in the DB.
                                if (!u) 
                                    saveUser(user, author_id, options);
                            });
                    });
                } else {
                    return Promise.reject(new common.errors.InternalServerError({
                        message: 'Unable to add user from RC'
                    }));
                }
            });
            offset = 1;
        }
        resolve(fetched);
    })
};

function saveUser(user, role, options) {
    // let email = user.emails[0].address;
    // user.emails.foreach((e)=>{
    //     if (e.verified) {
    //         email = e.address;
    //     }
    // });
    return models.User.add({
        rc_id: user._id,
        email: user._id + '@g.com',
        name: user.name,
        password: '$2a$10$etxjjsdeTbUC7aG3Od2/EuMUY4iqqXEV4jF0MtXSfsL2RmwJT3Jjm',//user.password.bcrypt,
        roles: [role]// @TODO add author role_id
    }, options);
}

function buidApiUrl(base, offset, count) {
    return base + '?' + `offset=${offset}&count=${count}`;
}
