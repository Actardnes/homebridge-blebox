var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var NON_ALPHANUMERIC_REGEX = /[^a-zA-Z0-9\u00C0-\u024F]/g;

module.exports = AbstractAccessoryWrapper;

function AbstractAccessoryWrapper(accessory, log, deviceInfo) {
    this.log = log;
    this.deviceId = deviceInfo.id;

    this.deviceName = deviceInfo.deviceName ? deviceInfo.deviceName.replace(NON_ALPHANUMERIC_REGEX, ' ') : "";
    this.deviceIp = deviceInfo.ip;
    this.badRequestsCounter = 0;
    this.accessory = accessory;
}

AbstractAccessoryWrapper.prototype.maxBadRequestsCount = 4;

AbstractAccessoryWrapper.prototype.deviceStateIntervalInMs = 30000;

AbstractAccessoryWrapper.prototype.specificStateIntervalInMs = 10000;

AbstractAccessoryWrapper.prototype.getAccessory = function () {
    return this.accessory;
};

AbstractAccessoryWrapper.prototype.setDeviceIp = function (deviceInfo) {
    this.deviceIp = deviceInfo.ip || this.deviceIp;
    this.startListening();
};

AbstractAccessoryWrapper.prototype.isResponding = function () {
    return this.badRequestsCounter <= this.maxBadRequestsCount;
};

AbstractAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.log("Abstract: Device name change: %s", this.deviceName);
};

AbstractAccessoryWrapper.prototype.checkDeviceState = function () {
    var self = this;
    communication.send(bleboxCommands.getDeviceState, self.deviceIp, {
        onSuccess: function (deviceInfo) {
            if (deviceInfo) {
                deviceInfo = deviceInfo.device || deviceInfo;
                if (self.deviceId == deviceInfo.id) {
                    self.badRequestsCounter = 0;
                    if (self.deviceName != deviceInfo.deviceName) {
                        self.deviceName = deviceInfo.deviceName ? deviceInfo.deviceName.replace(NON_ALPHANUMERIC_REGEX, ' ') : "";
                        self.onDeviceNameChange();
                    }
                } else {
                    self.badRequestsCounter = self.maxBadRequestsCount + 1;
                    self.stopListening();
                }
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

AbstractAccessoryWrapper.prototype.checkSpecificState = function () {
    throw new Error("Method 'checkSpecificState' not implemented!");
};

AbstractAccessoryWrapper.prototype.startListening = function () {
    this.stopListening();
    var randomDelay = Math.floor(Math.random() * 5000);
    this.checkDeviceState();
    this.deviceStateInterval = setInterval(this.checkDeviceState.bind(this), this.deviceStateIntervalInMs + randomDelay);
    this.checkSpecificState();
    this.specificStateInterval = setInterval(this.checkSpecificState.bind(this), this.specificStateIntervalInMs + randomDelay);
};

AbstractAccessoryWrapper.prototype.stopListening = function () {
    clearInterval(this.deviceStateInterval);
    clearInterval(this.specificStateInterval);
};


AbstractAccessoryWrapper.prototype.getName = function (callback) {
    this.log("( %s ): Getting 'name' characteristic ...", this.deviceName);
    if (this.isResponding() && this.deviceName) {
        this.log("( %s ): Current 'name' characteristic is %s", this.deviceName, this.deviceName);
        callback(null, this.deviceName);
    } else {
        this.log("( %s ): Error getting 'name' characteristic. Name: %s", this.deviceName, this.deviceName);
        callback(new Error("Error getting 'name'."));
    }
};