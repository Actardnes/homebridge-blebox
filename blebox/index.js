const dimmerBox = require("./dimmerBox");
const gateBox = require("./gateBox");
const saunaBox = require("./saunaBox");
const shutterBox = require("./shutterBox");
const smartWindowBox = require("./smartWindowBox");
const switchBox = require("./switchBox");
const switchBoxD = require("./switchBoxD");
const wLightBox = require("./wLightBox");
const wLightBoxS = require("./wLightBoxS");
const tempSensor = require("./tempSensor");

const wrappers = {};
wrappers[dimmerBox.type] = dimmerBox;
wrappers[gateBox.type] = gateBox;
wrappers[saunaBox.type] = saunaBox;
wrappers[shutterBox.type] = shutterBox;
wrappers[smartWindowBox.type] = smartWindowBox;
wrappers[switchBox.type] = switchBox;
wrappers[switchBoxD.type] = switchBoxD;
wrappers[wLightBox.type] = wLightBox;
wrappers[wLightBoxS.type] = wLightBoxS;
wrappers[tempSensor.type] = tempSensor;

module.exports = wrappers;