const Promise = require('bluebird');
const request = require('request');
const common = require('../../lib/common');
const models = require('../../models');
const auth = require('../../services/auth');

const rcApi = "https://open.rocket.chat/api/v1/me";

const session = {
    read(options) {
        /*
         * TODO
         * Don't query db for user, when new api http wrapper is in we can
         * have direct access to req.user, we can also get access to some session
         * inofrmation too and send it back
         */
        return models.User.findOne({id: options.context.user});
    },
    add(object) {
        if (!object || !object.username || !object.password) {
            return Promise.reject(new common.errors.UnauthorizedError({
                message: common.i18n.t('errors.middleware.auth.accessDenied')
            }));
        }

        return models.User.check({
            email: object.username,
            password: object.password
        }).then((user) => {
            return Promise.resolve((req, res, next) => {
                req.brute.reset(function (err) {
                    if (err) {
                        return next(err);
                    }
                    req.user = user;
                    auth.session.createSession(req, res, next);
                });
            });
        }).catch((err) => {
            throw new common.errors.UnauthorizedError({
                message: common.i18n.t('errors.middleware.auth.accessDenied'),
                err
            });
        });
    },
    adder(object) {
        if (!object || !object.user_id || !object.access_token) {
            return Promise.reject(new common.errors.UnauthorizedError({
                message: common.i18n.t('errors.middleware.auth.accessDenied')
            }));
        }
        let header = {
            'X-Auth-Token': object.access_token,
            'X-User-Id': object.user_id
        };

        request.get({ url: rcApi, headers: header }, function (e, r, body) {
            let result = JSON.parse(body);

            if (result.success === true) {
                return models.User.check({
                    rc_id: object.user_id,
                }).then((user) => {
                    return Promise.resolve((req, res, next) => {
                        req.brute.reset(function (err) {
                            if (err) {
                                return next(err);
                            }
                            req.user = user;

                            if (result._id === user.get('rc_id')) {
                                auth.session.createSession(req, res, next);
                            } else {
                                next(e);
                            }
                        });
                    });
                }).catch((err) => {
                    throw new common.errors.UnauthorizedError({
                        message: common.i18n.t('errors.middleware.auth.accessDenied'),
                        err
                    });
                });
            } else {
                return Promise.reject(new common.errors.UnauthorizedError({
                    message: common.i18n.t('errors.middleware.auth.accessDenied')
                }));
            }
        });
    },
    delete() {
        return Promise.resolve((req, res, next) => {
            auth.session.destroySession(req, res, next);
        });
    }
};

module.exports = session;
