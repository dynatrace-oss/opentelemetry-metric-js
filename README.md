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

It was built against OpenTelemetry SDK version `0.29.0`.

More information on exporting OpenTelemetry metrics to Dynatrace can be found in the
[Dynatrace documentation](https://www.dynatrace.com/support/help/shortlink/opentelemetry-metrics).

## Getting started

The general setup of OpenTelemetry JS is explained in the official
[Getting Started Guide](https://github.com/open-telemetry/opentelemetry-js/blob/master/getting-started/README.md).

Using the Metrics API is explained in the
[Monitor Your NodeJS Application section](https://github.com/open-telemetry/opentelemetry-js/blob/master/getting-started/README.md#monitor-your-nodejs-application).

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

### Initialize components

The Dynatrace exporter is added and set-up like this:

```js
const { configureDynatraceMetricExport } = require("@dynatrace/opentelemetry-exporter-metrics");
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require('@opentelemetry/resources');
const { MeterProvider } = require('@opentelemetry/sdk-metrics-base');

// optional: set up logging for OpenTelemetry
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL);

// configure the export to Dynatrace
const reader = configureDynatraceMetricExport(
  // exporter configuration
  {
    prefix: "my_prefix", // optional
    defaultDimensions: [   // optional
      { key: "default-dim", value: "default-dim-value" },
    ],

    // If no OneAgent is available locally, set up url and token and export directly to the Dynatrace server:
    // url: 'https://myenv123.live.dynatrace.com/api/v2/metrics/ingest',
    // apiToken: '<load API token from secure location such as env or config file>'
  },
  // metric reader configuration
  {
    exportIntervalMillis: 5000,
  }
);

const provider = new MeterProvider({
    resource: new Resource({'service.name': 'your-service-name'})
  });

provider.addMetricReader(reader);
const meter = provider.getMeter('opentelemetry-metrics-sample-dynatrace');

// Your SDK should be set up correctly now. You can create instruments...
const requestCounter = meter.createCounter('requests', {
  description: 'Example of a Counter',
});
// ... and start recording metrics:
requestCounter.add(2)
```

Metrics are exported periodically, depending on the value of exportIntervalMillis set above.

A full setup is provided in our [example project](samples/).

### Configuration

The exporter allows for configuring the following settings by passing them to
the exporter configuration in `configureDynatraceMetricExport`:

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
described in the [OneAgent metric API documentation](https://www.dynatrace.com/support/help/how-to-use-dynatrace/metrics/metric-ingestion/ingestion-methods/local-api/)
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
the [Dynatrace documentation](https://www.dynatrace.com/support/help/how-to-use-dynatrace/metrics/metric-ingestion/ingestion-methods/enrich-metrics/).
By default, this option is turned on.

## Histogram

OpenTelemetry Histograms are exported to Dynatrace as statistical summaries consisting
of a minimum and maximum value, the total sum of all values, and the count of the values
summarized. If the min and max values are not directly available on the metric data point,
estimations based on the boundaries of the first and last buckets containing values are used.
