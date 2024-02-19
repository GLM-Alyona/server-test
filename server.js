const WS = require('ws');
const { v4: uuid } = require('uuid');
const openai = require('openai');

const port = process.env.PORT || 8080;
const wss = new WS.Server({ port });
const apiKey = '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';
const openaiApi = new openai(apiKey);

const clients = {};
const messages = [];
let messageIsPinned = false;
let greet = false;

wss.on('connection', (ws) => {
	const clientID = uuid();
	clients.clientID = ws;
	let loadBegin = -10;
	let loadEnd = messages.length;
	let loadArr = messages;
	let allLoaded = false;
	ws.on('message', (rawMessage) => {
		const message = JSON.parse(rawMessage);
		console.log(message);

		if (message.init) {
			if (!messages.length) {
				return;	
			}
			if(allLoaded) {
				clients.clientID.send(
					JSON.stringify({
						allLoaded: allLoaded,
					})
				);
				return;
			}
			if(messages.length >= 10) {
				if(loadArr.length < 10) {
					loadArr = messages;
					loadBegin = -10;
					loadEnd = messages.length;
					allLoaded = true;
					clients.clientID.send(
						JSON.stringify({
							allLoaded: allLoaded,
							messages: loadArr.reverse(),
						})
					);
					return;
				  }
				  
				  loadArr = messages.slice(loadBegin, loadEnd);
				  loadBegin -= 10;
				  loadEnd -= 10;
				  console.log('lol')
				  clients.clientID.send(
					JSON.stringify({
						lazyload: true,
						messages: loadArr.reverse(),
					})
				  );
				  if (messageIsPinned) {
					const pinnedMes = messages.find((mes) => mes.pinned);
					clients.clientID.send(
						JSON.stringify({
							pinMessage: true,
							message: pinnedMes,
						})
					);
				}
			} else {
				allLoaded = true;
				messages.forEach((mes) => {
					clients.clientID.send(
						JSON.stringify({
							init: true,
							messages: messages,
						})
					);
				});
				if (messageIsPinned) {
					const pinnedMes = messages.find((mes) => mes.pinned);
					clients.clientID.send(
						JSON.stringify({
							pinMessage: true,
							message: pinnedMes,
						})
					);
				}
			}	
		} else if (message.greet) {
			if(greet) {
				return;
			}
			if (messages.length) {
				clients.clientID.send(
					JSON.stringify({
						id: messages[0].id,
						usertype: messages[0].usertype,
						username: messages[0].username,
						date: messages[0].date,
						content: messages[0].content,
					})
				);
				greet = true;
			} else {
				const id = uuid(),
					date = new Date().getTime();
				messages.push({
					id: id,
					usertype: message.usertype,
					username: message.botname ? message.botname : clientID,
					date: date,
					content: message.content,
				});
				clients.clientID.send(
					JSON.stringify({
						id: id,
						usertype: message.usertype,
						username: message.botname ? message.botname : clientID,
						date: date,
						content: message.content,
					})
				);
				greet = true;
			}
		} else if (message.search) {
			let filter;

			if (message.value === '') {
				filter = messages;
			} else {
				filter = messages.filter((mes) => {
					const checked = mes.content.find(
						(cnt) => cnt.type === 'text'
					);
					if (checked) {
						return checked.body
							.toLowerCase()
							.includes(message.value);
					}
				});
			}

			const response = {
				search: true,
				messages: filter,
			};
			clients.clientID.send(JSON.stringify(response));
		} else if (message.addToFavorite) {
			messages.forEach((mes) => {
				if (mes.id === message.id) {
					mes.favorite = message.favorite;
				} else {
					return;
				}
			});
		} else if (message.pinMessage) {
			if (messageIsPinned) {
				return;
			}
			messages.forEach((mes) => {
				if (mes.id === message.id) {
					if (mes.pinned) {
						return;
					}
					mes.pinned = message.pinned;
					messageIsPinned = true;
					clients.clientID.send(
						JSON.stringify({ pinMessage: true, message: mes })
					);
				} else {
					return;
				}
			});
		} else if (message.unpinMessage) {
			messages.forEach((mes) => {
				if (mes.id === message.id) {
					mes.pinned = message.pinned;
					messageIsPinned = false;
				} else {
					return;
				}
			});
		} else if (message.showFavorite) {
			const favorites = messages.filter((mes) => mes.favorite);
			clients.clientID.send(
				JSON.stringify({ showFavorite: true, messages: favorites })
			);
		} else if (message.showAll) {
			clients.clientID.send(
				JSON.stringify({ showAll: true, messages: messages })
			);
			if (messageIsPinned) {
				const pinnedMes = messages.find((mes) => mes.pinned);
				clients.clientID.send(
					JSON.stringify({
						pinMessage: true,
						message: pinnedMes,
					})
				);
			}
		} else {
			const id = uuid(),
				date = new Date().getTime();
			messages.push({
				id: id,
				usertype: message.usertype,
				username: message.botname ? message.botname : clientID,
				date: date,
				content: message.content,
				pinned: message.pinned,
				favorite: message.favorite,
			});

			clients.clientID.send(
				JSON.stringify({
					id: id,
					usertype: message.usertype,
					username: message.botname ? message.botname : clientID,
					date: date,
					content: message.content,
					pinned: message.pinned,
					favorite: message.favorite,
				})
			);
		}
	});

	ws.on('close', () => {
		delete clients.clientID;
	});
});