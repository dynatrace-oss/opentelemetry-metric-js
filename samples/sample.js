'use strict';

const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { Resource } = require('@opentelemetry/resources');
const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics-base');
const { DynatraceMetricExporter } = require('..');

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)

let exporter = new DynatraceMetricExporter({
  prefix: 'sample' // optional

  // If no OneAgent is available locally, export directly to the Dynatrace server:
  // url: 'https://myenv123.live.dynatrace.com/api/v2/metrics/ingest',
  // apiToken: '<load API token from secure location such as env or config file>'
});


// You can use the ConsoleExporter for testing locally
// exporter = new ConsoleMetricExporter(AggregationTemporality.DELTA);

const provider = new MeterProvider({ resource: new Resource({ 'service.name': 'opentelemetry-metrics-sample-dynatrace' }) });
const reader = new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000 });
provider.addMetricReader(reader);
const meter = provider.getMeter('opentelemetry-metrics-sample-dynatrace');

const requestCounter = meter.createCounter('requests', {
  description: 'Example of a Counter'
});

const upDownCounter = meter.createUpDownCounter('test_up_down_counter', {
  description: 'Example of a UpDownCounter'
});
const attributes = { pid: process.pid, environment: 'staging' };

setInterval(() => {
  requestCounter.add(Math.round(Math.random() * 1000), attributes);
  upDownCounter.add(Math.random() > 0.5 ? 1 : -1, attributes);
}, 1000);
