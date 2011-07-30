var sockets;

var net = require('net');
var server = net.createServer(function (stream) {
	console.log('hi');
	stream.setEncoding('utf8');
	stream.addListener("data", function (data) {
		console.log(data);
		if (sockets) {
		    sockets.emit('logs', data);
		}
	    });
    });	
server.listen(514, 'localhost');


var express = require('express');

var app = express.createServer();
var io = require('socket.io').listen(app);

app.use(express.static(__dirname + '/public'));
app.use(app.router);

app.get('/', function(req, res){
    res.render('index.ejs', { title: 'My Site' });
});

app.listen(80);

io.sockets.on('connection', function (socket) {
  socket.emit('logs', 'hello world' );
  sockets = socket;

  socket.on('my other event', function (data) {
    console.log(data);
  });
});