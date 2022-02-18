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
import { MetricKind, MetricRecord, SumAggregator } from "@opentelemetry/sdk-metrics-base";
import { AggregationTemporality, ValueType } from "@opentelemetry/api-metrics";
import { ExportResult, ExportResultCode } from "@opentelemetry/core";
import { Resource } from "@opentelemetry/resources";
import * as sinon from "sinon";


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
			.post(target_path, /test,key=value count,delta=10 \d{13}/g)
			.once()
			.reply(200);

		const rec: MetricRecord = getTestMetricRecord("test", 10, { "key": "value" });

		exporter.export([rec],
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				// the request was sent once, no pending mocks are available
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should drop cumulative sums but not delta sums", (done) => {
		const target_host = "https://example.com:8080";
		const target_path = "/metrics";
		const target_url = target_host + target_path;
		const exporter = new DynatraceMetricExporter({
			url: target_url
		});

		const spy = exporter["_sendRequest"] = sinon.stub().callsFake((_, cb: (code: ExportResultCode) => void) => cb(ExportResultCode.SUCCESS));

		exporter.export([
			getTestMetricRecord("delta_test", 10, { "key": "value" }),
			getTestMetricRecord("cumulative_test", 10, { "key": "value" }, AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE)
		], () => {
			sinon.assert.calledOnce(spy);
			expect(spy.getCalls()[0].firstArg).toMatch(/^delta_test,key=value count,delta=10 \d{13}$/);
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
					.post(target_path, /test,key=value count,delta=10 \d{13}/g)
					.once()
					.reply(responseCode);

				const rec: MetricRecord = getTestMetricRecord("test", 10, { "key": "value" });

				exporter.export([rec],
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
			.post(target_path, /test,key=value count,delta=10 \d{13}/g)
			.replyWithError({})
			.post(target_path, /test,key=value count,delta=10 \d{13}/g)
			.replyWithError({})
			.post(target_path, /test,key=value count,delta=10 \d{13}/g)
			.replyWithError({})
			.post(target_path, /test,key=value count,delta=10 \d{13}/g)
			.replyWithError({});

		const rec: MetricRecord = getTestMetricRecord("test", 10, { "key": "value" });

		exporter.export([rec],
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
			.post(target_path, /_ count,delta=10 /)
			.once()
			.reply(200);

		const rec: MetricRecord = getTestMetricRecord("~!@", 10, {});

		exporter.export([rec],
			(result: ExportResult) => {
				expect(result.code).toEqual(ExportResultCode.SUCCESS);
				expect(scope.activeMocks()).toHaveLength(0);
				expect(scope.pendingMocks()).toHaveLength(0);
				done();
			});
	});

	test("should return success on empty list but not send the request", (done) => {
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

		exporter.export([],
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

		const rec: MetricRecord = getTestMetricRecord("", 12, {});

		exporter.export([rec],
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
			.post(target_path, /valid count,delta=13 \d{13}/)
			.once()
			.reply(200);

		const records = [
			getTestMetricRecord("", 12, {}),		// invalid
			getTestMetricRecord("valid", 13, {})	// valid
		];

		exporter.export(records,
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

		const records: MetricRecord[] = [...Array(1001).keys()]
			.map((v: number) => {
				return getTestMetricRecord("metric" + v.toString(), v, {});
			});

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

	function getTestMetricRecord(name: string, value: number, attributes: { [key: string]: string }, temporality = AggregationTemporality.AGGREGATION_TEMPORALITY_DELTA): MetricRecord {
		const aggregator = new SumAggregator();
		aggregator.update(value);

		return {
			descriptor: {
				name: name,
				description: "some desc",
				unit: "unit",
				metricKind: MetricKind.UP_DOWN_COUNTER,
				valueType: ValueType.DOUBLE
			},
			attributes: attributes,
			aggregator: aggregator,
			aggregationTemporality: temporality,
			resource: Resource.EMPTY,
			instrumentationLibrary: {
				name: "my-mock-lib"
			}
		};
	}
});

