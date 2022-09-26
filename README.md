# Dynatrace OpenTelemetry Metrics Exporter for JavaScript

> This exporter is based on the OpenTelemetry Metrics SDK for JavaScript,
> which is currently in an RC state and neither considered stable nor
> complete as of this writing.
> As such, this exporter is not intended for production use until the
> underlying OpenTelemetry Metrics API and SDK are stable.
> See [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)
> for the current state of the OpenTelemetry SDK for JavaScript.

This exporter allows exporting metrics created using the [OpenTelemetry SDK for JavaScript](https://github.com/open-telemetry/opentelemetry-js)
directly to [Dynatrace](https://www.dynatrace.com).

It was built against OpenTelemetry SDK version `0.33.0`.

More information on exporting OpenTelemetry metrics to Dynatrace can be found in
the [Dynatrace documentation](https://www.dynatrace.com/support/help/shortlink/opentelemetry-metrics).

## Getting started

The general setup of OpenTelemetry JS is explained in the official
[Getting Started Guide](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/).

Using the Metrics API is explained in the
[Monitor Your NodeJS Application section](https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/#metrics).

### Install Dependencies

The Dynatrace OpenTelemetry exporter requires the following prerequisites:

- [Node.js 14+](https://nodejs.org/en/)
- NPM (8+ recommended, included with Node.js)

```sh
# Optional - update NPM
npm install --global npm

# Install the Dynatrace OpenTelemetry Metrics Exporter using NPM
npm install @dynatrace/opentelemetry-exporter-metrics
```

If you are using a `npm` version < 7, please install the `@opentelemetry/api`
peer dependency manually.

```sh
# Install peer dependency @opentelemetry/api
npm install @opentelemetry/api
```

### Initialize components

The Dynatrace exporter is added and set-up like this:

```js
'use strict';

const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require('@opentelemetry/resources');
const { MeterProvider } = require('@opentelemetry/sdk-metrics');
const { configureDynatraceMetricExport } = require('@dynatrace/opentelemetry-exporter-metrics');


diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)

// Configure a MeterProvider
const provider = new MeterProvider({
  resource: new Resource({
    'service.name': 'opentelemetry-metrics-sample-dynatrace'
  })
});

const reader = configureDynatraceMetricExport(
  // exporter configuration
  {
    prefix: 'sample' // optional

    // If no OneAgent is available locally, export directly to the Dynatrace server:
    // url: 'https://myenv123.live.dynatrace.com/api/v2/metrics/ingest',
    // apiToken: '<load API token from secure location such as env or config file>'
  },
  // metric reader configuration
  {
    exportIntervalMillis: 5000
  }
);

provider.addMetricReader(reader);

const meter = provider.getMeter('opentelemetry-metrics-sample-dynatrace');

// Your SDK should be set up correctly now. You can create instruments...
const requestCounter = meter.createCounter('requests', {
  description: 'Example of a Counter'
});

const upDownCounter = meter.createUpDownCounter('test_up_down_counter', {
  description: 'Example of a UpDownCounter'
});

// ...set up attributes...
const attributes = {
  pid: process.pid.toString(),
  environment: 'staging'
};

// ... and start recording metrics:
setInterval(() => {
  requestCounter.add(Math.round(Math.random() * 1000), attributes);
  upDownCounter.add(Math.random() > 0.5 ? 1 : -1, attributes);
}, 1000);
```

Metrics are exported periodically, depending on the value of
exportIntervalMillis set above.

A full setup is provided in our [example project](samples/sample.js).

### Configuration

The exporter allows for configuring the following settings by setting them in
the `ExporterConfig` in `configureDynatraceMetricExport`:

<!-- disable long lines and inline HTML elements checking for the table -->
<!-- markdownlint-disable MD013 MD033 -->
| Name                          | Type               | Description                                                          |
|-------------------------------|--------------------|----------------------------------------------------------------------|
| `prefix`                      | `string`           | See [Metric key prefix](#metric-key-prefix).                         |
| `defaultDimensions`           | `Array<Dimension>` | See [Default attributes](#default-attributesdimensions)              |
| `url`                         | `string`           | See [Endpoint](#dynatrace-api-endpoint).                             |
| `apiToken`                    | `string`           | See [API token](#dynatrace-api-token).                               |
| `dynatraceMetadataEnrichment` | `boolean`          | See [Dynatrace Metadata enrichment](#dynatrace-metadata-enrichment). |
| `maxRetries`                  | `number`           | See [Retries on Connection Failure](#retries-on-connection-failure). |
| `retryDelay`                  | `number`           | See [Retries on Connection Failure](#retries-on-connection-failure). |
<!-- markdownlint-enable MD013 MD033 -->

In addition, there are some settings that will be passed to the `MetricReader`.
These can be set in the `ReaderConfig`

<!-- markdownlint-disable MD013 -->
| Name                   | Type     | Description                                          | Default            |
|------------------------|----------|------------------------------------------------------|--------------------|
| `exportIntervalMillis` | `number` | The interval in which metrics are exported.          | 60000 (60 seconds) |
| `exportTimeoutMillis`  | `number` | The maximum timeout to wait for an export to finish. | 30000 (30 seconds) |
<!-- markdownlint-enable MD013 -->

#### Dynatrace API Endpoint

API Endpoint and Token are optional. By default, metrics will be exported to
the local OneAgent endpoint described below, if it is available.

The endpoint to which the metrics are sent is specified using the `url`
parameter.

Given an environment ID `myenv123` on Dynatrace SaaS, the
[metrics ingest endpoint](https://www.dynatrace.com/support/help/dynatrace-api/environment-api/metric-v2/post-ingest-metrics/)
would be `https://myenv123.live.dynatrace.com/api/v2/metrics/ingest`.

If a OneAgent is installed on the host, it can provide a local endpoint for
providing metrics directly without the need for an API token.
Depending on your environment, this feature might have to be enabled as
described in the
[OneAgent metric API documentation](https://www.dynatrace.com/support/help/how-to-use-dynatrace/metrics/metric-ingestion/ingestion-methods/local-api/)
first.
Using the local API endpoint, the host ID and host name context are
automatically added to each metric as dimensions.
The default metric API endpoint exposed by the OneAgent is
`http://localhost:14499/metrics/ingest`.
If no Dynatrace API endpoint is set, the exporter will default to the local
OneAgent endpoint.

#### Dynatrace API Token

Required only if an API endpoint is also provided.

The Dynatrace API token to be used by the exporter is specified using the
`apiToken` parameter and could, for example, be read from an environment
variable.

Creating an API token for your Dynatrace environment is described in the
[Dynatrace API documentation](https://www.dynatrace.com/support/help/dynatrace-api/basics/dynatrace-api-authentication/).
The permission required for sending metrics is `Ingest metrics`
(`metrics.ingest`) and it is recommended to limit scope to only
this permission.

#### Metric Key Prefix

The `prefix` parameter specifies an optional prefix, which is prepended to each
metric key, separated by a dot (`<prefix>.<namespace>.<name>`).

#### Default Attributes/Dimensions

The `defaultDimensions` parameter can be used to optionally specify a list of key/value
pairs, which will be added as additional attributes/dimensions to all data points.

#### Retries on Connection Failure

The `maxRetries` parameter can be used to set the amount of times the exporter should
retry on connection failures. By default, the exporter will retry 3 times before
marking the batch as failed. This number must be greater than or equal to 0.

The `retryDelay` parameter can be used to set the time in milliseconds to wait until
re-trying an export after a connection failure, the default is 1000ms. This number
must be greater than or equal to 0.

## Dynatrace Metadata Enrichment

If running on a host with a running OneAgent, the exporter will export metadata
collected by the OneAgent to the Dynatrace endpoint.
This typically consists of the Dynatrace host ID and process group ID.
More information on the underlying feature used by the exporter can be found in
the
[Dynatrace documentation](https://www.dynatrace.com/support/help/how-to-use-dynatrace/metrics/metric-ingestion/ingestion-methods/enrich-metrics/).
By default, this option is turned on.

## Limitations

### Histogram

OpenTelemetry Histograms are exported to Dynatrace as statistical summaries
consisting of a minimum and maximum value, the total sum of all values, and the
count of the values summarized. If the min and max values are not directly
available on the metric data point, estimations based on the boundaries of the
first and last buckets containing values are used.

### Attribute type limitations

Currently, only `string` type attribute values are supported.
Attributes with values of any other type will be dropped and not exported.
If you need those values to be exported, please convert them to `string`
type before export.
