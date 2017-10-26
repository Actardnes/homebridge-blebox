var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var GATEBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.GATEBOX;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, gateInfo) {
        return new GateBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, gateInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new GateBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.gate);
    }
};

function GateBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, gateInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.gateInfo = gateInfo ? (gateInfo.gate || gateInfo) : null;

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.currentDoorStateCharacteristic = api.hap.Characteristic.CurrentDoorState;
    this.targetDoorStateCharacteristic = api.hap.Characteristic.TargetDoorState;
    this.obstructionDetectedCharacteristic = api.hap.Characteristic.ObstructionDetected;
    this.garageDoorOpenerService = api.hap.Service.GarageDoorOpener;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + GATEBOX_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);
        this.accessory.addService(this.garageDoorOpenerService, this.deviceName);
    }

    this.accessory.getService(this.garageDoorOpenerService)
        .getCharacteristic(this.currentDoorStateCharacteristic)
        .on('get', this.getCurrentDoorState.bind(this));

    this.accessory.getService(this.garageDoorOpenerService)
        .getCharacteristic(this.targetDoorStateCharacteristic)
        .on('get', this.getTargetDoorState.bind(this))
        .on('set', this.setTargetDoorState.bind(this));

    this.accessory.getService(this.garageDoorOpenerService)
        .getCharacteristic(this.obstructionDetectedCharacteristic)
        .on('get', this.getObstructionDetected.bind(this));

    this.accessory.getService(this.garageDoorOpenerService)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": GATEBOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "gate": this.gateInfo
    };

    this.updateCharacteristics();
    this.startListening();
}

GateBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

GateBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getGateState, self.deviceIp, {
        onSuccess: function (gateInfo) {
            if (gateInfo) {
                self.badRequestsCounter = 0;
                gateInfo = gateInfo.gate || gateInfo;
                self.gateInfo = gateInfo;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

GateBoxAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.gateInfo) {
        //update characteristics
        this.accessory.getService(this.garageDoorOpenerService)
            .updateCharacteristic(this.currentDoorStateCharacteristic, this.getCurrentDoorStateValue());
    }
};

GateBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.garageDoorOpenerService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};

GateBoxAccessoryWrapper.prototype.getCurrentDoorStateValue = function () {
    var state = this.currentDoorStateCharacteristic.OPEN; //default value
    if (this.gateInfo) {
        var currentPosition = Number(this.gateInfo.currentPos) || 0;
        if (currentPosition === 0) {
            state = this.currentDoorStateCharacteristic.CLOSED;
        }
    }
    return state;
};

GateBoxAccessoryWrapper.prototype.getCurrentDoorState = function (callback) {
    this.log("GATEBOX ( %s ): Getting 'current door' characteristic ...", this.deviceName);
    if (this.isResponding() && this.gateInfo) {
        var currentState = this.getCurrentDoorStateValue();
        this.log("GATEBOX ( %s ): Current 'current door' characteristic is %s", this.deviceName, currentState);
        callback(null, currentState);
    } else {
        this.log("GATEBOX ( %s ): Error getting 'current door' characteristic. GateInfo: %s", this.deviceName, this.gateInfo);
        callback(new Error("Error getting 'current door'."));
    }
};


GateBoxAccessoryWrapper.prototype.getTargetDoorState = function (callback) {
    this.log("GATEBOX ( %s ): Getting 'target door' characteristic ...", this.deviceName);
    if (this.isResponding() && this.gateInfo) {
        var currentState = this.getCurrentDoorStateValue();
        this.log("GATEBOX ( %s ): Current 'target door' characteristic is %s", this.deviceName, currentState);
        callback(null, currentState);
    } else {
        this.log("GATEBOX ( %s ): Error getting 'target door' characteristic. GateInfo: %s", this.deviceName, this.gateInfo);
        callback(new Error("Error getting 'target door'."));
    }
};

GateBoxAccessoryWrapper.prototype.setTargetDoorState = function (state, callback) {
    this.log("GATEBOX ( %s ): Setting 'target door' characteristic to %s", this.deviceName, state);
    var self = this;
    communication.send(bleboxCommands.setSimpleGateState, this.deviceIp, {
        onSuccess: function (gateInfo) {
            if (gateInfo) {
                self.gateInfo = gateInfo.gate || gateInfo;
                self.updateCharacteristics();
                callback(null); // success
            } else {
                callback(new Error("Error setting 'target door'."));
            }
        }, onError: function () {
            callback(new Error("Error setting 'target door'."));
        }
    });
};

GateBoxAccessoryWrapper.prototype.getObstructionDetected = function (callback) {
    this.log("GATEBOX ( %s ): Getting 'obstruction detected' characteristic ...", this.deviceName);
    if (this.isResponding()) {
        this.log("GATEBOX ( %s ): Current 'obstruction detected' characteristic is %s", this.deviceName, false);
        callback(null, false);
    } else {
        this.log("GATEBOX ( %s ): Error getting 'obstruction detected' characteristic.", this.deviceName);
        callback(new Error("Error getting 'obstruction detected'."));
    }
};
