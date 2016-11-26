// Blebox plugin for HomeBridge
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//            "platform": "BleBoxPlatform",
//            "name": "BleBoxPlatform"
//     }
// ],
//

var BleBoxPlatform = require("./bleboxPlatform");

module.exports = function (homebridge) {
    //dynamic platform
    homebridge.registerPlatform("homebridge-blebox", "BleBoxPlatform", BleBoxPlatform.bind(this, homebridge), true);
};