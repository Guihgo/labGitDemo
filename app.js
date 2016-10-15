var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var request = require('request');
var ArrayList = require('arraylist');
var os = require('os');
var fs = require('fs');

var PostClass = require('./post.js');
var RefreshPost = require('./refreshPost.js');


server.listen(process.env.OPENSHIFT_NODEJS_PORT || 81, process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1');
console.log('---Server rodando---');

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

var ListSocket = new ArrayList;
var ListPost = new ArrayList;

io.sockets.on('connection', function(socket){
	ListSocket.add(socket);
	console.log('Conectado: %s sockets conectado(s)', ListSocket.size());

	//OnDisconect
	socket.on('disconnect', function(data) {
		if(ListSocket.contains(socket)) {
			ListSocket.removeElement(socket);
		}
		console.log('Um client desconectou...'+data);
		console.log('Conectado: %s sockets conectado(s)', ListSocket.size());
	});

	//Add posts já added
	var posts = [];
	for(i=0; i<ListPost.size(); i++) {
		var iPost = ListPost.get(i);
		posts.push({ID: iPost.ID, ImgUrl: iPost.ImgUrl, Like: iPost.Like, Comment: iPost.Comment, osComments: iPost.osComments});
	}
	socket.emit('addAllPost', posts);

	socket.on('analisaPost', function(data) {
		console.log('analisaPost: Data-> '+data);
		add(data);
	});

	socket.on('removerTodos', function(data) {
		console.log('removerTodos '+data);
		ListPost.clear();
		io.sockets.emit('removerTodosOkay', true);
	});

});

/*add('BLKLZMhAQaC');
add('BLambvwDyzv');
add('BLZ0-uxDaAH');

add('BLZuKlQjGAq');
add('BLYv2DyA0Qh');
add('BLW0I9ADrkQ');

add('BLWYRJxDFCR');
add('BLWK3p2jRJS');
add('BLUd5FlDYdo');

add('BLUWvdcDRKH');
add('BLUP40UDb63');
add('BLT60KRjJpm');*/


/* ------------------------------------BLbUTCigS1K---------- */
function add(ID) {
	getPost(ID, function(thePost) { 
		io.sockets.emit('addPost', {ID: thePost.ID, ImgUrl: thePost.ImgUrl, Like: thePost.Like, Comment: thePost.Comment, osComments: thePost.osComments});
		ListPost.add(thePost);
		if(ListPost.size()==1) {
			umPorVez(0);
		}
	});
}

function umPorVez(i) {
	if(ListPost.size()>0) {
		getPost(ListPost.get(i).ID, function(thePost) { 
			if(ListPost.size()>0) {
				ListPost.set(i, thePost); //atualiza
				io.sockets.emit('updatePost', {ID: thePost.ID, ImgUrl: thePost.ImgUrl, Like: thePost.Like, Comment: thePost.Comment, osComments: thePost.osComments});
				console.log('foi -> '+i + ' ID-> '+thePost.ID);
				i++;
				if(i>=ListPost.size()) {
					i=0;
				}
				
				umPorVez(i);
			}
		});
	}
}

/*
function addPost(ID) {
	getPost(ID, function(thePost) {
			io.sockets.emit('addPost', {ID: thePost.ID, ImgUrl: thePost.ImgUrl, Like: thePost.Like, Comment: thePost.Comment});
			ListPost.add(thePost);

			// fica atualizando
			var f = function(iPost) {
				io.sockets.emit('updatePost', {ID: iPost.ID, ImgUrl: iPost.ImgUrl, Like: iPost.Like, Comment: iPost.Comment});
				
				// verificando se ainda existe o Post
				var bTemID = false;
				for(i=0; i<ListPost.size(); i++) {
					if(ListPost.get(i).ID == iPost.ID) {
						bTemID = true;
					}
				}

				if(bTemID) {
					getPost(iPost.ID, f);	
				}
				
			}
			getPost(thePost.ID, f);

		});
} 
*/

/* Get um Post */
function getPost(ID, onComplete) {
	request('http://www.instagram.com/p/'+ID+'/', function (error, response, body) {
		if (!error && response.statusCode == 200) {

			var objJson = JSON.parse( getJSON(body) );
			
			var ImgUrl = objJson.entry_data.PostPage[0].media.display_src; //getValor(body, 'display_src', 0);
			var Like = objJson.entry_data.PostPage[0].media.likes.count; //getValor(body, 'likes": {"count', 1);
			var Comment = objJson.entry_data.PostPage[0].media.comments.count; //getValor(body, 'comments": {"count', 1);

			var osComments = [];
			var nComments = objJson.entry_data.PostPage[0].media.comments.nodes.length;
			for(i=0; i<nComments; i++) {
				try {
					var _text = objJson.entry_data.PostPage[0].media.comments.nodes[i].text;
					var _username = objJson.entry_data.PostPage[0].media.comments.nodes[i].user.username;
					osComments.push({text: _text, username: _username});
				} catch (err) {
					console.log('erro ao obter comentario '+err);
				}
				
				
			}

			/*
			fs.writeFile("./tmp/jsonPego.txt", getJSON(body), function(err) {
			    if(err) {
			        return console.log(err);
			    }

			    console.log("Json foi pego do body");
			});
			*/
			var thePost = new PostClass(ID, ImgUrl, Like, Comment, osComments);
		} else {
			var thePost = new PostClass(ID, "", "", "", "");
		}
		onComplete(thePost);
	});
}
/* ------------------------- */

/* Procurador do JSON DATA do body da page */
function getJSON(body) {
	//key unica que acha o INICIO do json: >> {"country_code": <<
	//key unica que acha o FIM do json: >> "environment_switcher_visible_server_guess": true} <<
	//se nao achar esse fim, procura por: >> "environment_switcher_visible_server_guess": false} <<

	var key_inicio = '{"country_code":';
	var key_fim1   = '"environment_switcher_visible_server_guess": true}';
	var key_fim2   = '"environment_switcher_visible_server_guess": false}';

	var inicio = body.indexOf(key_inicio);
	var fim = (body.indexOf(key_fim1)!=-1) ? body.indexOf(key_fim1)+key_fim1.length : body.indexOf(key_fim2)+key_fim2.length;

	return body.slice(inicio,fim);
}


function getComentario(nMax) {
	//nMax será o numero maximos de comentários pego...


}