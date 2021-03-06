/**
 * Created by pegasuskim on 2015-12-07.
 */
'use strict';
var amqp = require('amqplib/callback_api');
var async = require('async');


function RabbitMQ(config) {
    this.queues = config;
    this.connection = {};
    this.connect();
};

RabbitMQ.prototype.connect = function() {
    var self = this;
    Object.keys(self.queues).forEach(function(queueName) {
        var queue =  self.queues[queueName];
        amqp.connect(queue.host, function(error, conn) {
            if(conn){
                self.connection[queueName] = conn;
                console.log('[%d] rabbitmq %s connect host', process.pid, queueName);
            }else{
                console.log('[%s] rabbitmq connect error msg: %s', queueName, error);
            }

        });
    })

};

RabbitMQ.prototype.publish = function(ex, data, callback) {
    var self = this;
    async.waterfall([
            function checkConnect(callback) {
                var conn = self.connection[ex];
                var error = null;
                if(conn === null || conn === undefined) {
                    error = new Error('RabbitMQ Connect error');
                }
                callback( error, conn );
            },
            function createChannel(conn, callback) {
                conn.createChannel(function(error, channel) {
                    callback( error, channel );
                });
            },
            function assertExchange(channel, callback) {
                channel.assertExchange(ex, 'fanout', {durable: false}, function(error, ok) {
                    callback( error, ok, channel );
                });
            },
            function sendToQueue(ok, channel, callback) {
                var strData = JSON.stringify(data);
                var error = null;

                if( !data.method )
                    console.log('[%d] method : %s', process.pid, strData );

                channel.publish(ex, '', new Buffer(strData));

                channel.close();
                callback( error, null );
            }
        ],
        function done(error, result) {
            if( error ) { console.log('[%d] Queue(%s) error : %s', process.pid, ex, error.message); }

            if( typeof callback === 'function' ) {
                return callback( error, result );
            }
        });
};


RabbitMQ.prototype.close = function(qname) {
    if( this.connection[qname] ) {
        this.connection[qname].close();
        this.connection[qname] = null;
    }
};

module.exports = RabbitMQ;
