const _ = require("lodash");

const airSensor = require("./airSensor");
const dimmerBox = require("./dimmerBox");
const gateBox = require("./gateBox");
const saunaBox = require("./saunaBox");
const shutterBox = require("./shutterBox");
const smartWindowBox = require("./smartWindowBox");
const switchBox = require("./switchBox");
const switchBoxD = require("./switchBoxD");
const tempSensor = require("./tempSensor");
const wLightBox = require("./wLightBox");
const wLightBox_singleChannel = require("./wLightBox_singleChannel");
const wLightBoxS = require("./wLightBoxS");


const wrappers = [
    airSensor,
    dimmerBox,
    gateBox,
    saunaBox,
    shutterBox,
    smartWindowBox,
    switchBox,
    switchBoxD,
    tempSensor,
    wLightBox,
    wLightBox_singleChannel,
    wLightBoxS
];


const wrappersByType = _.reduce(wrappers, (acc, wrapper) => {
    acc[wrapper.type] = wrapper;
    return acc;
}, {})

const getWrapper = (type, state) => {
    if (type === wLightBox.type) {
        state = state || {};
        const {rgbw: {currentColor = ''} = state} = state;
        const channelsCount = currentColor.length / 2;
        if (channelsCount === 1) {
            return wLightBox_singleChannel;
        }
        return wLightBox;
    } else {
        return wrappersByType[type];
    }
}

module.exports = getWrapper;