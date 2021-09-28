/*
	Copyright 2020 Dynatrace LLC

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

import { DynatraceMetricExporter } from "../src";
import * as nock from "nock";
import { MetricKind, MetricRecord, SumAggregator } from "@opentelemetry/metrics";
import { AggregationTemporality, ValueType } from "@opentelemetry/api-metrics";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";



describe("MetricExporter", () => {
	test("should default to oneagent endpoint", () => {
		const exporter = new DynatraceMetricExporter();
		expect(exporter["_reqOpts"].hostname).toEqual("localhost");
		expect(exporter["_reqOpts"].port).toEqual("14499");
		expect(exporter["_reqOpts"].path).toEqual("/metrics/ingest");
	});

	test("should have a configurable url", () => {
		let exporter = new DynatraceMetricExporter({
			url: "https://example.com:8443/metrics"
		});
		expect(exporter["_reqOpts"].hostname).toEqual("example.com");
		expect(exporter["_reqOpts"].port).toEqual("8443");
		expect(exporter["_reqOpts"].path).toEqual("/metrics");
		expect(exporter["_reqOpts"].protocol).toEqual("https:");

		exporter = new DynatraceMetricExporter({
			url: "http://example.com:8080/metrics"
		});
		expect(exporter["_reqOpts"].hostname).toEqual("example.com");
		expect(exporter["_reqOpts"].port).toEqual("8080");
		expect(exporter["_reqOpts"].path).toEqual("/metrics");
		expect(exporter["_reqOpts"].protocol).toEqual("http:");
	});
});

describe("MetricExporter.export", () => {
	test("should export metrics and return a success message", () => {
		const target_host =  "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		// if this request is not received with a body matching the regex below,
		// a non-success error code will be returned, making the expect call below
		// fail.
		nock(target_host)
			.post(target_path, /test,key=value count,delta=10 \d{13}/g)
			.reply(200);

		const aggregator = new SumAggregator();
		aggregator.update(10);

		// let metric: UpDownCounterMetric = new UpDownCounterMetric("test", );
		const rec: MetricRecord = {
			descriptor: {
				name: "test",
				description: "some desc",
				unit: "unit",
				metricKind: MetricKind.UP_DOWN_COUNTER,
				valueType: ValueType.DOUBLE
			},
			labels: { "key": "value" },
			aggregator: aggregator,
			aggregationTemporality: AggregationTemporality.AGGREGATION_TEMPORALITY_DELTA,
			resource: Resource.EMPTY,
			instrumentationLibrary: {
				name: "my-mock-lib"
			}
		};

		exporter.export([rec],
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
			});
	});

	test("should return error result when called with invalid metric name", () => {
		const target_host =  "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		nock(target_host)
			.post(target_path, /~!@ count,delta=10 \d{13}/g)
			.reply(400);

		const aggregator = new SumAggregator();
		aggregator.update(10);

		// let metric: UpDownCounterMetric = new UpDownCounterMetric("test", );
		const rec: MetricRecord = {
			descriptor: {
				name: "~!@",
				description: "some desc",
				unit: "unit",
				metricKind: MetricKind.UP_DOWN_COUNTER,
				valueType: ValueType.DOUBLE
			},
			labels: {},
			aggregator: aggregator,
			aggregationTemporality: AggregationTemporality.AGGREGATION_TEMPORALITY_DELTA,
			resource: Resource.EMPTY,
			instrumentationLibrary: {
				name: "my-mock-lib"
			}
		};

		exporter.export([rec],
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.FAILED);
			});
	});
});
