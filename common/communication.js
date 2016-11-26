var httpRequest = require("request");

module.exports = (function () {
    var communicationModule = new CommunicationModule();

    return {
        send: function (comand, ip, extraData) {
            communicationModule.addToQueue(comand, ip, extraData);
        }
    }
})();

function CommunicationModule() {
    this.currentRequest = {};
    this.nextRequest = {};
    this.delayInMs = 300;
    this.defaultRequestTimeoutInMs = 5000;
}

CommunicationModule.prototype.getRequestKey = function (command, ip) {
    return (ip || "") + "_" + (command ? command.name : "");
};

CommunicationModule.prototype.addToQueue = function (command, ip, extraData) {
    if (command && ip) {
        var requestKey = this.getRequestKey(command, ip);
        if (this.currentRequest[requestKey]) {
            this.nextRequest[requestKey] = {command: command, ip: ip, extraData: extraData};
        } else {
            this.currentRequest[requestKey] = {command: command, ip: ip, extraData: extraData};
            this.sendRequest(this.currentRequest[requestKey]);
        }
    } else {
        console.log("Cannot add to queue Command %s, Ip %s, ExtraData: %s", command, ip, extraData);
    }
};

CommunicationModule.prototype.sendRequest = function (request) {
    if (request && request.ip && request.command) {
        var ip = request.ip;
        var command = request.command;
        var url = "http://" + ip + command.url;
        //assign url params if given
        var extraData = request.extraData;
        if (extraData && extraData.params) {
            for (var i = 0; i < extraData.params.length; i++) {
                url = url.replace("{" + i + "}", extraData.params[i])
            }
        }
        //clear any unassigned subpaths
        url = url.replace(/(\/{)(\d)+(})/g, "");

        var requestOptions = {
            url: url,
            headers: {
                'Accept': '*/*',
                'Host': ip //fix (some devices not respond when "Host" first letter is lowercase)
            },
            timeout: this.defaultRequestTimeoutInMs
        };

        switch (command.method.toLowerCase()) {
            case "get":
                httpRequest.get(requestOptions, this.processResponse.bind(this, request));
                break;
            case "post":
                httpRequest.post(requestOptions, this.processResponse.bind(this, request));
                break;
            case "put":
                httpRequest.put(requestOptions, this.processResponse.bind(this, request));
                break;
            default:
                console.log("Unknown method type: %s", command.method);
        }
    } else {
        console.log("Cannot send request: ", request);
    }
};

CommunicationModule.prototype.processResponse = function (request, err, response, body) {
    var extraData = request.extraData;
    if (!err && response.statusCode == 200) {
        if (extraData && extraData.onSuccess) {
            var bodyAsJson = {};
            try {
                bodyAsJson = JSON.parse(body);
            }catch(ex){
                console.log("Cannot parse: %s", body);
            }
            setTimeout(function () {
                extraData.onSuccess(bodyAsJson);
            }, 0)
        }
    } else {
        if (extraData && extraData.onError) {
            setTimeout(function () {
                extraData.onError();
            }, 0)
        }
    }
    var requestKey = this.getRequestKey(request.command, request.ip);
    this.currentRequest[requestKey] = this.nextRequest[requestKey];
    this.nextRequest[requestKey] = null;
    if (this.currentRequest[requestKey]) {
        setTimeout(this.sendRequest.bind(this, this.currentRequest[requestKey]), this.delayInMs);
    }
};