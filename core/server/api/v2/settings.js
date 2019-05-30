const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment-timezone');
const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const models = require('../../models');
const urlService = require('../../services/url');
const rcUtils = require('./utils/rc-utils');
const common = require('../../lib/common');
const settingsCache = require('../../services/settings/cache');

const SETTINGS_BLACKLIST = [
    'members_public_key',
    'members_private_key',
    'members_session_secret'
];

module.exports = {
    docName: 'settings',

    browse: {
        options: ['type'],
        permissions: true,
        query(frame) {
            let settings = settingsCache.getAll();

            // CASE: no context passed (functional call)
            if (!frame.options.context) {
                return Promise.resolve(settings.filter((setting) => {
                    return setting.type === 'blog';
                }));
            }

            // CASE: omit core settings unless internal request
            if (!frame.options.context.internal) {
                settings = _.filter(settings, (setting) => {
                    const isCore = setting.type === 'core';
                    const isBlacklisted = SETTINGS_BLACKLIST.includes(setting.key);
                    return !isBlacklisted && !isCore;
                });
            }

            return settings;
        }
    },

    read: {
        options: ['key'],
        validation: {
            options: {
                key: {
                    required: true
                }
            }
        },
        permissions: {
            identifier(frame) {
                return frame.options.key;
            }
        },
        query(frame) {
            let setting = settingsCache.get(frame.options.key, {resolve: false});

            if (!setting) {
                return Promise.reject(new common.errors.NotFoundError({
                    message: common.i18n.t('errors.api.settings.problemFindingSetting', {
                        key: frame.options.key
                    })
                }));
            }

            // @TODO: handle in settings model permissible fn
            if (setting.type === 'core' && !(frame.options.context && frame.options.context.internal)) {
                return Promise.reject(new common.errors.NoPermissionError({
                    message: common.i18n.t('errors.api.settings.accessCoreSettingFromExtReq')
                }));
            }

            return {
                [frame.options.key]: setting
            };
        }
    },

    edit: {
        headers: {
            cacheInvalidate: true
        },
        permissions: {
            before(frame) {
                const errors = [];

                frame.data.settings.map((setting) => {
                    if (setting.type === 'core' && !(frame.options.context && frame.options.context.internal)) {
                        errors.push(new common.errors.NoPermissionError({
                            message: common.i18n.t('errors.api.settings.accessCoreSettingFromExtReq')
                        }));
                    }
                });

                if (errors.length) {
                    return Promise.reject(errors[0]);
                }
            }
        },
        query(frame) {
            let type = frame.data.settings.find((setting) => {
                return setting.key === 'type';
            });

            if (_.isObject(type)) {
                type = type.value;
            }

            frame.data.settings = _.reject(frame.data.settings, (setting) => {
                return setting.key === 'type';
            });

            let isAnnounce = frame.data.settings.find((setting) => {
                return setting.key === 'is_announced';
            });

            if (_.isObject(isAnnounce)) {
                isAnnounce = isAnnounce.value;
            }

            const errors = [];

            if(isAnnounce) {
                let room = frame.data.settings.find((setting) => {
                    return setting.key === 'room';
                });
    
                if (_.isObject(room)) {
                    room = room.value;
                }

                if(!room) {
                    errors.push(new common.errors.NotFoundError({
                        message: "Room Name should not be empty"
                    }));
                } else {
                    let header = {
                        'X-Auth-Token': 'AQlnaFgDczayLPngn-HdHABIomE2EjV_LMHAW0lvV1X',
                        'X-User-Id': 'AZG7dyTXMJoPhJHE7'
                    };
                    return rcUtils.validateRoom('https://open.rocket.chat/api/v1/rooms.info', header, room)
                        .then((r, err)=>{
                            if(err) {
                                errors.push(err);
                            } else if(!r || !r.exist) {
                                errors.push(new common.errors.NotFoundError({
                                    message: "Room not found, enter a Valid room name"
                                }));
                            } else if(r.name === room) {
                                frame.data.settings.push({key: 'room_id', value: r.rid});
                            }
                            _.each(frame.data.settings, (setting) => {
                                const settingFromCache = settingsCache.get(setting.key, {resolve: false});
                
                                if (!settingFromCache) {
                                    errors.push(new common.errors.NotFoundError({
                                        message: common.i18n.t('errors.api.settings.problemFindingSetting', {
                                            key: setting.key
                                        })
                                    }));
                                } else if (settingFromCache.type === 'core' && !(frame.options.context && frame.options.context.internal)) {
                                    // @TODO: handle in settings model permissible fn
                                    errors.push(new common.errors.NoPermissionError({
                                        message: common.i18n.t('errors.api.settings.accessCoreSettingFromExtReq')
                                    }));
                                }
                            });
                            
                            if (errors.length) {
                                return Promise.reject(errors[0]);
                            }
                
                            return models.Settings.edit(frame.data.settings, frame.options);
                        })
                }
            }

            if (errors.length) {
                return Promise.reject(errors[0]);
            }

            return models.Settings.edit(frame.data.settings, frame.options);
        }
    },

    upload: {
        headers: {
            cacheInvalidate: true
        },
        permissions: {
            method: 'edit'
        },
        query(frame) {
            const backupRoutesPath = path.join(config.getContentPath('settings'), `routes-${moment().format('YYYY-MM-DD-HH-mm-ss')}.yaml`);

            return fs.copy(`${config.getContentPath('settings')}/routes.yaml`, backupRoutesPath)
                .then(() => {
                    return fs.copy(frame.file.path, `${config.getContentPath('settings')}/routes.yaml`);
                })
                .then(() => {
                    urlService.resetGenerators({releaseResourcesOnly: true});
                })
                .then(() => {
                    const siteApp = require('../../web/site/app');

                    const bringBackValidRoutes = () => {
                        urlService.resetGenerators({releaseResourcesOnly: true});

                        return fs.copy(backupRoutesPath, `${config.getContentPath('settings')}/routes.yaml`)
                            .then(() => {
                                return siteApp.reload();
                            });
                    };

                    try {
                        siteApp.reload();
                    } catch (err) {
                        return bringBackValidRoutes()
                            .finally(() => {
                                throw err;
                            });
                    }

                    let tries = 0;

                    function isBlogRunning() {
                        return Promise.delay(1000)
                            .then(() => {
                                if (!urlService.hasFinished()) {
                                    if (tries > 5) {
                                        throw new common.errors.InternalServerError({
                                            message: 'Could not load routes.yaml file.'
                                        });
                                    }

                                    tries = tries + 1;
                                    return isBlogRunning();
                                }
                            });
                    }

                    return isBlogRunning()
                        .catch((err) => {
                            return bringBackValidRoutes()
                                .finally(() => {
                                    throw err;
                                });
                        });
                });
        }
    },

    download: {
        headers: {
            disposition: {
                type: 'yaml',
                value: 'routes.yaml'
            }
        },
        response: {
            format: 'plain'
        },
        permissions: {
            method: 'browse'
        },
        query() {
            const routesPath = path.join(config.getContentPath('settings'), 'routes.yaml');

            return fs.readFile(routesPath, 'utf-8')
                .catch((err) => {
                    if (err.code === 'ENOENT') {
                        return Promise.resolve([]);
                    }

                    if (common.errors.utils.isIgnitionError(err)) {
                        throw err;
                    }

                    throw new common.errors.NotFoundError({
                        err: err
                    });
                });
        }
    }
};
