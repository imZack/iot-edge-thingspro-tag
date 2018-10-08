# iot-edge-thingspro-tag

Pre-build `armhf` docker image is available on Docker Hub
- [Docker Hub](https://hub.docker.com/r/zack/iot-edge-thingspro-tag/)

## Module Configuration (Identity Twin)

- Example 
```json
{
  "properties.desired": {
    "thingsProBrokerUri": "mqtt://172.18.0.1",
    "selectedTags": {
      "SYSTEM": {
        "cpu_usage": true,
        "memory_usage": true
      },
      "ioLogik": {
        "ai1": true,
        "di2": true
      }
    },
    "publishInterval": 10000
  }
}
```

- thingsProBrokerUri, default: `172.18.0.1`
- selectedTags
  - `Equipement Name`
    - `Tag Name`, true = selected
- publishInterval, only update the latest value of tags. (unit: millseconds)

## Module Input/Output

- Inputs, There is no inputs for this module.
- Outputs
  - Name: **tags**, all the tags would be published as the following format
  ```json
  {
    "data": {
      "SYSTEM": {
        "cpu_usage": {
          "equipment": "SYSTEM",
          "tag": "cpu_usage",
          "atMs": "1538852145000",
          "value": {
            "floatValue": 34.99795519999999
          },
          "unit": ""
        },
        "memory_usage": {
          "equipment": "SYSTEM",
          "tag": "memory_usage",
          "atMs": "1538852145000",
          "value": {
            "floatValue": 68.78534804738479
          },
          "unit": ""
        }
      }
    },
    "timestamp": 1538852145895
  }
  ```
    - value may contains one of the following properties: `floatValue`, `intValue`, `uintValue`, `strValue`, `bytesValue`

## Routes

```json
{
    "routes": {
        "ConverterToIoTHub": "FROM /messages/modules/thingspro-tag/outputs/tags INTO $upstream"
    }
}
```

## Setup on Moxa unit

1. Create a file at `/etc/mosquitto/conf.d/edge.conf` with the following content and reboot the Moxa unit.
  ```
  listener 1883 172.18.0.1
  ```

  - `172.18.0.1` is the default IP address of Docker network, it may be different according to your environment.
  - With this additional configuration, ThingsPro's internal broker will expose to the Docker network.
