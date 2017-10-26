var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var SWITCHBOXD_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SWITCHBOXD;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, relaysInfo) {
        return new SwitchBoxDAccessoryWrapper(homebridge, null, log, api, deviceInfo, relaysInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new SwitchBoxDAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.relays);
    }
};

function SwitchBoxDAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, relaysInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.relays = relaysInfo ? (relaysInfo.relays || relaysInfo) : null;

    this.firstServiceSubtype = "Output 1";
    this.secondServiceSubtype = "Output 2";

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.onCharacteristic = api.hap.Characteristic.On;
    this.switchService = api.hap.Service.Switch;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + SWITCHBOXD_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);
        this.firstServiceName = this.getServiceName(0);
        this.accessory.addService(this.switchService, this.firstServiceName, this.firstServiceSubtype);

        this.secondServiceName = this.getServiceName(1);
        this.accessory.addService(this.switchService, this.secondServiceName, this.secondServiceSubtype);
    }

    this.accessory.getServiceByUUIDAndSubType(this.switchService, this.firstServiceSubtype)
        .getCharacteristic(this.onCharacteristic)
        .on('get', this.getOnState.bind(this, 0))
        .on('set', this.setOnState.bind(this, 0));

    this.accessory.getServiceByUUIDAndSubType(this.switchService, this.firstServiceSubtype)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this, 0));

    this.accessory.getServiceByUUIDAndSubType(this.switchService, this.secondServiceSubtype)
        .getCharacteristic(this.onCharacteristic)
        .on('get', this.getOnState.bind(this, 1))
        .on('set', this.setOnState.bind(this, 1));

    this.accessory.getServiceByUUIDAndSubType(this.switchService, this.secondServiceSubtype)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this, 1));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": SWITCHBOXD_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "relays": this.relays
    };

    this.updateCharacteristics();
    this.startListening();
}

SwitchBoxDAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

SwitchBoxDAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getRelayState, self.deviceIp, {
        onSuccess: function (relayState) {
            if (relayState) {
                self.badRequestsCounter = 0;
                relayState = relayState.relays || relayState;
                self.relays = relayState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

SwitchBoxDAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.relays) {
        //update characteristics
        this.accessory.getServiceByUUIDAndSubType(this.switchService, this.firstServiceSubtype)
            .updateCharacteristic(this.onCharacteristic, this.getCurrentRelayValue(0));

        this.accessory.getServiceByUUIDAndSubType(this.switchService, this.secondServiceSubtype)
            .updateCharacteristic(this.onCharacteristic, this.getCurrentRelayValue(1));
    }
};

SwitchBoxDAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getServiceByUUIDAndSubType(this.switchService, this.firstServiceSubtype)
        .updateCharacteristic(this.nameCharacteristic, this.getServiceName(0));

    this.accessory.getServiceByUUIDAndSubType(this.switchService, this.secondServiceSubtype)
        .updateCharacteristic(this.nameCharacteristic, this.getServiceName(1));
};

SwitchBoxDAccessoryWrapper.prototype.getServiceName = function (relayNumber) {
    var name_postfix = "";
    if (this.relays && this.relays.length > relayNumber && this.relays[relayNumber].name) {
        name_postfix = this.relays[relayNumber].name;
    } else {
        switch (relayNumber) {
            case 0:
                name_postfix = this.firstServiceSubtype;
                break;
            case 1:
            default:
                name_postfix = this.secondServiceSubtype;
                break;
        }
    }

    return this.deviceName + " " + name_postfix;
};

SwitchBoxDAccessoryWrapper.prototype.getCurrentRelayValue = function (relayNumber) {
    var result = false;
    if (this.relays && this.relays.length > relayNumber) {
        result = !!this.relays[relayNumber].state
    }
    return result;
};

SwitchBoxDAccessoryWrapper.prototype.getOnState = function (relayNumber, callback) {
    this.log("SWITCHBOXD ( %s ): Getting 'On' characteristic ...", this.deviceName);
    if (this.isResponding()) {
        var value = this.getCurrentRelayValue(relayNumber);
        this.log("SWITCHBOXD ( %s ): Current 'On' characteristic is %s", this.deviceName, value);
        callback(null, value);
    } else {
        this.log("SWITCHBOXD ( %s ): Error getting 'On' characteristic. Relays: %s", this.deviceName, this.relays);
        callback(new Error("Error getting 'On'."));
    }
};

SwitchBoxDAccessoryWrapper.prototype.setOnState = function (relayNumber, turnOn, callback) {
    this.log("SWITCHBOXD ( %s ): Setting 'On' characteristic to %s ...", this.deviceName, turnOn);
    var onOffParam = (turnOn ? "1" : "0");
    var self = this;
    communication.send(bleboxCommands.setSimpleRelaysState, this.deviceIp, {
        params: [relayNumber, onOffParam],
        onSuccess: function (relayState) {
            if (relayState) {
                self.relays = relayState.relays || relayState;
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

SwitchBoxDAccessoryWrapper.prototype.getName = function (relayNumber, callback) {
    this.log("( %s ): Getting 'name' characteristic ...", this.deviceName);
    if (this.isResponding() && this.deviceName) {
        var currentName = this.getServiceName(relayNumber);
        this.log("( %s ): Current 'name' characteristic is %s", this.deviceName, currentName);
        callback(null, currentName);
    } else {
        this.log("( %s ): Error getting 'name' characteristic. Name: %s", this.deviceName, this.deviceName);
        callback(new Error("Error getting 'name'."));
    }
};
