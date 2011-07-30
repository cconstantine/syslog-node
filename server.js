var net     = require('net');
var express = require('express');
var app     = express.createServer();
var io      = require('socket.io');
var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();

app.configure(function () {
	app.use(express.static(__dirname + '/public'));
	app.use(express.cookieParser());
	app.use(express.bodyParser());
	app.use(express.session({store: sessionStore,
			secret: 'secret', key: 'express.sid'}));
	app.use(app.router);

    });
sio = io.listen(app);



app.listen(80);
sio.set('log level', 1); 


app.get('/', function(req, res){
	res.render('index.ejs');
});

app.get('/login', function(req, res) {
	res.render('login.ejs');
    });

app.post('/login', function(req, res) {
	req.session.username = req.body.username;
	res.redirect(req.body.next);
    });

var parseCookie = require('connect').utils.parseCookie;
 
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
		if (err) {
		    // if we cannot grab a session, turn down the connection
		    accept(err.message, false);
		} else if(session.username) {
		    accept(null, true);
		} else {
		    accept("not logged in", false);
		}
	    });
	
    } else {
       // if there isn't, turn down the connection with a message
       // and leave the function.
       return accept('No cookie transmitted.', false);
    }
});

/* Syslog server */
var server = net.createServer(function (stream) {
	stream.setEncoding('utf8');
	stream.addListener("data", function (data) {
		sio.sockets.emit('logs', data);
	    });
    });	
server.listen(514, 'localhost');
/* ************* */
