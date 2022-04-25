const Match = require("./match");
const udp = require('dgram');
const crypto = require('crypto');
const http = require("http");
const url = require('url');


const _relayPort = 7777;
const _appIds = ['test']; // used to tell the server if the connection is from a valid source


// ---------------------------------------------------------
// MATCH OPERATIONS

let _clients = {};
let _matches = {};

function generateMatchId() {
    let matchId = null; 
    while (matchId == null || _matches[matchId] != null) {
        matchId = crypto.randomBytes(3).toString('hex');
    }
    return matchId;
}

function createMatch(hostIp, appId, public) {
    let matchId = generateMatchId(); //create a unique code for this match
    let match = new Match(appId, matchId, hostIp, false);
    _matches[matchId] = match;
    console.log(`Match Created: ${matchId}`);
    return matchId;
}

function joinMatch(clientIp, appId, matchId) {
    let match = null;
    if (matchId == null || matchId == '') { // if matchId is empty, find a match for them
        match = Object.values(_matches).find(m => m.isOpen() && m.isPublic());
    } else {
        match = _matches[matchId];
    }

    if (match == null || match.getAppId() != appId) return false;

    _clients[clientIp] = matchId;
    match.addClient(clientIp);
    return true;
}

function listMatches(appId) {
    const available = Object.values(_matches).filter(match => match.isOpen() && match.isPublic() && match.getAppId() == appId);
    return available.map(match => match.getMatchId());
}

function removeMatch(matchId) {
    const match = _matches[matchId];
    if (match != null) {
        match.getAllUsers().forEach(ip => {
            delete _clients[ip];
        });
        delete _matches[matchId];
        return true;
    }
    return false;
}


// ---------------------------------------------------------
// MATCH CLEANUP

setInterval(function cleanup () {
    const clean = Object.values(_matches).filter(match => match.isAbandoned());
    let count = 0;
    clean.forEach(match => {
        if (removeMatch(match.getMatchId())) {
            count++;
        }
    });
    if (count > 0) {
        console.log(`Match Cleanup: ${count} removed`);
    }
}, 300000); // every 5 mins


// ---------------------------------------------------------
// HTTP SERVER

const requestListener = async function (req, res) {
    // handle match requests
    const buffers = [];

    for await (const chunk of req) {
        buffers.push(chunk);
    }
    
    const data = Buffer.concat(buffers).toString();
    const json = JSON.parse(data);
    
    let status = 200;
    let body;
    if (_appIds.indexOf(json.appId) < 0) {
        status = 401; // unathorized appId
    } else {
        const clientIp = req.socket.remoteAddress;
        switch(json.method) {
            case 'create':
                body = JSON.stringify({matchId: createMatch(clientIp, json.appId, json.public)});
                break;
            case 'join':
                body = JSON.stringify({success: joinMatch(clientIp, json.appId, json.matchId)});
                break;
            case 'list':
                body = JSON.stringify({list: listMatches(json.appId)});
                break;
            default:
                status = 400; // bad request
                break;
        }
    }
    res.writeHead(status);
    res.end(body);
};

const httpServer = http.createServer(requestListener);
httpServer.listen(8080, () => {
    console.log(`HTTP listening on port: 8080`);
});


// ---------------------------------------------------------
// UDP SERVER

const udpServer = udp.createSocket('udp4');

udpServer.on('error', function(error) {
    console.log(`Error: ${error}`);
    server.close();
});

udpServer.on('message', function(data, info) {
    console.log(`Received ${data.length} bytes from ${info.address} ${info.port}`);

    // relay along to match for client (if applicable)
    const sourceIp = info.address;
    const matchId = _clients[sourceIp];
    const match = _matches[matchId];

    if (match == null) return;
    if (!match.hasClient(sourceIp)) return;

    function transferData(destIp, destPort, data) {
        udpServer.send(data, destPort, destIp, function(error) {
            if (error) {
                console.log(`Relay Error: ${error}`);
            }
        });
    }
    
    if (match.isHost(sourceIp)) {
        match.getClientIps().forEach(clientIp => {
            transferData(clientIp, _relayPort, data);
        });
    } else {
        transferData(match.getHost(), _relayPort, data);
    }

    match.logActivity();
});

udpServer.on('listening', function() {
    const address = udpServer.address();
    const port = address.port;
    const ip = address.address;
    console.log(`Relay listening on port: ${port}`);
});

udpServer.on('close', function() {
    console.log('Socket closed.');
});

udpServer.bind(_relayPort);