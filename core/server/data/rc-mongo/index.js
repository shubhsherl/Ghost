var MongoClient = require('mongodb').MongoClient,
    config = require('../../config');

let db;

const collection = {
    db: 'meteor',
    room: 'rocketchat_room',
    user: 'users',
    subscription: 'rocketchat_subscription',
};

INIT_ERROR = {error: 'DB not connected or initialized'};

module.exports = {
    dbInit() {
        MongoClient.connect(config.get('rcMongo'), function (err, client) {
            if (err) throw err;
            db = client.db(collection.db);
        });
    },

    // getRoom by id or by room name
    async getRoom(params) {
        if (!db) {
            return INIT_ERROR;
        }

        const {_id, name} = params;
        
        if(!_id && !name) {
            return {error: '_id or name is required'};
        }

        const result = await db.collection(collection.room).find(params).toArray();
        return result;
    },

    // getUser by username or id
    async getUser(params) {
        if (!db) {
            return INIT_ERROR;
        }

        const {_id, username} = params;
        
        if(!_id && !username) {
            return {error: 'uid or username is required'};
        }
        
        // Fetch only required fields.
        const result = await db.collection(collection.user).find(params, {fields: {name:1, username:1, emails:1, roles:1}}).toArray();
        return result;
    },

    // getSubscription by uid and rid
    async getSubscription(params) {
        if (!db) {
            return INIT_ERROR;
        }

        const {uid, rid} = params;
        
        if(!uid || !rid) {
            return {error: 'uid and rid is required'};
        }

        const result = await db.collection(collection.subscription).find({rid, "u._id": uid}).toArray();
        return result;
    },

        // getSubscription by uid and rid
    async getSelfSubscription(params) {
        if (!db) {
            return INIT_ERROR;
        }

        const {uid} = params;
        
        if(!uid) {
            return {error: 'uid is required'};
        }

        const result = await db.collection(collection.subscription).find({"u._id": uid, $expr: {$eq: ["$u.username", "$name"]}}).toArray();
        return result;
    },

}