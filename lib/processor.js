var util = require('util');

function Abstract() {}

Abstract.prototype.setAdapter = function(adapter) {
    this.adapter = adapter;
};

Abstract.prototype.match = function() {
    return false;
};

function Aggregate(list) {
    this.list = list;
}

Aggregate.prototype.setAdapter = function(adapter) {
    this.adapter = adapter;

    this.list.forEach(function(processor) {
        processor.setAdapter(adapter);
    }, this);
};

Aggregate.prototype.process = function(node) {
    this.list.forEach(function(processor) {
        if(processor.match(node)) {
            processor.process(node);
        }
    }, this);
};

function Text() {}

util.inherits(Text, Abstract);

Text.prototype.match = function(node) {
    return node.child('notify') && node.child('body');
};

Text.prototype.process = function(node) {
    this.adapter.emit(
        'message',
        node.attribute('from'),
        node.attribute('id'),
        node.child('notify').attribute('name'),
        node.child('body').data(),
        node.attribute('author')
    );
};

function createProcessor() {
    return new Aggregate([new Text]);
}

exports.createProcessor = createProcessor;
