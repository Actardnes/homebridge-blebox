var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var SHUTTERBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SHUTTERBOX;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, shutterInfo) {
        return new ShutterBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, shutterInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new ShutterBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.shutter);
    }
};

function ShutterBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, shutterInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.shutter = shutterInfo ? (shutterInfo.shutter || shutterInfo) : null;

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.currentPositionCharacteristic = api.hap.Characteristic.CurrentPosition;
    this.targetPositionCharacteristic = api.hap.Characteristic.TargetPosition;
    this.postitionStateCharacteristic = api.hap.Characteristic.PositionState;
    this.windowCoveringService = api.hap.Service.WindowCovering;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + SHUTTERBOX_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);
        this.accessory.addService(this.windowCoveringService, this.deviceName);
    }

    this.accessory.getService(this.windowCoveringService)
        .getCharacteristic(this.postitionStateCharacteristic)
        .on('get', this.getPositionState.bind(this));

    this.accessory.getService(this.windowCoveringService)
        .getCharacteristic(this.currentPositionCharacteristic)
        .on('get', this.getCurrentPosition.bind(this));

    this.accessory.getService(this.windowCoveringService)
        .getCharacteristic(this.targetPositionCharacteristic)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.accessory.getService(this.windowCoveringService)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": SHUTTERBOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "shutter": this.shutter
    };

    this.updateCharacteristics();
    this.startListening();
}

ShutterBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

ShutterBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getShutterState, this.deviceIp, {
        onSuccess: function (shutterState) {
            if (shutterState) {
                self.badRequestsCounter = 0;
                shutterState = shutterState.shutter || shutterState;
                self.shutter = shutterState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

ShutterBoxAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.shutter) {
        //update characteristics
        this.accessory.getService(this.windowCoveringService)
            .updateCharacteristic(this.currentPositionCharacteristic, this.getCurrentPositionValue());

        this.accessory.getService(this.windowCoveringService)
            .updateCharacteristic(this.targetPositionCharacteristic, this.getTargetPositionValue());

        this.accessory.getService(this.windowCoveringService)
            .updateCharacteristic(this.postitionStateCharacteristic, this.getPositionStateValue());
    }
};

ShutterBoxAccessoryWrapper.prototype.getCurrentPositionValue = function () {
    var currentPosition = 0;
    if (this.shutter && this.shutter.currentPos) {
        currentPosition = (Number(this.shutter.currentPos.position) || ( Number(this.shutter.currentPos) || 0));
        currentPosition = 100 - Math.min(Math.max(currentPosition, 0), 100);
    }
    return currentPosition;
};

ShutterBoxAccessoryWrapper.prototype.getTargetPositionValue = function () {
    var currentPosition = 0;
    if (this.shutter && this.shutter.desiredPos) {
        currentPosition = (Number(this.shutter.desiredPos.position) || ( Number(this.shutter.desiredPos) || 0));
        currentPosition = 100 - Math.min(Math.max(currentPosition, 0), 100);
    }
    return currentPosition;
};

ShutterBoxAccessoryWrapper.prototype.getPositionStateValue = function () {
    var positionState = this.postitionStateCharacteristic.STOPPED;
    if (this.shutter) {
        switch (this.shutter.state) {
            case 0: //down
                positionState = this.postitionStateCharacteristic.DECREASING;
                break;
            case 1: // up
                positionState = this.postitionStateCharacteristic.INCREASING;
                break;
            default:
                positionState = this.postitionStateCharacteristic.STOPPED;
                break;
        }
    }
    return positionState;
};

ShutterBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.windowCoveringService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};

ShutterBoxAccessoryWrapper.prototype.getCurrentPosition = function (callback) {
    this.log("SHUTTERBOX ( %s ): Getting 'Current position' characteristic ...", this.deviceName);
    if (this.isResponding() && this.shutter) {
        var currentPosition = this.getCurrentPositionValue();
        this.log("SHUTTERBOX ( %s ): Current 'Current position' characteristic is %s", this.deviceName, currentPosition);

        callback(null, currentPosition);
    } else {
        this.log("SHUTTERBOX ( %s ): Error getting 'Current position' characteristic. Shutter: %s", this.deviceName, this.shutter);
        callback(new Error("Error getting 'Current position'."));
    }
};

ShutterBoxAccessoryWrapper.prototype.getTargetPosition = function (callback) {
    this.log("SHUTTERBOX ( %s ): Getting 'Target position' characteristic ...", this.deviceName);
    if (this.isResponding() && this.shutter) {
        var currentPosition = this.getTargetPositionValue();
        this.log("SHUTTERBOX ( %s ): Current 'Target position' characteristic is %s", this.deviceName, currentPosition);

        callback(null, currentPosition);
    } else {
        this.log("SHUTTERBOX ( %s ): Error getting 'Target position' characteristic. Shutter: %s", this.deviceName, this.shutter);
        callback(new Error("Error getting 'Target position'."));
    }
};

ShutterBoxAccessoryWrapper.prototype.setTargetPosition = function (position, callback) {
    this.log("SHUTTERBOX: Setting 'target position' characteristic to %s ...", position);
    position = 100 - position;
    var self = this;
    var command = this.shutter.desiredPos.position != undefined ? bleboxCommands.setSimplePositionShutterState : bleboxCommands.setSimpleShutterState;
    communication.send(command, this.deviceIp, {
        params: [position],
        onSuccess: function (shutterState) {
            if (shutterState) {
                self.shutter = shutterState.shutter || shutterState;
                self.updateCharacteristics();
                callback(null); // success
            } else {
                callback(new Error("Error setting 'target position'."));
            }
        },
        onError: function () {
            callback(new Error("Error setting 'target position'."));
        }
    });
};

ShutterBoxAccessoryWrapper.prototype.getPositionState = function (callback) {
    this.log("SHUTTERBOX ( %s ): Getting 'Position state' characteristic ...", this.deviceName);
    if (this.isResponding() && this.shutter) {
        var positionState = this.getPositionStateValue();
        this.log("SHUTTERBOX ( %s ): Current 'Position state' characteristic is %s", this.deviceName, positionState);
        callback(null, positionState); // success
    } else {
        this.log("SHUTTERBOX ( %s ): Error getting 'Position state' characteristic. Shutter: %s", this.deviceName, this.shutter);
        callback(new Error("Error getting 'Position state'."));
    }
};