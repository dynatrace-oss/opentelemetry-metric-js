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

import { TotalCounter, DeltaCounter, Gauge, Summary } from "../../../src/utils/metric/metric";

describe("Metric", () => {
	describe("TotalCounter", () => {
		it("should serialize a value", () => {
			const ctr = new TotalCounter("key", [], 1, 80);
			expect(ctr.serialize()).toEqual("key count,1 80");
		});
	});
	describe("DeltaCounter", () => {
		it("should serialize a value", () => {
			const ctr = new DeltaCounter("key", [], 1, 80);
			expect(ctr.serialize()).toEqual("key count,delta=1 80");
		});
	});
	describe("Gauge", () => {
		it("should serialize a value", () => {
			const ctr = new Gauge("key", [], 1, 80);
			expect(ctr.serialize()).toEqual("key gauge,1 80");
		});
	});
	describe("Summary", () => {
		it("should serialize a value", () => {
			const ctr = new Summary("key", [], { min: 1, max: 10, sum: 34, count: 42 }, 80);
			expect(ctr.serialize()).toEqual("key gauge,min=1,max=10,sum=34,count=42 80");
		});
	});
});
