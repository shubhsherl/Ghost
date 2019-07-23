const nock = require('nock');
const _ = require('lodash');
const crypto = require('crypto');
const config = require('../../server/config');

function getToken() {
    return crypto.randomBytes(20).toString('hex');
}

let token = {};

function validToken(token) {
    let success = false;
    _.each(token, (key, value) => {
        if (value === token)
            success = true;
    });
    return success;
}

module.exports = {

    serverUrl() {
        return config.get('server_url');
    },
    
    API() {
        return this.serverUrl() + '/api/v1';
    },

    getTokenById({id, uname}) {
        if (!token[id])
            token[id] = { token: getToken(), username: uname};
        return token[id].token;
    },

    buildMe() {
        let id;
        nock(this.API(), {
                reqheaders: {
                    'x-user-id': (uid) => {id = uid; return !!token[uid];},
                    'x-auth-token': (t) => {return token[id].token === t;}
                }
            })
            .get('/me')
            .reply(200, {
                _id: id,
                emails: [
                    {
                        address: `${crypto.randomBytes(6).toString('hex')}@rchat.com`,
                        verified: true
                    }
                ],
                roles: ['user'],
                success: true
            });
    },

    buildUserQuery() {
        let id, uname;
        nock(this.API(), {
                reqheaders: {
                    'x-user-id': (uid) => {id = uid; return !!token[uid];},
                    'x-auth-token': (t) => {return token[id].token === t;}
                }
            })
            .get('/users.info')
            .query(actualQueryObject => {
                // console.log(actualQueryObject);
                return true;
              })
            .reply(200, {
                _id: id,
                emails: [
                    {
                        address: "jbloggs@example.com",
                        verified: true
                    }
                ],
                roles: ['user'],
                success: true
            });
    },

    buildUserQueryByToken() {
        let id, uname;
        nock(this.serverUrl() + '/ghooks', {
                reqheaders: {
                    'x-user-id': (uid) => {id = uid; return !!token[uid];},
                    'x-auth-token': (t) => {return token[id].token === t;}
                }
            })
            .get(`/${config.get('announce_token')}/getUser`)
            .query(actualQueryObject => {
                // console.log(actualQueryObject);
                return true;
              })
            .reply(200, {
                _id: id,
                emails: [
                    {
                        address: "jbloggs@example.com",
                        verified: true
                    }
                ],
                roles: ['user'],
                success: true
            });
    },



}