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

import { CounterMetric, MeterProvider, MetricRecord, UpDownCounterMetric, ValueRecorderMetric } from "@opentelemetry/metrics";
import { normalizeDimensionKey, normalizeMetricName, serializeMetrics } from "./serialization";

describe("Serialization", () => {
	let metricRecords: MetricRecord[];
	let counter: CounterMetric;
	const provider = new MeterProvider();
	const meter = provider.getMeter("meter");
	beforeAll(async () => {
		counter = meter.createCounter("counter") as CounterMetric;
		const counter2 = meter.createCounter("counter2") as CounterMetric;
		counter.add(6);
		counter2.add(12);
		metricRecords = [
			...await counter.getMetricRecord(),
			...await counter2.getMetricRecord()
		];
	});

	describe("Normalization", () => {
		test("should normalize metric names", () => {
			expect(normalizeMetricName("just.a.normal.key")).toEqual("just.a.normal.key");
			expect(normalizeMetricName("Case")).toEqual("Case");
			expect(normalizeMetricName("~0something")).toEqual("something");
			expect(normalizeMetricName("some~thing")).toEqual("some_thing");
			expect(normalizeMetricName("some~ä#thing")).toEqual("some_thing");
			expect(normalizeMetricName("a..b")).toEqual("a.b");
			expect(normalizeMetricName("a.....b")).toEqual("a.b");
			expect(normalizeMetricName("asd")).toEqual("asd");
			expect(normalizeMetricName(".")).toEqual(null);
			expect(normalizeMetricName(".a")).toEqual(null);
			expect(normalizeMetricName("a.")).toEqual("a");
			expect(normalizeMetricName(".a.")).toEqual(null);
			expect(normalizeMetricName("_a")).toEqual("a");
			expect(normalizeMetricName("a_")).toEqual("a_");
			expect(normalizeMetricName("_a_")).toEqual("a_");
			expect(normalizeMetricName(".a_")).toEqual(null);
			expect(normalizeMetricName("_a.")).toEqual("a");
			expect(normalizeMetricName("._._a_._._")).toEqual(null);
			expect(normalizeMetricName("test..empty.test")).toEqual("test.empty.test");
			expect(normalizeMetricName("a,,,b  c=d\\e\\ =,f")).toEqual("a_b_c_d_e_f");
			expect(normalizeMetricName("a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7")).toEqual("a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p_q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7");
		});
		test("should normalize dimension keys", () => {
			expect(normalizeDimensionKey("just.a.normal.key")).toEqual("just.a.normal.key");
			expect(normalizeDimensionKey("Case")).toEqual("case");
			expect(normalizeDimensionKey("~0something")).toEqual("something");
			expect(normalizeDimensionKey("some~thing")).toEqual("some_thing");
			expect(normalizeDimensionKey("some~ä#thing")).toEqual("some_thing");
			expect(normalizeDimensionKey("a..b")).toEqual("a.b");
			expect(normalizeDimensionKey("a.....b")).toEqual("a.b");
			expect(normalizeDimensionKey("asd")).toEqual("asd");
			expect(normalizeDimensionKey(".")).toEqual("");
			expect(normalizeDimensionKey(".a")).toEqual("a");
			expect(normalizeDimensionKey("a.")).toEqual("a");
			expect(normalizeDimensionKey(".a.")).toEqual("a");
			expect(normalizeDimensionKey("_a")).toEqual("a");
			expect(normalizeDimensionKey("a_")).toEqual("a_");
			expect(normalizeDimensionKey("_a_")).toEqual("a_");
			expect(normalizeDimensionKey(".a_")).toEqual("a_");
			expect(normalizeDimensionKey("_a.")).toEqual("a");
			expect(normalizeDimensionKey("._._a_._._")).toEqual("a_");
			expect(normalizeDimensionKey("test..empty.test")).toEqual("test.empty.test");
			expect(normalizeDimensionKey("a,,,b  c=d\\e\\ =,f")).toEqual("a_b_c_d_e_f");
			expect(normalizeDimensionKey("a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7")).toEqual("a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7");
		});
	});
	test("should serialize 0 metrics to the empty string", () => {
		const serialized = serializeMetrics([], "", "");
		expect(serialized).toEqual("");
	});

	test("should serialize 1 metric per line", () => {
		const serialized = serializeMetrics(metricRecords, "", "");
		expect(serialized).toMatch(/^counter count,6 \d+\ncounter2 count,12 \d+/);
	});

	test("should prefix metric name", () => {
		const serialized = serializeMetrics(metricRecords, "", "prefix");
		expect(serialized).toMatch(/^prefix\.counter count,6 \d+\nprefix\.counter2 count,12 \d+/);
	});

	test("should serialize a Counter as a count", async () => {
		metricRecords = await counter.getMetricRecord();
		const serialized = serializeMetrics(metricRecords, "", "");
		expect(serialized).toMatch(/^counter count,6 \d+/);
	});

	test("should serialize a ValueRecorder as a gauge summary", async () => {
		const valueRecorder = meter.createValueRecorder("valueRecorder") as ValueRecorderMetric;
		valueRecorder.record(6);
		metricRecords = await valueRecorder.getMetricRecord();
		const serialized = serializeMetrics(metricRecords, "", "");
		expect(serialized).toMatch(/^valueRecorder gauge,min=6,max=6,sum=6,count=1 \d+/);
	});

	test("should serialize a UpDownCounter as a count", async () => {
		const upDownSum = meter.createUpDownCounter("upDownSum") as UpDownCounterMetric;
		upDownSum.add(5);
		upDownSum.add(-2);
		metricRecords = await upDownSum.getMetricRecord();
		const serialized = serializeMetrics(metricRecords, "", "");
		expect(serialized).toMatch(/^upDownSum count,3 \d+/);
	});
});
