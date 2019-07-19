const ghostBookshelf = require('./base');

let Room,
    Rooms;

Room = ghostBookshelf.Model.extend({
    tableName: 'rooms',

    toJSON: function (unfilteredOptions) {
        var options = Room.filterOptions(unfilteredOptions, 'toJSON'),
            attrs = ghostBookshelf.Model.prototype.toJSON.call(this, options);

        delete attrs.token;
        return attrs;
    }
});

Rooms = ghostBookshelf.Collection.extend({
    model: Room
});

module.exports = {
    Room: ghostBookshelf.model('Room', Room),
    Rooms: ghostBookshelf.collection('Rooms', Rooms)
};
