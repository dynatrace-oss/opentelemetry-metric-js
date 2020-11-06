'use strict';

const { MeterProvider } = require('@opentelemetry/metrics');
const { DynatraceMetricExporter } = require('..');
const config = require("./config.json");

const exporter = new DynatraceMetricExporter({
  prefix: 'sample',
  url: config.url,
  APIToken: config.APIToken,
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
