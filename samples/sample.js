'use strict';

const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const { MeterProvider } = require('@opentelemetry/metrics');
const { DynatraceMetricExporter } = require('..');

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)

const exporter = new DynatraceMetricExporter({
  prefix: 'sample',

  // If no OneAgent is available locally, export directly to the Dynatrace server:
  // url: 'https://myenv123.live.dynatrace.com/api/v2/metrics/ingest',
  // APIToken: '<load API token from secure location such as env or config file>'
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
