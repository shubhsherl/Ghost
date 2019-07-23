const should = require('should');
const supertest = require('supertest');
const _ = require('lodash');
const testUtils = require('../../../utils');
const localUtils = require('./utils');
const config = require('../../../../server/config');

const ghost = testUtils.startGhost;

describe('Admin API key authentication', function () {
    let request;

    before(function () {
        return ghost()
            .then(function () {
                request = supertest.agent(config.get('url'));
            })
            .then(function () {
                return testUtils.initFixtures('api_keys');
            });
    });

    it('Can not access endpoint without a token header', function () {
        return request.get(localUtils.API.getApiQuery('posts/'))
            .set('Authorization', `Ghost`)
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(401);
    });

    it('Can not access endpoint with a wrong endpoint token', function () {
        return request.get(localUtils.API.getApiQuery('posts/'))
            .set('Authorization', `Ghost ${localUtils.getValidAdminToken('https://wrong.com')}`)
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(401);
    });

    it('Can read users', function () {
        return request
            .get(localUtils.API.getApiQuery('users/'))
            .set('Origin', config.get('url'))
            .set('Authorization', `Ghost ${localUtils.getValidAdminToken('/v2/admin/')}`)
            .expect('Content-Type', /json/)
            .expect('Cache-Control', testUtils.cacheRules.private)
            .expect(200)
            .then((res) => {
                localUtils.API.checkResponse(res.body.users[0], 'user');
            });
    });
});
