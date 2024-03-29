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

import { DynatraceMetricExporter } from "../src/DynatraceMetricExporter";
import * as nock from "nock";
import { Attributes, ValueType } from "@opentelemetry/api";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import { AggregationTemporality, DataPointType, InstrumentType, ResourceMetrics } from "@opentelemetry/sdk-metrics";


describe("DynatraceMetricExporter", () => {
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

		exporter.export(getCounterResourceMetric("test", 10, { key: "value" }),
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

				exporter.export(getCounterResourceMetric("test", 10, { key: "value" }),
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

		exporter.export(getCounterResourceMetric("test", 10, { key: "value" }),
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

		exporter.export(getCounterResourceMetric("~!@", 10, {}),
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
						dataPointType: DataPointType.SUM,
						isMonotonic: true,
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
						dataPointType: DataPointType.SUM,
						isMonotonic: true,
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
						dataPointType: DataPointType.SUM,
						isMonotonic: true,
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
						dataPointType: DataPointType.SUM,
						isMonotonic: true,
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
					dataPointType: DataPointType.SUM,
					isMonotonic: true,
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

	test("should export delta counter metric", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, "test,key=value count,delta=3.2")
			.once()
			.reply(200);

		exporter.export(getCounterResourceMetric("test", 3.2, { key: "value" }, AggregationTemporality.DELTA),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// the request was sent once, no pending mocks are available
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should not export cumulative counter metric", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		exporter.export(getCounterResourceMetric("test", 3.2, { key: "value" }, AggregationTemporality.CUMULATIVE),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// there should still be an unused active mock
				expect(scope.activeMocks()).toHaveLength(1);
				expect(scope.pendingMocks()).toHaveLength(1);
				done();
			});
	});

	test("should export valid gauge metric independent of temporality", (done) => {
		// Gauge metrics should be serialized independent of the Temporality
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, "test,key=value gauge,3.2")
			.twice()
			.reply(200);

		exporter.export(getObservableGaugeResourceMetric("test", 3.2, { key: "value" }, AggregationTemporality.CUMULATIVE),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
			});

		exporter.export(getObservableGaugeResourceMetric("test", 3.2, { key: "value" }, AggregationTemporality.DELTA),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// the request was sent twice, no pending mocks are available
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should export cumulative UpDownCounter as gauge", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, "test,key=value gauge,3.2")
			.once()
			.reply(200);

		exporter.export(getUpDownCounterResourceMetric("test", 3.2, { key: "value" }, AggregationTemporality.CUMULATIVE),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// the request was sent once, no pending mocks are available
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should not export delta UpDownCounter metric", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		exporter.export(getUpDownCounterResourceMetric("test", 3.2, { key: "value" }, AggregationTemporality.DELTA),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// there should still be an unused active mock
				expect(scope.activeMocks()).toHaveLength(1);
				expect(scope.pendingMocks()).toHaveLength(1);
				done();
			});
	});


	test("should not export cumulative histogram", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		exporter.export(getHistogramResourceMetric("metric", AggregationTemporality.CUMULATIVE),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// there should still be an unused active mock
				expect(scope.activeMocks()).toHaveLength(1);
				expect(scope.pendingMocks()).toHaveLength(1);
				done();
			});
	});

	test("should export summary for delta histogram without min/max", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, "metric,key=value gauge,min=1,max=10,sum=22.4,count=7")
			.once()
			.reply(200);

		exporter.export(getHistogramResourceMetric("metric", AggregationTemporality.DELTA),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should export summary for delta histogram with min/max", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, "metric,key=value gauge,min=0.9,max=10.1,sum=22.4,count=7")
			.once()
			.reply(200);

		exporter.export(getHistogramResourceMetric("metric", AggregationTemporality.DELTA, { min: 0.9, max: 10.1 }),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should export non-histogram instrument with histogram point data", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path, "metric,key=value gauge,min=0.9,max=10.1,sum=22.4,count=7")
			.once()
			.reply(200);

		function createNonHistogramMetricsWithHistogramDataPoints(instrumentType: InstrumentType): ResourceMetrics {
			return {
				resource: new Resource({}),
				scopeMetrics: [{
					scope: {
						name: "myscope"
					},
					metrics: [
						{
							aggregationTemporality: AggregationTemporality.DELTA,
							dataPointType: DataPointType.HISTOGRAM,
							descriptor: {
								description: "a data point",
								name: "metric",
								type: instrumentType,
								unit: "",
								valueType: ValueType.DOUBLE
							},
							dataPoints: [
								{
									attributes: {
										key: "value"
									},
									endTime: [0, 0],
									startTime: [0, 0],
									value: {
										sum: 22.4,
										min: 0.9,
										max: 10.1,
										buckets: {
											boundaries: [1, 3, 5, 10],
											counts: [3, 1, 2, 0, 1]
										},
										count: 7
									}
								}
							]
						}
					]
				}]
			};
		}

		exporter.export(
			createNonHistogramMetricsWithHistogramDataPoints(InstrumentType.COUNTER),
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// there should no unused active mock
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should export with success if there are no metrics", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		const emptyMetrics: ResourceMetrics = {
			resource: new Resource({}),
			scopeMetrics: []
		};

		exporter.export(emptyMetrics,
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// there should still be an unused active mock
				expect(scope.activeMocks()).toHaveLength(1);
				expect(scope.pendingMocks()).toHaveLength(1);
				done();
			});
	});

	test("should fail to export if shutdown was called before", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const scope: nock.Scope = nock(target_host)
			.post(target_path)
			.reply(200);

		const emptyMetrics: ResourceMetrics = {
			resource: new Resource({}),
			scopeMetrics: []
		};

		exporter.shutdown().then(
			() => {
				exporter.export(emptyMetrics,
					(result: ExportResult) => {
						expect(result.code).toEqual(ExportResultCode.FAILED);
						// there should still be an unused active mock
						expect(scope.activeMocks()).toHaveLength(1);
						expect(scope.pendingMocks()).toHaveLength(1);
						done();
					});
			})
			.catch(
				() => fail("shutdown failed to resolve")
			);
	});

	function getCounterResourceMetric(
		name: string,
		value: number,
		attributes: Attributes,
		aggregationTemporality: AggregationTemporality = AggregationTemporality.DELTA
	): ResourceMetrics {
		// @ts-ignore this is guaranteed to be a ResourceMetric
		return getResourceMetric(name, value, attributes, aggregationTemporality, InstrumentType.COUNTER, DataPointType.SUM, true);
	}

	function getUpDownCounterResourceMetric(
		name: string,
		value: number,
		attributes: Attributes,
		aggregationTemporality: AggregationTemporality = AggregationTemporality.DELTA
	): ResourceMetrics {
		// @ts-ignore this is guaranteed to be a ResourceMetric
		return getResourceMetric(name, value, attributes, aggregationTemporality, InstrumentType.UP_DOWN_COUNTER, DataPointType.SUM, false);
	}

	function getObservableGaugeResourceMetric(
		name: string,
		value: number,
		attributes: Attributes,
		aggregationTemporality: AggregationTemporality = AggregationTemporality.DELTA
	): ResourceMetrics {
		// @ts-ignore this is guaranteed to be a ResourceMetric
		return getResourceMetric(name, value, attributes, aggregationTemporality, InstrumentType.OBSERVABLE_GAUGE, DataPointType.GAUGE);
	}

	function getResourceMetric(
		name: string,
		value: number,
		attributes: Attributes,
		aggregationTemporality: AggregationTemporality = AggregationTemporality.DELTA,
		instrumentType: InstrumentType = InstrumentType.COUNTER,
		dataPointType: DataPointType,
		isMonotonic?: boolean
	) {
		return {
			resource: new Resource({}),
			scopeMetrics: [{
				scope: {
					name: "myscope"
				},
				metrics: [
					{
						aggregationTemporality: aggregationTemporality,
						dataPointType: dataPointType,
						isMonotonic: isMonotonic,
						descriptor: {
							description: "a data point",
							name,
							type: instrumentType,
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

	function getHistogramResourceMetric(name: string, aggregationTemporality: AggregationTemporality, extrema?: { min: number; max: number }): ResourceMetrics {
		return {
			resource: new Resource({}),
			scopeMetrics: [{
				scope: {
					name: "myscope"
				},
				metrics: [
					{
						aggregationTemporality: aggregationTemporality,
						dataPointType: DataPointType.HISTOGRAM,
						descriptor: {
							description: "a histogram",
							name: name,
							type: InstrumentType.HISTOGRAM,
							unit: "",
							valueType: ValueType.DOUBLE
						},
						dataPoints: [
							{
								attributes: {
									key: "value"
								},
								endTime: [0, 0],
								startTime: [0, 0],
								value: {
									sum: 22.4,
									min: extrema?.min,
									max: extrema?.max,
									buckets: {
										boundaries: [1, 3, 5, 10],
										counts: [3, 1, 2, 0, 1]
									},
									count: 7
								}
							}
						]
					}
				]
			}]
		};
	}
});
