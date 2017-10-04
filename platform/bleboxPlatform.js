var os = require('os');
var communication = require("./../common/communication");
var bleboxCommands = require("./../common/bleboxCommands");
var BLEBOX_TYPE = require("./../common/bleboxConst").BLEBOX_TYPE;
var GateBoxAccessoryWrapper = require("./../blebox/gateBox");
var DimmerBoxAccessoryWrapper = require("./../blebox/dimmerBox");
var ShutterBoxAccessoryWrapper = require("./../blebox/shutterBox");
var SwitchBoxAccessoryWrapper = require("./../blebox/switchBox");
var SwitchBoxDAccessoryWrapper = require("./../blebox/switchBoxD");
var WLightBoxAccessoryWrapper = require("./../blebox/wLightBox");
var WLightBoxSAccessoryWrapper = require("./../blebox/wLightBoxS");

module.exports = BleBoxPlatform;

function BleBoxPlatform(homebridge, log, config, api) {
    this.log = log;
    this.config = config;
    this.startNextScanDelayInMin = Number(this.config["NEXT_SCAN_DELAY_IN_MIN"]) || 0;
    this.ipList = [];
    this.scanNextIpDelayInMs = 100;
    this.accessoriesWrapperList = [];
    this.accessoriesWrapperObj = {};
    this.homebridge = homebridge;
    this.api = api;

    this.prepareIpListToScan();

    this.api.on('didFinishLaunching', function () {
        this.startSearching();
    }.bind(this));
}

BleBoxPlatform.prototype.prepareIpListToScan = function () {
    var interfaces = os.networkInterfaces();
    for (var i in interfaces) {
        for (var j in interfaces[i]) {
            var interface = interfaces[i][j];
            if (interface.family === 'IPv4' && !interface.internal) {
                this.addIpsFromInterface(interface);
                break;
            }
        }
    }
};

BleBoxPlatform.prototype.addIpsFromInterface = function (interface) {
    var maskArray = interface.netmask.split('.', 4);
    var maskBitsCount = 0;
    for (var i in maskArray) {
        var maskNode = Number(maskArray[i]);
        maskBitsCount += (((maskNode >>> 0).toString(2)).match(/1/g) || []).length;
    }
    if (maskBitsCount > 16 && maskBitsCount < 32) {
        var ipNumber = ipStringToNumber(interface.address);
        if (ipNumber) {
            var firstPossibleIpNumber = ipNumber & ((-1 << (32 - maskBitsCount))); //network address
            var lastPossibleIpNumber = firstPossibleIpNumber + Math.pow(2, (32 - maskBitsCount)) - 1; // broadcast address

            var possibleIpAddressesCount = lastPossibleIpNumber - firstPossibleIpNumber;
            // add all addresses except network and broadcast
            for (var j = 1; j < possibleIpAddressesCount; j++) {
                var currentIpNumber = firstPossibleIpNumber + j;
                var currentIpString = ipNumberToString(currentIpNumber);
                if (this.ipList.indexOf(currentIpString) == -1) {
                    this.ipList.push(currentIpString);
                }
            }
        }
    }

    function ipNumberToString(ipNumber) {
        var byte1 = ( ipNumber >>> 24 );
        var byte2 = ( ipNumber >>> 16 ) & 255;
        var byte3 = ( ipNumber >>> 8 ) & 255;
        var byte4 = ipNumber & 255;
        return ( byte1 + '.' + byte2 + '.' + byte3 + '.' + byte4 );
    }

    function ipStringToNumber(ipString) {
        var split = ipString.split('.', 4);
        if (split.length == 4) {
            var myInt = (
                parseFloat(split[0] * 16777216)    /* 2^24 */
                + parseFloat(split[1] * 65536)        /* 2^16 */
                + parseFloat(split[2] * 256)        /* 2^8  */
                + parseFloat(split[3])
            );
            return myInt;
        }
        return null;
    }
};

BleBoxPlatform.prototype.configureAccessory = function (accessory) {
    var accessoryWrapper;
    switch (accessory.context.blebox.type) {
        case BLEBOX_TYPE.WLIGHTBOXS:
            accessoryWrapper = WLightBoxSAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        case BLEBOX_TYPE.WLIGHTBOX:
            accessoryWrapper = WLightBoxAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        case BLEBOX_TYPE.DIMMERBOX:
            accessoryWrapper = DimmerBoxAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        case BLEBOX_TYPE.SHUTTERBOX:
            accessoryWrapper = ShutterBoxAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        case BLEBOX_TYPE.GATEBOX:
            accessoryWrapper = GateBoxAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        case BLEBOX_TYPE.SWITCHBOXD:
            accessoryWrapper = SwitchBoxDAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        case BLEBOX_TYPE.SWITCHBOX:
            accessoryWrapper = SwitchBoxAccessoryWrapper.restore(accessory, this.log, this.api, accessory.context.blebox);
            break;
        default :
            console.log("Wrong accessory!", accessory);
            this.api.unregisterPlatformAccessories("homebridge-blebox", "BleBoxPlatform", [accessory]);
            return;
    }

    this.addAccessoryWrapper(accessoryWrapper, false);
};

BleBoxPlatform.prototype.startSearching = function () {
    this.log("Searching blebox devices started!");
    this.sendSearchRequest(0);
};

BleBoxPlatform.prototype.sendSearchRequest = function (index) {
    (function (index) {
        var ipAddress = this.ipList[index];
        if (ipAddress) {
            var self = this;
            console.log("Checking ip: %s", ipAddress);
            communication.send(bleboxCommands.getDeviceState, ipAddress, {
                onSuccess: function (deviceInfo) {
                    if (deviceInfo) {
                        deviceInfo = deviceInfo.device || deviceInfo;
                        deviceInfo.ip = ipAddress;
                        var accessoryWrapperObj = self.accessoriesWrapperObj[deviceInfo.id];
                        if (!accessoryWrapperObj) {
                            self.checkSpecificStateAndAddAccessory(deviceInfo)
                        } else {
                            accessoryWrapperObj.setDeviceIp(deviceInfo);
                        }
                    }
                    self.checkIfSearchIsFinishedAndScheduleNext(index);
                }, onError: function () {
                    self.checkIfSearchIsFinishedAndScheduleNext(index);
                }
            });
        }
    }).call(this, index);

    index++;
    if (index < this.ipList.length) {
        setTimeout(this.sendSearchRequest.bind(this, index), this.scanNextIpDelayInMs);
    }
};

BleBoxPlatform.prototype.checkIfSearchIsFinishedAndScheduleNext = function (index) {
    if (index >= this.ipList.length - 1) {
        this.log("Searching blebox devices finished!");
        if (this.startNextScanDelayInMin) { //if defined and different than 0
            var startNextScanDelayInMs = this.startNextScanDelayInMin * 60 * 1000;
            setTimeout(this.startSearching.bind(this), startNextScanDelayInMs);
        }
    }
};

BleBoxPlatform.prototype.checkSpecificStateAndAddAccessory = function (deviceInfo) {
    var accessoryWrapper = null;
    var ipAddress = deviceInfo.ip;
    var self = this;
    switch (typeof deviceInfo.type === 'string' && deviceInfo.type.toLowerCase()) {
        case BLEBOX_TYPE.WLIGHTBOXS:
            communication.send(bleboxCommands.getLightState, ipAddress, {
                onSuccess: function (lightInfo) {
                    if (lightInfo) {
                        accessoryWrapper = WLightBoxSAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, lightInfo);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        case BLEBOX_TYPE.WLIGHTBOX:
            communication.send(bleboxCommands.getRgbwState, ipAddress, {
                onSuccess: function (rgbState) {
                    if (rgbState) {
                        accessoryWrapper = WLightBoxAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, rgbState);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        case BLEBOX_TYPE.DIMMERBOX:
            communication.send(bleboxCommands.getDimmerState, ipAddress, {
                onSuccess: function (dimmerInfo) {
                    if (dimmerInfo) {
                        accessoryWrapper = DimmerBoxAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, dimmerInfo);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        case BLEBOX_TYPE.SHUTTERBOX:
            communication.send(bleboxCommands.getShutterState, ipAddress, {
                onSuccess: function (shutterInfo) {
                    if (shutterInfo) {
                        accessoryWrapper = ShutterBoxAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, shutterInfo);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        case BLEBOX_TYPE.GATEBOX:
            communication.send(bleboxCommands.getGateState, ipAddress, {
                onSuccess: function (gateInfo) {
                    if (gateInfo) {
                        accessoryWrapper = GateBoxAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, gateInfo);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        case BLEBOX_TYPE.SWITCHBOXD:
            communication.send(bleboxCommands.getRelayState, ipAddress, {
                onSuccess: function (relayInfo) {
                    if (relayInfo) {
                        accessoryWrapper = SwitchBoxDAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, relayInfo);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        case BLEBOX_TYPE.SWITCHBOX:
            communication.send(bleboxCommands.getRelayState, ipAddress, {
                onSuccess: function (relayInfo) {
                    if (relayInfo) {
                        accessoryWrapper = SwitchBoxAccessoryWrapper.create(self.homebridge, self.log, self.api, deviceInfo, relayInfo);
                        self.addAccessoryWrapper(accessoryWrapper, true);
                    }
                }
            });
            break;
        default:
            this.log("Unknown device type: %s", deviceInfo.type);
            break;
    }

};

BleBoxPlatform.prototype.addAccessoryWrapper = function (accessoryWrapper, register) {
    if (accessoryWrapper && this.accessoriesWrapperList.length < 98) { // we cannot have more than 98 devices
        this.accessoriesWrapperList.push(accessoryWrapper);
        this.accessoriesWrapperObj[accessoryWrapper.deviceId] = accessoryWrapper;
        if (register) {
            this.api.registerPlatformAccessories("homebridge-blebox", "BleBoxPlatform", [accessoryWrapper.getAccessory()]);
        }
        this.log("Added accessory! Now we have: %s", this.accessoriesWrapperList.length);
    }
};

BleBoxPlatform.prototype.accessories = function (callback) {
    var accessoriesList = [];
    for (var i = 0; i < this.accessoriesWrapperList.length; i++) {
        accessoriesList.push(this.accessoriesWrapperList[i].getAccessory());
    }
    callback(accessoriesList);
};
