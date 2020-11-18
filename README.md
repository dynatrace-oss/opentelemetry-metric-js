# Dynatrace OpenTelemetry Metrics Exporter for JavaScript

> This project is developed and maintained by Dynatrace R&D.
Currently, this is a prototype and not intended for production use.
It is not covered by Dynatrace support.

This exporter plugs into the OpenTelemetry Metrics SDK for JavaScript, which is in alpha/preview state and neither considered stable nor complete as of this writing.

See [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) for the current state of the OpenTelemetry SDK for JavaScript.

## Getting started

The general setup of OpenTelemetry JS is explained in the official [Getting Started Guide](https://github.com/open-telemetry/opentelemetry-js/blob/v0.12.0/getting-started/README.md).

Using the Metrics API is explained in the [Monitor Your NodeJS Application section](https://github.com/open-telemetry/opentelemetry-js/blob/v0.12.0/getting-started/README.md#monitor-your-nodejs-application).

The Dynatrace exporter is added and set up like this:

```js
const { MeterProvider } = require('@opentelemetry/metrics');
const {
  DynatraceMetricExporter,
} = require('@dynatrace/opentelemetry-exporter-metrics');

// configure API endpoint and authentication token
const exporter = new DynatraceMetricExporter({
    // don't put this in your code, read it from an env var or config file
    url: 'https://myenv123.live.dynatrace.com/api/v2/metrics/ingest',
    APIToken: 'token123'’,
    prefix: 'MyPrefix', // optional
});

const meter = new MeterProvider({
  exporter,
  interval: 1000,
}).getMeter('opentelemetry-metrics-sample-dynatrace');

const requestCounter = meter.createCounter('requests', {
  description: 'Example of a Counter',
});

const upDownCounter = meter.createUpDownCounter('test_up_down_counter', {
  description: 'Example of a UpDownCounter',
});

const labels = { pid: process.pid, environment: 'staging' };

setInterval(() => {
  requestCounter.bind(labels).add(1);
  upDownCounter.bind(labels).add(Math.random() > 0.5 ? 1 : -1);
}, 1000);
```

A full setup is provided in our [example project](samples/).

### Configuration

The exporter allows for configuring the following settings by passing them to the constructor:

#### Dynatrace API Endpoint

The endpoint to which the metrics are sent is specified using the `url` parameter.

Given an environment ID `myenv123` on Dynatrace SaaS, the [metrics ingest endpoint](https://www.dynatrace.com/support/help/dynatrace-api/environment-api/metric-v2/post-ingest-metrics/) would be `https://myenv123.live.dynatrace.com/api/v2/metrics/ingest`.

If a OneAgent is installed on the host, it can provide a local endpoint for providing metrics directly without the need for an API token.
This feature is currently in an Early Adopter phase and has to be enabled as described in the [OneAgent metric API documentation](https://www.dynatrace.com/support/help/how-to-use-dynatrace/metrics/metric-ingestion/ingestion-methods/local-api/).
Using the local API endpoint, the host ID and host name context are automatically added to each metric as dimensions.
The default metric API endpoint exposed by the OneAgent is `http://localhost:14499/metrics/ingest`.

#### Dynatrace API Token

The Dynatrace API token to be used by the exporter is specified using the `APIToken` parameter and could, for example, be read from an environment variable.

Creating an API token for your Dynatrace environment is described in the [Dynatrace API documentation](https://www.dynatrace.com/support/help/dynatrace-api/basics/dynatrace-api-authentication/).
The scope required for sending metrics is the `Ingest metrics` scope in the **API v2** section:

![API token creation](docs/img/api_token.png)

#### Metric Key Prefix

The `prefix` parameter specifies an optional prefix, which is prepended to each metric key, separated by a dot (`<prefix>.<namespace>.<name>`).

#### Default Labels/Dimensions

The `tags` parameter can be used to optionally specify a list of key/value pairs, which will be added as additional labels/dimensions to all data points.
