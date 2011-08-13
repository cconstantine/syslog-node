#/usr/bin/env node

var Syslog  = require('node-syslog');
Syslog.init("syslog-node",
	    Syslog.LOG_PID | Syslog.LOG_ODELAY,
	    Syslog.LOG_LOCAL0);

var net     = require('net');
var express = require('express');
var app     = express.createServer();
var io      = require('socket.io');
var mongodb = require('mongodb');
var MongoStore = require('connect-mongo');

var unixlib = require('unixlib');

var mongo_config = {host: 'localhost', port: 27017, db: 'syslog-node'};

var db = new mongodb.Db(mongo_config.db,
		     new mongodb.Server("127.0.0.1", 27017),
		     {native_parser:false});



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
	app.use(express.session({
	  store: sessionStore,
		secret: 'secret', key: 'express.sid'
	}));
	app.use(app.router);
  }); 
sio = io.listen(app);


app.get('/', function(req, res){
	Syslog.log(Syslog.LOG_INFO, "Visit at '/'");
	res.render('index.ejs', {regex: req.session.regex || "",
	                         username : req.session.username,
	                         lines : req.session.lines || "100"});
	});

app.post('/regex', function(req, res) {
	req.session.regex = req.body.regex;
	res.end();
  });

app.post('/logout', function(req, res) {
	delete req.session.username;
	res.redirect(req.body.next);
});
  
app.get('/login', function(req, res) {
	res.render('login.ejs');
  });

app.post('/login', function(req, res) {
  var next = "/login";
  var username = req.body.username;
  var password = req.body.password;
  
  unixlib.pamauth('syslog-node', username, password, function(success) {
    if (success) {
      req.session.username = req.body.username;
      next = req.body.next;
      res.redirect(next);
    } else {
      res.redirect(next);    
    }
  });
});

var parseCookie = require('connect').utils.parseCookie;

function last_n(regex, n, f) {
  connection.collection('logs', function(err, col) {
    s = {};
    if (regex) {
	    s['message'] = {$regex : regex};
    }
    cur = col.find(s).sort({created_at : -1}).limit(n);
    f(cur);
  });
}

    
sio.sockets.on('connection', function(socket) {

	var regex = socket.handshake.regex;
	socket.set('regex', regex);
	
	function handle_result(cur) {
	  var items = [];
	  cur.each(function(err, item) {
            if (item) {
              items.unshift(item.message);
	    } else {
		socket.emit('logs', items);
	    }
	  });

        }
	
	socket.on('get', function(args) {
		socket.get('regex', function (err, regex) {
		  last_n(regex, args.lines, handle_result);
	  });
	});

	socket.on('regex', function (regex) {
		socket.set('regex', regex);
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
		    data.regex = session.regex;
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

app.listen(80);
sio.set('log level', 1); 




/* Syslog server */
	
connection.collection('logs', function(err, col) {
	var i = [['created_at', -1]];
	col.ensureIndex(i, function(err, indexName) {
	    });
    });

function write_message (message) {
    connection.collection('logs', function(err, col) {
	    col.insert({message : message,
			created_at : new Date()});
	});
}

var server = net.createServer(function (stream) {
	stream.setEncoding('utf8');
	stream.addListener("data", function (datagram) {
	  var datas = datagram.split("\n");
	  for (var data in datas) {
	    data = datas[data];
	    if (data.length == 0) {
	      continue;
	    }
		  write_message(data);
		  sockets = sio.sockets.sockets;
		  for (var id in sockets) {
		    var socket = sockets[id];
		    socket.get('regex', function (err, regex) {
			    if (!regex || data.search(regex) != -1) {
				    socket.emit('logs', [data]);
			    }
			  });
		  }
		}
	});
});	
server.listen(514, '0.0.0.0');
/* ************* */

});
