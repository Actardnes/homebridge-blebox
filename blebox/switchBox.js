var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var SWITCHBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SWITCHBOX;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, relayInfo) {
        return new SwitchBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, relayInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new SwitchBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.relay);
    }
};

function SwitchBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, relayInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.relay = relayInfo ? (relayInfo.relays || relayInfo) : null;

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.onCharacteristic = api.hap.Characteristic.On;
    this.switchService = api.hap.Service.Switch;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + SWITCHBOX_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);
        this.accessory.addService(this.switchService, this.deviceName);
    }

    this.accessory.getService(this.switchService)
        .getCharacteristic(this.onCharacteristic)
        .on('get', this.getOnState.bind(this))
        .on('set', this.setOnState.bind(this));

    this.accessory.getService(this.switchService)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this));

    //for restore purpose
    this.accessory.context.blebox = {
        "type" : SWITCHBOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "relay": this.relay
    };

    this.updateCharacteristics();
    this.startListening();
}

SwitchBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

SwitchBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getRelayState, self.deviceIp, {
        onSuccess: function (relayState) {
            if (relayState) {
                self.badRequestsCounter = 0;
                relayState = relayState.relays || relayState;
                self.relay = relayState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

SwitchBoxAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.relay) {
        //update characteristics
        this.accessory.getService(this.switchService)
            .updateCharacteristic(this.onCharacteristic, this.getCurrentRelayValue());
    }
};

SwitchBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.switchService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};

SwitchBoxAccessoryWrapper.prototype.getCurrentRelayValue = function () {
    var result = false;
    if (this.relay && this.relay.length > 0) {
        result = this.relay[0].state ? true : false
    }
    return result;
};

SwitchBoxAccessoryWrapper.prototype.getOnState = function (callback) {
    this.log("SWITCHBOX ( %s ): Getting 'On' characteristic ...", this.deviceName);
    if (this.isResponding()) {
        var value = this.getCurrentRelayValue();
        this.log("SWITCHBOX ( %s ): Current 'On' characteristic is %s", this.deviceName, value);
        callback(null, value);
    } else {
        this.log("SWITCHBOX ( %s ): Error getting 'On' characteristic. Relay: %s", this.deviceName, this.relay);
        callback(new Error("Error getting 'On'."));
    }
};

SwitchBoxAccessoryWrapper.prototype.setOnState = function (turnOn, callback) {
    this.log("SWITCHBOX ( %s ): Setting 'On' characteristic to %s ...", this.deviceName, turnOn);
    var onOffParam = (turnOn ? "1" : "0");
    var self = this;
    communication.send(bleboxCommands.setSimpleRelayState, this.deviceIp, {
        params: [onOffParam],
        onSuccess: function (relayState) {
            if (relayState) {
                self.relay = relayState.relays || relayState;
                self.updateCharacteristics();
                callback(null); // success
            } else {
                callback(new Error("Error setting 'On'."));
            }
        },
        onError: function () {
            callback(new Error("Error setting 'On'."));
        }
    });
};
