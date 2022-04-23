class Match {
    _clients = [];
    _appId = "";
    _matchId = "";
    _host = "";
    _private = true;
    _open = true;
    _lastDataTimestamp = -1;
    
    constructor(appId, matchId, hostIp, privateMatch) {
        this._appId = appId;
        this._matchId = matchId;
        this._host = hostIp;
        this._private = privateMatch;
        this.logActivity();
    }

    getAppId() {
        return this._appId;
    }

    getMatchId() {
        return this._matchId;
    }

    getClientIps() {
        return this._clients;
    }

    getHost() {
        return this._host;
    }

    getAllUserIps() {
        let users = [this._host];
        users.push(this._clients);
        return users;
    }

    isHost(ipAddress) {
        return this._host == ipAddress;
    }

    isAbandoned() {
        return Date.now() - this._lastDataTimestamp > 600000; // 10 mins no activity
    }

    isOpen() {
        return true;
    }

    setOpen(state) {
        this._open = state;
    }

    isPublic() {
        return !this._private;
    }

    hasClient(ipAddress) {
        return this._clients.indexOf(ipAddress) > -1;
    }

    addClient(ipAddress) {
        if (ipAddress != this._host && !this.hasClient(ipAddress)) {
            this._clients.push(ipAddress);
        }
        this.logActivity();
    }

    logActivity() {
        this._lastDataTimestamp = Date.now();
    }
}

module.exports = Match;