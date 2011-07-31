var net     = require('net');
var express = require('express');
var app     = express.createServer();
var io      = require('socket.io');
var mongodb = require('mongodb');
var MongoStore = require('connect-mongo');

var mongo_config = {host: 'localhost', port: 27017, db: 'syslog-node'}

var db = new mongodb.Db(mongo_config.db,
		     new mongodb.Server("127.0.0.1", 27017),
		     {native_parser:true});



var sessionStore = new MongoStore({db : mongo_config.db});

db.open(function(err, connection) {
	if (err) {
	    console.log('*****************');
	    console.log(err.stack);
	    console.log('*****************');
	    process.exit(1);
	}
	

app.configure(function () {
	app.use(express.static(__dirname + '/public'));
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.session({store: sessionStore,
			secret: 'secret', key: 'express.sid'}));
	app.use(app.router);

    }); 
sio = io.listen(app);


app.get('/', function(req, res){
	res.render('index.ejs');
    });

app.get('/login', function(req, res) {
	res.render('login.ejs');
    });

app.post('/login', function(req, res) {
	console.log(req.session);
	req.session.username = req.body.username;
	res.redirect(req.body.next);
    });

var parseCookie = require('connect').utils.parseCookie;
 
sio.sockets.on('connection', function(socket) {
	console.log(1);
	connection.collection('logs', function(err, col) {
		console.log(2);
		cur = col.find().sort(['created_at', 'desc']).limit(10);
		cur.each(function(err, item) {
			if (item) {
			    console.log(3);
			    console.log(item);
			    socket.emit('logs', item.message);
			}
		    });
	    });
    });

sio.set('authorization', function (data, accept) {
    // check if there's a cookie header
    if (data.headers.cookie) {
        // if there is, parse the cookie
        data.cookie = parseCookie(data.headers.cookie);
        // note that you will need to use the same key to grad the
        // session id, as you specified in the Express setup.
        data.sessionID = data.cookie['express.sid'];
	/// (literally) get the session data from the session store
        sessionStore.get(data.sessionID, function (err, session) {
		if (err || !session) {
		    // if we cannot grab a session, turn down the connection
		    accept(err.message, false);
		} else if(session.username) {
		    accept(null, true);
		} else {
		    console.log(session);
		    accept("not logged in", false);
		}
	    });
	
    } else {
       // if there isn't, turn down the connection with a message
       // and leave the function.
       return accept('No cookie transmitted.', false);
    }
});

app.listen(80);
sio.set('log level', 1); 




/* Syslog server */
	
	connection.collection('logs', function(err, col) {
		var i = [['created_at', -1]];
		col.ensureIndex(i, function(err, indexName) {
			console.log("created index: " + indexName);      
		    })
	    });

	function write_message (message) {
	    connection.collection('logs', function(err, col) {
		    col.insert({message : message,
                                created_at : new Date()});
		});
	}

	var server = net.createServer(function (stream) {
		stream.setEncoding('utf8');
		stream.addListener("data", function (data) {
			write_message(data);
			sio.sockets.emit('logs', data);
		    });
	    });	
	server.listen(514, 'localhost');
	/* ************* */
    });