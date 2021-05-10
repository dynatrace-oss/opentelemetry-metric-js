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

import { DeltaCounter, Gauge, Summary, TotalCounter } from "../../../src/utils/metric/metric";
import { MetricFactory } from "../../../src/utils/metric/metric-factory";

describe("MetricFactory", () => {
	let factory: MetricFactory;
	const now = Date.now();

	beforeAll(() => {
		factory = new MetricFactory();
	});

	it("should create a counter", () => {
		const metric = factory.createTotalCounter("counter_name", [], 25, now);
		expect(metric).toBeInstanceOf(TotalCounter);
	});

	it("should create a delta counter", () => {
		const metric = factory.createDeltaCounter("counter_name", [], 25, now);
		expect(metric).toBeInstanceOf(DeltaCounter);
	});

	it("should create a gauge", () => {
		const metric = factory.createGauge("gauge_name", [], 25, now);
		expect(metric).toBeInstanceOf(Gauge);
	});

	it("should create a summary", () => {
		const metric = factory.createSummary("summary_name", [], { min: 1, max: 10, sum: 34, count: 42 }, now);
		expect(metric).toBeInstanceOf(Summary);
	});

	it("should serialize metrics", () => {
		const cnt = factory.createTotalCounter("name", [], 25, now);
		const dcnt = factory.createDeltaCounter("name", [], 25, now);
		const gauge = factory.createGauge("name", [], 25, now);
		const summary = factory.createSummary("name", [], { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt?.serialize()).toEqual(`name count,25 ${now}`);
		expect(dcnt?.serialize()).toEqual(`name count,delta=25 ${now}`);
		expect(gauge?.serialize()).toEqual(`name gauge,25 ${now}`);
		expect(summary?.serialize()).toEqual(`name gauge,min=1,max=10,sum=34,count=42 ${now}`);
	});

	it("should serialize metrics without timestamps", () => {
		const cnt = factory.createTotalCounter("name", [], 25);
		const dcnt = factory.createDeltaCounter("name", [], 25);
		const gauge = factory.createGauge("name", [], 25);
		const summary = factory.createSummary("name", [], { min: 1, max: 10, sum: 34, count: 42 });

		expect(cnt?.serialize()).toEqual("name count,25");
		expect(dcnt?.serialize()).toEqual("name count,delta=25");
		expect(gauge?.serialize()).toEqual("name gauge,25");
		expect(summary?.serialize()).toEqual("name gauge,min=1,max=10,sum=34,count=42");
	});

	it("should not create metrics with invalid names", () => {
		const cnt = factory.createTotalCounter("", [], 25, now);
		const dcnt = factory.createDeltaCounter("", [], 25, now);
		const gauge = factory.createGauge("", [], 25, now);
		const summary = factory.createSummary("", [], { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt).toBeNull();
		expect(dcnt).toBeNull();
		expect(gauge).toBeNull();
		expect(summary).toBeNull();
	});

	it("should not create metrics with invalid values", () => {
		// @ts-expect-error invalid values should return null metrics
		const cnt = factory.createTotalCounter("name", [], true, now);
		// @ts-expect-error invalid values should return null metrics
		const dcnt = factory.createDeltaCounter("name", [], true, now);
		// @ts-expect-error invalid values should return null metrics
		const gauge = factory.createGauge("name", [], true, now);
		// @ts-expect-error invalid values should return null metrics
		const summary = factory.createSummary("name", [], { min: 1, max: 10, sum: 34, count: true }, now);

		expect(cnt).toBeNull();
		expect(dcnt).toBeNull();
		expect(gauge).toBeNull();
		expect(summary).toBeNull();
	});

	it("should include dimensions", () => {
		const dims = [
			{ key: "dim", value: "value" }
		];

		const cnt = factory.createTotalCounter("name", dims, 25, now);
		const dcnt = factory.createDeltaCounter("name", dims, 25, now);
		const gauge = factory.createGauge("name", dims, 25, now);
		const summary = factory.createSummary("name", dims, { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt?.serialize()).toEqual(`name,dim=value count,25 ${now}`);
		expect(dcnt?.serialize()).toEqual(`name,dim=value count,delta=25 ${now}`);
		expect(gauge?.serialize()).toEqual(`name,dim=value gauge,25 ${now}`);
		expect(summary?.serialize()).toEqual(`name,dim=value gauge,min=1,max=10,sum=34,count=42 ${now}`);
	});

	it("should skip dimensions with invalid keys", () => {
		const dims = [
			{ key: "dim", value: "value" },
			{ key: "", value: "value" }
		];

		const cnt = factory.createTotalCounter("name", dims, 25, now);
		const dcnt = factory.createDeltaCounter("name", dims, 25, now);
		const gauge = factory.createGauge("name", dims, 25, now);
		const summary = factory.createSummary("name", dims, { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt?.serialize()).toEqual(`name,dim=value count,25 ${now}`);
		expect(dcnt?.serialize()).toEqual(`name,dim=value count,delta=25 ${now}`);
		expect(gauge?.serialize()).toEqual(`name,dim=value gauge,25 ${now}`);
		expect(summary?.serialize()).toEqual(`name,dim=value gauge,min=1,max=10,sum=34,count=42 ${now}`);
	});

	it("should normalize dimension keys", () => {
		const dims = [
			{ key: "dim", value: "value" },
			{ key: "nörmalize", value: "value" }
		];

		const cnt = factory.createTotalCounter("name", dims, 25, now);
		const dcnt = factory.createDeltaCounter("name", dims, 25, now);
		const gauge = factory.createGauge("name", dims, 25, now);
		const summary = factory.createSummary("name", dims, { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt?.serialize()).toEqual(`name,dim=value,n_rmalize=value count,25 ${now}`);
		expect(dcnt?.serialize()).toEqual(`name,dim=value,n_rmalize=value count,delta=25 ${now}`);
		expect(gauge?.serialize()).toEqual(`name,dim=value,n_rmalize=value gauge,25 ${now}`);
		expect(summary?.serialize()).toEqual(`name,dim=value,n_rmalize=value gauge,min=1,max=10,sum=34,count=42 ${now}`);
	});

	it("should skip dimensions with invalid values", () => {
		const dims = [
			{ key: "dim", value: "value" },
			{ key: "dim2", value: "" }
		];

		const cnt = factory.createTotalCounter("name", dims, 25, now);
		const dcnt = factory.createDeltaCounter("name", dims, 25, now);
		const gauge = factory.createGauge("name", dims, 25, now);
		const summary = factory.createSummary("name", dims, { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt?.serialize()).toEqual(`name,dim=value count,25 ${now}`);
		expect(dcnt?.serialize()).toEqual(`name,dim=value count,delta=25 ${now}`);
		expect(gauge?.serialize()).toEqual(`name,dim=value gauge,25 ${now}`);
		expect(summary?.serialize()).toEqual(`name,dim=value gauge,min=1,max=10,sum=34,count=42 ${now}`);
	});

	it("should normalize and escape dimension values", () => {
		const dims = [
			{ key: "dim", value: "value" },
			{ key: "dim2", value: "a\u0000\u0000\u0000b\"quoted\"" }
		];

		const cnt = factory.createTotalCounter("name", dims, 25, now);
		const dcnt = factory.createDeltaCounter("name", dims, 25, now);
		const gauge = factory.createGauge("name", dims, 25, now);
		const summary = factory.createSummary("name", dims, { min: 1, max: 10, sum: 34, count: 42 }, now);

		expect(cnt?.serialize()).toEqual(`name,dim=value,dim2=a_b\\"quoted\\" count,25 ${now}`);
		expect(dcnt?.serialize()).toEqual(`name,dim=value,dim2=a_b\\"quoted\\" count,delta=25 ${now}`);
		expect(gauge?.serialize()).toEqual(`name,dim=value,dim2=a_b\\"quoted\\" gauge,25 ${now}`);
		expect(summary?.serialize()).toEqual(`name,dim=value,dim2=a_b\\"quoted\\" gauge,min=1,max=10,sum=34,count=42 ${now}`);
	});

	describe("with prefix", () => {
		beforeAll(() => {
			factory = new MetricFactory({ prefix: "prefix" });
		});

		it("should serialize metrics", () => {
			const cnt = factory.createTotalCounter("name", [], 25, now);
			const dcnt = factory.createDeltaCounter("name", [], 25, now);
			const gauge = factory.createGauge("name", [], 25, now);
			const summary = factory.createSummary("name", [], { min: 1, max: 10, sum: 34, count: 42 }, now);

			expect(cnt?.serialize()).toEqual(`prefix.name count,25 ${now}`);
			expect(dcnt?.serialize()).toEqual(`prefix.name count,delta=25 ${now}`);
			expect(gauge?.serialize()).toEqual(`prefix.name gauge,25 ${now}`);
			expect(summary?.serialize()).toEqual(`prefix.name gauge,min=1,max=10,sum=34,count=42 ${now}`);
		});
	});

	describe("with prefix", () => {
		beforeAll(() => {
			factory = new MetricFactory({ defaultDimensions: [{ key: "default", value: "val" }] });
		});

		it("should serialize metrics", () => {
			const cnt = factory.createTotalCounter("name", [], 25, now);
			const dcnt = factory.createDeltaCounter("name", [], 25, now);
			const gauge = factory.createGauge("name", [], 25, now);
			const summary = factory.createSummary("name", [], { min: 1, max: 10, sum: 34, count: 42 }, now);

			expect(cnt?.serialize()).toEqual(`name,default=val count,25 ${now}`);
			expect(dcnt?.serialize()).toEqual(`name,default=val count,delta=25 ${now}`);
			expect(gauge?.serialize()).toEqual(`name,default=val gauge,25 ${now}`);
			expect(summary?.serialize()).toEqual(`name,default=val gauge,min=1,max=10,sum=34,count=42 ${now}`);
		});
	});
});
