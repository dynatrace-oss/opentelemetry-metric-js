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
import { MetricAttributes, ValueType } from "@opentelemetry/api-metrics";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import { AggregationTemporality, DataPointType, InstrumentType, ResourceMetrics } from "@opentelemetry/sdk-metrics-base";


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

	test("should throw when created with negative retries", () => {
		expect(() => new DynatraceMetricExporter({ maxRetries: -1 })).toThrow();
	});

	test("should throw when created with negative retry delay", () => {
		expect(() => new DynatraceMetricExporter({ retryDelay: -1 })).toThrow();
	});
});

describe("MetricExporter.export", () => {
	beforeEach(() => nock.cleanAll());

	function getResourceMetric(name: string, value: number, attributes: MetricAttributes): ResourceMetrics {
		return {
			resource: new Resource({}),
			scopeMetrics: [{
				scope: {
					name: "myscope"
				},
				metrics: [
					{
						aggregationTemporality: AggregationTemporality.DELTA,
						dataPointType: DataPointType.SINGULAR,
						descriptor: {
							description: "a data point",
							name,
							type: InstrumentType.COUNTER,
							unit: "",
							valueType: ValueType.DOUBLE
						},
						dataPoints: [{
							attributes,
							endTime: [0, 0],
							startTime: [0, 0],
							value
						}]
					}
				]
			}]
		};
	}


	test("should export metrics and return a success message", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		// if this request is not received with a body matching the regex below,
		// the call will fail without an error code, making the expect call below
		// fail.
		const scope: nock.Scope = nock(target_host)
			.post(target_path, /test,key=value count,delta=10/g)
			.once()
			.reply(200);

		exporter.export(getResourceMetric("test", 10, { key: "value" }),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// the request was sent once, no pending mocks are available
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	describe.each([100, 300, 401, 403, 500])(
		"with status code %d",
		(responseCode: number) => {
			test("should return a failure message", (done => {
				const target_host = "https://example.com:8080";
				const target_path = "/metrics";
				const target_url = target_host + target_path;
				const exporter = new DynatraceMetricExporter({
					url: target_url
				});

				// if this request is not received with a body matching the regex below,
				// the call will fail without an error code, making the expect call below
				// fail.
				const scope: nock.Scope = nock(target_host)
					.post(target_path, /test,key=value count,delta=10/g)
					.once()
					.reply(responseCode);

				exporter.export(getResourceMetric("test", 10, { key: "value" }),
					(result: ExportResult) => {
						expect(result.code).toEqual(ExportResultCode.FAILED);
						// the request was sent once, no pending mocks are available
						expect(scope.activeMocks()).toHaveLength(0);
						expect(scope.pendingMocks()).toHaveLength(0);
						done();
					});
				done();
			}));
		}
	);

	test("should retry on connection error", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url,
			maxRetries: 3
		});

		// returning an error without an error code will force the "error" event on the request.
		const scope: nock.Scope = nock(target_host)
			.post(target_path, /test,key=value count,delta=10/g)
			.replyWithError({})
			.post(target_path, /test,key=value count,delta=10/g)
			.replyWithError({})
			.post(target_path, /test,key=value count,delta=10/g)
			.replyWithError({})
			.post(target_path, /test,key=value count,delta=10/g)
			.replyWithError({});

		exporter.export(getResourceMetric("test", 10, { key: "value" }),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.FAILED);

				// the request was sent four times, no pending mocks are available
				expect(scope.activeMocks()).toStrictEqual([]);
				expect(scope.pendingMocks()).toStrictEqual([]);
				done();
			});
	});

	test("should send request after normalizing metric name", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, /_ count,delta=10/)
			.once()
			.reply(200);

		exporter.export(getResourceMetric("~!@", 10, {}),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should return success on empty metric record but not send the request", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		// if a request is sent, the test will fail.
		scope.addListener("replied", () => {
			fail("a request was sent when no request should have been sent");
		});

		exporter.export({
			resource: new Resource({}),
			scopeMetrics: [{
				scope: { name: "empty" },
				metrics: [
					{
						aggregationTemporality: AggregationTemporality.DELTA,
						dataPointType: DataPointType.SINGULAR,
						descriptor: {
							description: "empty metric",
							name: "metric_name",
							type: InstrumentType.COUNTER,
							unit: "",
							valueType: ValueType.DOUBLE
						},
						dataPoints: []
					}
				]
			}]
		},
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				done();
			});
	});

	test("should skip invalid metric and not send request", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		// if a request is sent, the test will fail.
		scope.addListener("replied", () => {
			fail("a request was sent when no request should have been sent");
		});

		exporter.export({
			resource: new Resource({}),
			scopeMetrics: [{
				scope: {
					name: "myscope"
				},
				metrics: [
					{
						aggregationTemporality: AggregationTemporality.DELTA,
						dataPointType: DataPointType.SINGULAR,
						descriptor: {
							description: "invalid data point (empty name)",
							name: "",
							type: InstrumentType.COUNTER,
							unit: "",
							valueType: ValueType.DOUBLE
						},
						dataPoints: [{
							attributes: {
								key: "value"
							},
							endTime: [0, 0],
							startTime: [0, 0],
							value: 10
						}]
					}
				]
			}]
		},
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				done();
			});
	});

	test("should skip invalid metric and send only valid metrics", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, /valid count,delta=13/)
			.once()
			.reply(200);

		exporter.export({
			resource: new Resource({}),
			scopeMetrics: [{
				scope: {
					name: "myscope"
				},
				metrics: [
					{
						aggregationTemporality: AggregationTemporality.DELTA,
						dataPointType: DataPointType.SINGULAR,
						descriptor: {
							description: "invalid data point (empty name)",
							name: "",
							type: InstrumentType.COUNTER,
							unit: "",
							valueType: ValueType.DOUBLE
						},
						dataPoints: [{
							attributes: {
								key: "value"
							},
							endTime: [0, 0],
							startTime: [0, 0],
							value: 10
						}]
					},
					{
						aggregationTemporality: AggregationTemporality.DELTA,
						dataPointType: DataPointType.SINGULAR,
						descriptor: {
							description: "valid data point",
							name: "valid",
							type: InstrumentType.COUNTER,
							unit: "",
							valueType: ValueType.DOUBLE
						},
						dataPoints: [{
							attributes: {},
							endTime: [0, 0],
							startTime: [0, 0],
							value: 13
						}]
					}
				]
			}]
		},
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// the one available active mock has been used, therefore the request was sent.
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should send two requests if there is more than 1000 metrics", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		// return the mock twice. In practice, one mock is marked as active,
		// and one mock is placed in the pending mocks
		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.twice()
			.reply(200);


		const records: ResourceMetrics = {
			resource: new Resource({}),
			scopeMetrics: [{
				scope: {
					name: "myscope"
				},
				metrics: [...Array(1001).keys()].map((v: number) => ({
					aggregationTemporality: AggregationTemporality.DELTA,
					dataPointType: DataPointType.SINGULAR,
					descriptor: {
						description: "a data point",
						name: "metric" + v.toString(),
						type: InstrumentType.COUNTER,
						unit: "",
						valueType: ValueType.DOUBLE
					},
					dataPoints: [{
						attributes: {},
						endTime: [0, 0],
						startTime: [0, 0],
						value: v
					}]
				}))
			}]
		};

		// before exporting, one mock is active and one is pending
		expect(scope.activeMocks()).toHaveLength(1);
		expect(scope.pendingMocks()).toHaveLength(1);
		exporter.export(records,
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);

				// both the active and the pending mocks have been "used up".
				// This ensures that two requests were sent.
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});
});

