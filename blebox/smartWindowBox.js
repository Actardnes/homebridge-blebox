var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var SMARTWINDOWBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SMARTWINDOWBOX;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, windowInfo) {
        return new SmartWindowBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, windowInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new SmartWindowBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.window);
    }
};

function SmartWindowBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, windowInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.window = windowInfo ? (windowInfo.window || windowInfo) : null;

    this.firstServiceSubtype = "Motor 1";
    this.secondServiceSubtype = "Motor 2";
    this.thirdServiceSubtype = "Motor 3";

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.currentPositionCharacteristic = api.hap.Characteristic.CurrentPosition;
    this.targetPositionCharacteristic = api.hap.Characteristic.TargetPosition;
    this.postitionStateCharacteristic = api.hap.Characteristic.PositionState;
    this.windowCoveringService = api.hap.Service.WindowCovering;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + SMARTWINDOWBOX_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);

        this.firstServiceName = this.getServiceName(0);
        this.accessory.addService(this.windowCoveringService, this.firstServiceName, this.firstServiceSubtype);

        this.secondServiceName = this.getServiceName(1);
        this.accessory.addService(this.windowCoveringService, this.secondServiceName, this.secondServiceSubtype);

        this.thirdServiceName = this.getServiceName(2);
        this.accessory.addService(this.windowCoveringService, this.thirdServiceName, this.thirdServiceSubtype);
    }

    // first service
    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
        .getCharacteristic(this.postitionStateCharacteristic)
        .on('get', this.getPositionState.bind(this, 0));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
        .getCharacteristic(this.currentPositionCharacteristic)
        .on('get', this.getCurrentPosition.bind(this, 0));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
        .getCharacteristic(this.targetPositionCharacteristic)
        .on('get', this.getTargetPosition.bind(this, 0))
        .on('set', this.setTargetPosition.bind(this, 0));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this, 0));

    // second service
    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
        .getCharacteristic(this.postitionStateCharacteristic)
        .on('get', this.getPositionState.bind(this, 1));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
        .getCharacteristic(this.currentPositionCharacteristic)
        .on('get', this.getCurrentPosition.bind(this, 1));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
        .getCharacteristic(this.targetPositionCharacteristic)
        .on('get', this.getTargetPosition.bind(this, 1))
        .on('set', this.setTargetPosition.bind(this, 1));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this, 1));

    // third service
    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
        .getCharacteristic(this.postitionStateCharacteristic)
        .on('get', this.getPositionState.bind(this, 2));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
        .getCharacteristic(this.currentPositionCharacteristic)
        .on('get', this.getCurrentPosition.bind(this, 2));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
        .getCharacteristic(this.targetPositionCharacteristic)
        .on('get', this.getTargetPosition.bind(this, 2))
        .on('set', this.setTargetPosition.bind(this, 2));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this, 2));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": SMARTWINDOWBOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "window": this.window
    };

    this.updateCharacteristics();
    this.startListening();
}

SmartWindowBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

SmartWindowBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getWindowState, this.deviceIp, {
        onSuccess: function (windowState) {
            if (windowState) {
                self.badRequestsCounter = 0;
                windowState = windowState.window || windowState;
                self.window = windowState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

SmartWindowBoxAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.window) {
        //update characteristics

        // first service
        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
            .updateCharacteristic(this.currentPositionCharacteristic, this.getCurrentPositionValue(0));

        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
            .updateCharacteristic(this.targetPositionCharacteristic, this.getTargetPositionValue(0));

        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
            .updateCharacteristic(this.postitionStateCharacteristic, this.getPositionStateValue(0));

        // second service
        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
            .updateCharacteristic(this.currentPositionCharacteristic, this.getCurrentPositionValue(1));

        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
            .updateCharacteristic(this.targetPositionCharacteristic, this.getTargetPositionValue(1));

        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
            .updateCharacteristic(this.postitionStateCharacteristic, this.getPositionStateValue(1));

        // third service
        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
            .updateCharacteristic(this.currentPositionCharacteristic, this.getCurrentPositionValue(2));

        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
            .updateCharacteristic(this.targetPositionCharacteristic, this.getTargetPositionValue(2));

        this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
            .updateCharacteristic(this.postitionStateCharacteristic, this.getPositionStateValue(2));
    }
};

SmartWindowBoxAccessoryWrapper.prototype.getServiceName = function (motorNumber) {
    var name_postfix = "";
    if (this.window && this.window.motors && this.window.motors.length > motorNumber && this.window.motors[motorNumber].name) {
        name_postfix = this.window.motors[motorNumber].name;
    } else {
        switch (motorNumber) {
            case 0:
                name_postfix = this.firstServiceSubtype;
                break;
            case 1:
                name_postfix = this.secondServiceSubtype;
                break;
            case 2:
            default:
                name_postfix = this.thirdServiceSubtype;
                break;
        }
    }

    return this.deviceName + " " + name_postfix;
};

SmartWindowBoxAccessoryWrapper.prototype.getCurrentPositionValue = function (motorNumber) {
    var currentPosition = 0;
    if (this.window && this.window.motors && this.window.motors[motorNumber] && this.window.motors[motorNumber].currentPos) {
        currentPosition = Number(this.window.motors[motorNumber].currentPos.position) || 0;
        currentPosition = 100 - Math.min(Math.max(currentPosition, 0), 100);
    }
    return currentPosition;
};

SmartWindowBoxAccessoryWrapper.prototype.getTargetPositionValue = function (motorNumber) {
    var targetPosition = 0;
    if (this.window && this.window.motors && this.window.motors[motorNumber] && this.window.motors[motorNumber].desiredPos) {
        targetPosition = Number(this.window.motors[motorNumber].desiredPos.position) || 0;
        targetPosition = 100 - Math.min(Math.max(targetPosition, 0), 100);
    }
    return targetPosition;
};

SmartWindowBoxAccessoryWrapper.prototype.getPositionStateValue = function (motorNumber) {
    var positionState = this.postitionStateCharacteristic.STOPPED;
    if (this.window && this.window.motors && this.window.motors[motorNumber]) {
        switch (this.window.motors[motorNumber].state) {
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

SmartWindowBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.firstServiceSubtype)
        .updateCharacteristic(this.nameCharacteristic, this.getServiceName(0));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.secondServiceSubtype)
        .updateCharacteristic(this.nameCharacteristic, this.getServiceName(1));

    this.accessory.getServiceByUUIDAndSubType(this.windowCoveringService, this.thirdServiceSubtype)
        .updateCharacteristic(this.nameCharacteristic, this.getServiceName(2));
};

SmartWindowBoxAccessoryWrapper.prototype.getCurrentPosition = function (motorNumber, callback) {
    this.log("SMARTWINDOWBOX ( %s ): Getting 'Current position' characteristic for motor %s ...", this.deviceName, motorNumber);
    if (this.isResponding() && this.window) {
        var currentPosition = this.getCurrentPositionValue(motorNumber);
        this.log("SMARTWINDOWBOX ( %s ): Current 'Current position' characteristic for motor %s is %s", this.deviceName, motorNumber, currentPosition);

        callback(null, currentPosition);
    } else {
        this.log("SMARTWINDOWBOX ( %s ): Error getting 'Current position' characteristic for motor %s. Window: %s", this.deviceName, motorNumber, this.window);
        callback(new Error("Error getting 'Current position'."));
    }
};

SmartWindowBoxAccessoryWrapper.prototype.getTargetPosition = function (motorNumber, callback) {
    this.log("SMARTWINDOWBOX ( %s ): Getting 'Target position' characteristic for motor %s ...", this.deviceName, motorNumber);
    if (this.isResponding() && this.window) {
        var currentPosition = this.getTargetPositionValue(motorNumber);
        this.log("SMARTWINDOWBOX ( %s ): Current 'Target position' characteristic for motor %s is %s", this.deviceName, motorNumber, currentPosition);

        callback(null, currentPosition);
    } else {
        this.log("SMARTWINDOWBOX ( %s ): Error getting 'Target position' characteristic for motor %s. Window: %s", this.deviceName, motorNumber, this.window);
        callback(new Error("Error getting 'Target position'."));
    }
};

SmartWindowBoxAccessoryWrapper.prototype.setTargetPosition = function (motorNumber, position, callback) {
    this.log("SMARTWINDOWBOX ( %s ): Setting 'target position' characteristic for motor %s to %s ...", this.deviceName, motorNumber, position);
    position = 100 - position;
    var self = this;
    communication.send(bleboxCommands.setWindowPositionPercentage, this.deviceIp, {
        params: [motorNumber, position],
        onSuccess: function (windowState) {
            if (windowState) {
                self.window = windowState.window || windowState;
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

SmartWindowBoxAccessoryWrapper.prototype.getPositionState = function (motorNumber, callback) {
    this.log("SMARTWINDOWBOX ( %s ): Getting 'Position state' characteristic for motor %s ...", this.deviceName, motorNumber);
    if (this.isResponding() && this.window) {
        var positionState = this.getPositionStateValue();
        this.log("SMARTWINDOWBOX ( %s ): Current 'Position state' characteristic for motor %s is %s", this.deviceName, motorNumber, positionState);
        callback(null, positionState); // success
    } else {
        this.log("SMARTWINDOWBOX ( %s ): Error getting 'Position state' characteristic for motor. Window: %s", this.deviceName, motorNumber, this.window);
        callback(new Error("Error getting 'Position state'."));
    }
};


SmartWindowBoxAccessoryWrapper.prototype.getName = function (motorNumber, callback) {
    this.log("SMARTWINDOWBOX ( %s ): Getting 'name' characteristic ...", this.deviceName);
    if (this.isResponding() && this.deviceName) {
        var currentName = this.getServiceName(motorNumber);
        this.log("SMARTWINDOWBOX ( %s ): Current 'name' characteristic is %s", this.deviceName, currentName);
        callback(null, currentName);
    } else {
        this.log("SMARTWINDOWBOX ( %s ): Error getting 'name' characteristic. Name: %s", this.deviceName, this.deviceName);
        callback(new Error("Error getting 'name'."));
    }
};
