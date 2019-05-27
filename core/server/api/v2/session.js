const Promise = require('bluebird');
const request = require('request');
const common = require('../../lib/common');
const models = require('../../models');
const rcUtils = require('../v2/utils/rc-utils');
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
        if (!object || !object.rc_id || !object.rc_token) {
            return Promise.reject(new common.errors.UnauthorizedError({
                message: common.i18n.t('errors.middleware.auth.accessDenied')
            }));
        }

        return models.User.findOne({
            rc_id: object.rc_id
        }).then((user) => {
            if (!user){
                throw new common.errors.UnauthorizedError({
                    message: common.i18n.t('errors.middleware.auth.accessDenied')
                });
            }
            return rcUtils.getMe(object.rc_id, object.rc_token)
                .then((u) => {
                    if (!u.success) {
                        throw new common.errors.UnauthorizedError({
                            message: common.i18n.t('errors.middleware.auth.accessDenied')
                        });
                    }
                    return Promise.resolve((req, res, next) => {
                        req.brute.reset(function (err) {
                            if (err) {
                                return next(err);
                            }
                            req.user = user;
                            auth.session.createSession(req, res, next);
                        });
                    });
                });
        }).catch((err) => {
            throw new common.errors.UnauthorizedError({
                message: common.i18n.t('errors.middleware.auth.accessDenied'),
                err
            });
        });
    },
    
    delete() {
        return Promise.resolve((req, res, next) => {
            auth.session.destroySession(req, res, next);
        });
    }
};

module.exports = session;
