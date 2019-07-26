const Promise = require('bluebird'),
    {extend, merge, omit, cloneDeep, assign} = require('lodash'),
    validator = require('validator'),
    config = require('../../config'),
    common = require('../../lib/common'),
    security = require('../../lib/security'),
    constants = require('../../lib/constants'),
    pipeline = require('../../lib/promise/pipeline'),
    mail = require('../../services/mail'),
    urlService = require('../../services/url'),
    localUtils = require('./utils'),
    rcUtils = require('../v2/utils/rc-utils'),
    models = require('../../models'),
    web = require('../../web'),
    mailAPI = require('./mail'),
    settingsAPI = require('./settings'),
    tokenSecurity = {};

let authentication;

/**
 * Returns setup status
 *
 * @return {Promise<Boolean>}
 */
function checkSetup() {
    return authentication.isSetup().then((result) => {
        return result.setup[0].status;
    });
}

/**
 * Allows an assertion to be made about setup status.
 *
 * @param  {Boolean} status True: setup must be complete. False: setup must not be complete.
 * @return {Function} returns a "task ready" function
 */
function assertSetupCompleted(status) {
    return function checkPermission(__) {
        return checkSetup().then((isSetup) => {
            if (isSetup === status) {
                return __;
            }

            const completed = common.i18n.t('errors.api.authentication.setupAlreadyCompleted'),
                notCompleted = common.i18n.t('errors.api.authentication.setupMustBeCompleted');

            function throwReason(reason) {
                throw new common.errors.NoPermissionError({message: reason});
            }

            if (isSetup) {
                throwReason(completed);
            } else {
                throwReason(notCompleted);
            }
        });
    };
}

function setupTasks(setupData) {
    let tasks;

    function validateData(setupData) {
        const id = setupData['setup'][0].rc_id;
        const token = setupData['setup'][0].rc_token;
        const blogTitle = setupData['setup'][0].blogTitle;
        const rcUrl = setupData['setup'][0].rc_url;
        const announceToken = setupData['setup'][0].announce_token;
        const collabToken = setupData['setup'][0].collaboration_token;
        return rcUtils.checkAdmin(rcUrl, id, token).then((data) => {
            const email = data.emails[0].address;
            return {
                name: data.name,
                rc_id: id,
                rc_username: data.username,
                profile_image: data.avatarUrl, 
                email: email,
                password: "qwe123qwe123",//TODO set random password
                blogTitle: blogTitle,
                announce_token: announceToken,
                collaboration_token: collabToken,
                serverUrl: rcUrl,
                status: 'active'
            };
        });
    }

    function setupUser(userData) {
        const context = {context: {internal: true}},
            User = models.User;

        return User.findOne({role: 'Owner', status: 'all'}).then((owner) => {
            if (!owner) {
                throw new common.errors.GhostError({
                    message: common.i18n.t('errors.api.authentication.setupUnableToRun')
                });
            }

            return User.setup(userData, extend({id: owner.id}, context));
        }).then((user) => {
            return {
                user: user,
                userData: userData
            };
        });
    }

    function doSettings(data) {
        const user = data.user,
            blogTitle = data.userData.blogTitle,
            serverUrl = data.userData.serverUrl,
            announceToken = data.userData.announce_token,
            collabToken = data.userData.collaboration_token,
            context = {context: {user: data.user.id}};

        let userSettings;

        if (!blogTitle || typeof blogTitle !== 'string') {
            return user;
        }

        userSettings = [
            {key: 'server_url', value: serverUrl},
            {key: 'title', value: blogTitle.trim()},
            {key: 'announce_token', value: announceToken},
            {key: 'collaboration_token', value: collabToken},
            {key: 'description', value: common.i18n.t('common.api.authentication.sampleBlogDescription')}
        ];

        return settingsAPI.edit({settings: userSettings}, context).return(user);
    }

    function formatResponse(user) {
        return user.toJSON({context: {internal: true}});
    }

    tasks = [
        validateData,
        setupUser,
        doSettings,
        formatResponse
    ];

    return pipeline(tasks, setupData);
}

/**
 * ## Authentication API Methods
 *
 * **See:** [API Methods](events.js.html#api%20methods)
 */
authentication = {
    /**
     * @description generate a reset token for a given email address
     * @param {Object} object
     * @returns {Promise<Object>} message
     */
    generateResetToken(object) {
        let tasks;

        function validateRequest(object) {
            return localUtils.checkObject(object, 'passwordreset').then((data) => {
                const email = data.passwordreset[0].email;

                if (typeof email !== 'string' || !validator.isEmail(email)) {
                    throw new common.errors.BadRequestError({
                        message: common.i18n.t('errors.api.authentication.noEmailProvided')
                    });
                }

                return email;
            });
        }

        function generateToken(email) {
            const options = {context: {internal: true}};
            let dbHash, token;

            return settingsAPI.read(merge({key: 'db_hash'}, options))
                .then((response) => {
                    dbHash = response.settings[0].value;

                    return models.User.getByEmail(email, options);
                })
                .then((user) => {
                    if (!user) {
                        throw new common.errors.NotFoundError({message: common.i18n.t('errors.api.users.userNotFound')});
                    }

                    token = security.tokens.resetToken.generateHash({
                        expires: Date.now() + constants.ONE_DAY_MS,
                        email: email,
                        dbHash: dbHash,
                        password: user.get('password')
                    });

                    return {
                        email: email,
                        resetToken: token
                    };
                });
        }

        function sendResetNotification(data) {
            const adminUrl = urlService.utils.urlFor('admin', true),
                resetUrl = urlService.utils.urlJoin(adminUrl, 'reset', security.url.encodeBase64(data.resetToken), '/');

            return mail.utils.generateContent({
                data: {
                    resetUrl: resetUrl
                },
                template: 'reset-password'
            }).then((content) => {
                const payload = {
                    mail: [{
                        message: {
                            to: data.email,
                            subject: common.i18n.t('common.api.authentication.mail.resetPassword'),
                            html: content.html,
                            text: content.text
                        },
                        options: {}
                    }]
                };

                return mailAPI.send(payload, {context: {internal: true}});
            });
        }

        function formatResponse() {
            return {
                passwordreset: [
                    {message: common.i18n.t('common.api.authentication.mail.checkEmailForInstructions')}
                ]
            };
        }

        tasks = [
            assertSetupCompleted(true),
            validateRequest,
            generateToken,
            sendResetNotification,
            formatResponse
        ];

        return pipeline(tasks, object);
    },

    /**
     * ## Reset Password
     * reset password if a valid token and password (2x) is passed
     * @param {Object} object
     * @returns {Promise<Object>} message
     */
    resetPassword(object, opts) {
        let tasks,
            tokenIsCorrect,
            dbHash,
            tokenParts;
        const options = {context: {internal: true}};

        function validateRequest() {
            return localUtils.validate('passwordreset')(object, options)
                .then((options) => {
                    const data = options.data.passwordreset[0];

                    if (data.newPassword !== data.ne2Password) {
                        return Promise.reject(new common.errors.ValidationError({
                            message: common.i18n.t('errors.models.user.newPasswordsDoNotMatch')
                        }));
                    }

                    return Promise.resolve(options);
                });
        }

        function extractTokenParts(options) {
            options.data.passwordreset[0].token = security.url.decodeBase64(options.data.passwordreset[0].token);

            tokenParts = security.tokens.resetToken.extract({
                token: options.data.passwordreset[0].token
            });

            if (!tokenParts) {
                return Promise.reject(new common.errors.UnauthorizedError({
                    message: common.i18n.t('errors.api.common.invalidTokenStructure')
                }));
            }

            return Promise.resolve(options);
        }

        // @TODO: use brute force middleware (see https://github.com/TryGhost/Ghost/pull/7579)
        function protectBruteForce(options) {
            if (tokenSecurity[`${tokenParts.email}+${tokenParts.expires}`] &&
                tokenSecurity[`${tokenParts.email}+${tokenParts.expires}`].count >= 10) {
                return Promise.reject(new common.errors.NoPermissionError({
                    message: common.i18n.t('errors.models.user.tokenLocked')
                }));
            }

            return Promise.resolve(options);
        }

        function doReset(options) {
            const data = options.data.passwordreset[0],
                resetToken = data.token,
                oldPassword = data.oldPassword,
                newPassword = data.newPassword;

            return settingsAPI.read(merge({key: 'db_hash'}, omit(options, 'data')))
                .then((response) => {
                    dbHash = response.settings[0].value;

                    return models.User.getByEmail(tokenParts.email, options);
                })
                .then((user) => {
                    if (!user) {
                        throw new common.errors.NotFoundError({message: common.i18n.t('errors.api.users.userNotFound')});
                    }

                    tokenIsCorrect = security.tokens.resetToken.compare({
                        token: resetToken,
                        dbHash: dbHash,
                        password: user.get('password')
                    });

                    if (!tokenIsCorrect) {
                        return Promise.reject(new common.errors.BadRequestError({
                            message: common.i18n.t('errors.api.common.invalidTokenStructure')
                        }));
                    }

                    web.shared.middlewares.api.spamPrevention.userLogin()
                        .reset(opts.ip, `${tokenParts.email}login`);

                    return models.User.changePassword({
                        oldPassword: oldPassword,
                        newPassword: newPassword,
                        user_id: user.id
                    }, options);
                })
                .then((updatedUser) => {
                    updatedUser.set('status', 'active');
                    return updatedUser.save(options);
                })
                .catch(common.errors.ValidationError, (err) => {
                    return Promise.reject(err);
                })
                .catch((err) => {
                    if (common.errors.utils.isIgnitionError(err)) {
                        return Promise.reject(err);
                    }
                    return Promise.reject(new common.errors.UnauthorizedError({err: err}));
                });
        }

        function formatResponse() {
            return {
                passwordreset: [
                    {message: common.i18n.t('common.api.authentication.mail.passwordChanged')}
                ]
            };
        }

        tasks = [
            validateRequest,
            assertSetupCompleted(true),
            extractTokenParts,
            protectBruteForce,
            doReset,
            formatResponse
        ];

        return pipeline(tasks, object, options);
    },

    /**
     * ### Accept Invitation
     * @param {Object} invitation an invitation object
     * @returns {Promise<Object>}
     */
    acceptInvitation(invitation) {
        let tasks,
            invite;
        const options = {context: {internal: true}};

        function validateInvitation(invitation) {
            return localUtils.checkObject(invitation, 'invitation')
                .then(() => {
                    if (!invitation.invitation[0].token) {
                        return Promise.reject(new common.errors.ValidationError({message: common.i18n.t('errors.api.authentication.noTokenProvided')}));
                    }

                    if (!invitation.invitation[0].email) {
                        return Promise.reject(new common.errors.ValidationError({message: common.i18n.t('errors.api.authentication.noEmailProvided')}));
                    }

                    if (!invitation.invitation[0].password) {
                        return Promise.reject(new common.errors.ValidationError({message: common.i18n.t('errors.api.authentication.noPasswordProvided')}));
                    }

                    if (!invitation.invitation[0].name) {
                        return Promise.reject(new common.errors.ValidationError({message: common.i18n.t('errors.api.authentication.noNameProvided')}));
                    }

                    return invitation;
                });
        }

        function processInvitation(invitation) {
            const data = invitation.invitation[0],
                inviteToken = security.url.decodeBase64(data.token);

            return models.Invite.findOne({token: inviteToken, status: 'sent'}, options)
                .then((_invite) => {
                    invite = _invite;

                    if (!invite) {
                        throw new common.errors.NotFoundError({message: common.i18n.t('errors.api.invites.inviteNotFound')});
                    }

                    if (invite.get('expires') < Date.now()) {
                        throw new common.errors.NotFoundError({message: common.i18n.t('errors.api.invites.inviteExpired')});
                    }

                    return models.User.add({
                        email: data.email,
                        name: data.name,
                        password: data.password,
                        roles: [invite.toJSON().role_id]
                    }, options);
                })
                .then(() => {
                    return invite.destroy(options);
                });
        }

        function formatResponse() {
            return {
                invitation: [
                    {message: common.i18n.t('common.api.authentication.mail.invitationAccepted')}
                ]
            };
        }

        tasks = [
            assertSetupCompleted(true),
            validateInvitation,
            processInvitation,
            formatResponse
        ];

        return pipeline(tasks, invitation);
    },

        /**
     * ### Add Users
     * @param {Object} invitation an invitation object
     * @returns {Promise<Object>}
     */
    addUser(invitation, option) {
        let tasks,
            invite;
        const options = {context: {internal: true}, withRelated: ['roles']};
        const localOptions = {context: {internal: true}};
        // 1. if admin adds user, option.
        // 2. if user creating account, invitation.
        const rc_uid = option.rc_uid || invitation.user[0].rc_uid;
        const rc_token = option.rc_token || invitation.user[0].rc_token;

        function validateInvitation(invitation) {
            return models.Settings.findOne({ key: 'invite_only' }, localOptions)
                .then((setting) => {
                    const inviteOnly = setting.attributes.value;
                    return rcUtils.getMe(rc_uid, rc_token)
                        .then((invitedBy) => {
                            if (!invitedBy.success) {
                                throw new common.errors.NotFoundError({ message: "User not found. Make Sure you are logged in on RC." });
                            }
                            if (inviteOnly) { //Check that rc_uid is of Owner/Admin
                                return models.User.findOne({ rc_id: rc_uid, role: 'Owner'||'Administrator', status: 'all'}, options)
                                    .then((user) => {
                                        if (user) {
                                            return invitation;
                                        } else {
                                            throw new common.errors.NotFoundError({ message: "You are not authorized to add new authors" });
                                        }
                                    });
                            } else {// Self Invitation
                                return invitation;
                            }
                        });
                });
        }

        function processInvitation(invitation) {
            const data = invitation.user[0];
            return rcUtils.getUser(rc_uid, rc_token, data.rc_username)
                .then((user) => {
                    if (user.success && user.user) {
                        const u = user.user;
                        if(!u.emails){
                            throw new common.errors.NotFoundError({ message: "Cannot create account without email." });
                        }
                        const email = u.emails[0].address;
                        const role = data.role.name||'Author';
                        return models.Role.findOne({name: role})
                            .then((r) => {
                            return models.User.add({
                                rc_id: u._id,
                                rc_username: u.username,
                                email: email,
                                name: u.name,
                                password: "qwe123qwe123",//TODO Random password
                                roles: [r]
                            }, localOptions);
                            });
                    } else {
                        throw new common.errors.NotFoundError({message: "User not found. Make Sure you are logged in on RC."});
                    }
                });
        }

        function formatResponse() {
            return {
                invitation: [
                    {message: 'User Added'}
                ]
            };
        }

        tasks = [
            assertSetupCompleted(true),
            validateInvitation,
            processInvitation,
            formatResponse
        ];

        return pipeline(tasks, invitation);
    },

    /**
     * ### Check for invitation
     * @param {Object} options
     * @returns {Promise<Object>} An invitation status
     */
    isInvitation(options) {
        let tasks;
        const localOptions = cloneDeep(options || {});

        function processArgs(options) {
            const email = options.email;

            if (typeof email !== 'string' || !validator.isEmail(email)) {
                throw new common.errors.BadRequestError({
                    message: common.i18n.t('errors.api.authentication.invalidEmailReceived')
                });
            }

            return email;
        }

        function checkInvitation(email) {
            return models.Invite
                .findOne({email: email, status: 'sent'}, options)
                .then((invite) => {
                    if (!invite) {
                        return {invitation: [{valid: false}]};
                    }

                    return {invitation: [{valid: true}]};
                });
        }

        tasks = [
            processArgs,
            assertSetupCompleted(true),
            checkInvitation
        ];

        return pipeline(tasks, localOptions);
    },

    /**
     * Checks the setup status
     * @return {Promise}
     */
    isSetup() {
        let tasks;

        function checkSetupStatus() {
            return models.User.isSetup();
        }

        function formatResponse(isSetup) {
            return {
                setup: [
                    {
                        status: isSetup,
                        // Pre-populate from config if, and only if the values exist in config.
                        title: config.title || undefined,
                        name: config.user_name || undefined,
                        email: config.user_email || undefined
                    }
                ]
            };
        }

        tasks = [
            checkSetupStatus,
            formatResponse
        ];

        return pipeline(tasks);
    },

    /**
     * Executes the setup tasks and get access_token and user_id and verify with rc-utils
     * @param  {Object} setupDetails
     * @return {Promise<Object>} a user api payload
     */
    setup(setupDetails) {
        let tasks;

        function doSetup(setupDetails) {
            return setupTasks(setupDetails);
        }

        function sendNotification(setupUser) {
            const data = {
                ownerEmail: setupUser.email
            };

            common.events.emit('setup.completed', setupUser);

            if (config.get('sendWelcomeEmail')) {
                return mail.utils.generateContent({data: data, template: 'welcome'})
                    .then((content) => {
                        const message = {
                                to: setupUser.email,
                                subject: common.i18n.t('common.api.authentication.mail.yourNewGhostBlog'),
                                html: content.html,
                                text: content.text
                            },
                            payload = {
                                mail: [{
                                    message: message,
                                    options: {}
                                }]
                            };

                        mailAPI.send(payload, {context: {internal: true}})
                            .catch((err) => {
                                err.context = common.i18n.t('errors.api.authentication.unableToSendWelcomeEmail');
                                common.logging.error(err);
                            });
                    })
                    .return(setupUser);
            }

            return setupUser;
        }

        function formatResponse(setupUser) {
            return {users: [setupUser]};
        }

        tasks = [
            assertSetupCompleted(false),
            doSetup,
            // TODO: add mail service from RC.
            // sendNotification,
            formatResponse
        ];

        return pipeline(tasks, setupDetails);
    },

    /**
     * Updates the blog setup
     * @param  {Object} setupDetails request payload with setup details
     * @param  {Object} options
     * @return {Promise<Object>} a User API response payload
     */
    updateSetup(setupDetails, options) {
        let tasks;
        const localOptions = cloneDeep(options || {});

        function processArgs(setupDetails, options) {
            if (!options.context || !options.context.user) {
                throw new common.errors.NoPermissionError({message: common.i18n.t('errors.api.authentication.notTheBlogOwner')});
            }

            return assign({setupDetails: setupDetails}, options);
        }

        function checkPermission(options) {
            return models.User.findOne({role: 'Owner', status: 'all'})
                .then((owner) => {
                    if (owner.id !== options.context.user) {
                        throw new common.errors.NoPermissionError({message: common.i18n.t('errors.api.authentication.notTheBlogOwner')});
                    }

                    return options.setupDetails;
                });
        }

        function formatResponse(user) {
            return {users: [user]};
        }

        tasks = [
            processArgs,
            assertSetupCompleted(true),
            checkPermission,
            setupTasks,
            formatResponse
        ];

        return pipeline(tasks, setupDetails, localOptions);
    },

    /**
     * Revokes a bearer token.
     * @param {Object} tokenDetails
     * @param {Object} options
     * @return {Promise<Object>} an object containing the revoked token.
     */
    revoke(tokenDetails, options) {
        let tasks;
        const localOptions = cloneDeep(options || {});

        function processArgs(tokenDetails, options) {
            return assign({}, tokenDetails, options);
        }

        function revokeToken(options) {
            const providers = [
                    models.Refreshtoken,
                    models.Accesstoken
                ],
                response = {token: options.token};

            function destroyToken(provider, options, providers) {
                return provider.destroyByToken(options)
                    .return(response)
                    .catch(provider.NotFoundError, () => {
                        if (!providers.length) {
                            return {
                                token: tokenDetails.token,
                                error: common.i18n.t('errors.api.authentication.invalidTokenProvided')
                            };
                        }

                        return destroyToken(providers.pop(), options, providers);
                    })
                    .catch(() => {
                        throw new common.errors.TokenRevocationError({
                            message: common.i18n.t('errors.api.authentication.tokenRevocationFailed')
                        });
                    });
            }

            return destroyToken(providers.pop(), options, providers);
        }

        tasks = [
            processArgs,
            revokeToken
        ];

        return pipeline(tasks, tokenDetails, localOptions);
    }
};

module.exports = authentication;
