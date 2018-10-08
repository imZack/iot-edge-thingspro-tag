/* eslint no-console: ["error", { allow: ["error"] }] */
const Protocol = require('azure-iot-device-mqtt').Mqtt;
const Client = require('azure-iot-device').ModuleClient;
const { Message } = require('azure-iot-device');
const mqtt = require('mqtt');
const protobuf = require('protobufjs');
const debug = require('debug')('iot-edge-thingspro-tag:app');

const tagDB = {};
const defaultTwinConfig = {
  thingsProBrokerUri: 'mqtt://192.168.4.127',
  publishInterval: 5000,
  reportByException: false,
};

console.error = (message) => {
  throw new Error(message);
};

const isSelected = (topic, topicDict) => topicDict[topic];

const convertToTopicDict = (selectedTags) => {
  const topicDict = {};
  Object.keys(selectedTags).forEach((equipment) => {
    Object.keys(selectedTags[equipment]).forEach((tag) => {
      if (!selectedTags[equipment][tag]) return;
      topicDict[`/equs/${equipment}/tags/${tag}`] = true;
    });
  });

  return topicDict;
};

const publisher = (iotClient) => {
  const msg = new Message(JSON.stringify({
    data: tagDB,
    timestamp: Date.now(),
  }));

  iotClient.sendOutputEvent('tags', msg, () => {
    debug('published', JSON.stringify(msg));
  });
};

const thingsProBridge = (twinConfig, selectedTopics) => {
  const mqttClient = mqtt.connect(
    twinConfig.thingsProBrokerUri || defaultTwinConfig.thingsProBrokerUri,
  );

  let TagMessage;
  protobuf.load(`${__dirname}/thingspro-tag.proto`, (err, root) => {
    if (err) {
      console.error('thingspro-tag.proto error', err);
      return;
    }

    TagMessage = root.lookupType('mxtag.pb.Tag');
    debug('protobuf thingspro-tag.proto loaded');
  });

  mqttClient.on('connect', () => {
    debug('mqtt connected');
    mqttClient.on('message', (topic, message) => {
      if (!isSelected(topic, selectedTopics)) {
        return;
      }
      if (!TagMessage) {
        debug('TagMessage not ready');
        return;
      }
      const decodedMsg = TagMessage.decode(message);
      const inputObject = TagMessage.toObject(decodedMsg, {
        longs: String,
        enums: String,
        bytes: String,
      });

      if (!tagDB[inputObject.equipment]) tagDB[inputObject.equipment] = {};
      tagDB[inputObject.equipment][inputObject.tag] = inputObject;
    });

    mqttClient.subscribe('/equs/+/tags/+', (err) => {
      if (err) {
        console.error('subscribe error', err);
      } else {
        debug('mqtt subscribed');
      }
    });
  });

  return mqttClient;
};

Client.fromEnvironment(Protocol, (err, client) => {
  if (err) {
    console.error(err);
    return;
  }

  let mqttClient;
  let publishTimer;
  let twinConfig;

  client.on('error', (onErr) => {
    console.error(onErr.message);
  });

  client.open((openErr) => {
    if (openErr) {
      console.error(err);
      return;
    }

    debug('Client connected');
    client.getTwin((errTwin, twin) => {
      if (errTwin) {
        debug(errTwin);
        console.error(err);
        return;
      }

      if (!twin) {
        debug(twin);
        console.error(err);
        return;
      }

      twin.on('properties.desired', (data) => {
        twinConfig = data;
        debug('twinConfig updated', twinConfig);
        const selectedTopics = convertToTopicDict(twinConfig.selectedTags);
        debug('selectedTopics', selectedTopics);

        if (publishTimer) clearInterval(publishTimer);
        publishTimer = setInterval(
          publisher,
          twinConfig.publishInterval || defaultTwinConfig.publishInterval,
          client,
        );

        if (mqttClient) {
          debug('closing previous mqtt connection');
          mqttClient.end(() => {
            debug('mqtt client closed');
            mqttClient = thingsProBridge(twinConfig, selectedTopics);
          });
          return;
        }

        mqttClient = thingsProBridge(twinConfig, selectedTopics);
      });
    });
  });
});
