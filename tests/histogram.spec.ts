/*
	Copyright 2022 Dynatrace LLC

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

import * as assert from "assert";
import { estimateHistogram } from "../src/histogram";


describe("estimateHistogram", () => {
	describe("min estimation", () => {
		const cases = [
			{
				description: "values in second bucket",
				boundaries: [1, 2, 3, 4, 5],
				counts: [0, 1, 0, 3, 2, 0],
				sum: 21.2,
				expectedMin: 1
			},
			{
				description: "values in first bucket",
				boundaries: [1, 2, 3, 4, 5],
				counts: [1, 0, 0, 3, 0, 4],
				sum: 34.5,
				expectedMin: 1
			},
			{
				description: "only first bucket has values",
				boundaries: [1, 2, 3, 4, 5],
				counts: [3, 0, 0, 0, 0, 0],
				sum: 0.75,
				expectedMin: 0.25
			},
			{
				description: "only one bucket",
				boundaries: [],
				counts: [4],
				sum: 8.8,
				expectedMin: 2.2
			},
			{
				description: "only one bucket",
				boundaries: [],
				counts: [1],
				sum: 1.2,
				expectedMin: 1.2
			},
			{
				description: "only last bucket has values",
				boundaries: [1, 2, 3, 4, 5],
				counts: [0, 0, 0, 0, 0, 3],
				sum: 15.6,
				expectedMin: 5
			}
		];

		for (const testCase of cases) {
			test(testCase.description, () => {
				const summary = estimateHistogram({
					attributes: {},
					endTime: [0, 0],
					startTime: [0, 0],
					value: {
						sum: testCase.sum,
						buckets: {
							boundaries: testCase.boundaries,
							counts: testCase.counts
						},
						count: testCase.counts.reduce((p, c) => p + c)
					}
				});

				assert.ok(summary);
				expect(summary.min).toBeCloseTo(testCase.expectedMin);
			});
		}
	});

	describe("max estimation", () => {
		const cases = [
			{
				description: "values in second bucket",
				boundaries: [1, 2, 3, 4, 5],
				counts: [0, 1, 0, 3, 2, 0],
				sum: 21.2,
				expectedMax: 5
			},
			{
				description: "Last bucket has value, use the last boundary as estimation instead of Inf.",
				boundaries: [1, 2, 3, 4, 5],
				counts: [1, 0, 0, 3, 0, 4],
				sum: 34.5,
				expectedMax: 5
			},
			{
				description: "Only the last bucket has values, use the mean (10.1) Otherwise, the max would be estimated as 5, and max >= avg would be violated.",
				boundaries: [1, 2, 3, 4, 5],
				counts: [0, 0, 0, 0, 0, 2],
				sum: 20.2,
				expectedMax: 10.1
			},
			{
				description: "Just one bucket from -Inf to Inf, calculate the mean as max value.",
				boundaries: [],
				counts: [4],
				sum: 8.8,
				expectedMax: 2.2
			},
			{
				description: "Just one bucket from -Inf to Inf, calculate the mean as max value.",
				boundaries: [],
				counts: [1],
				sum: 1.2,
				expectedMax: 1.2
			},
			{
				description: "Max is larger than the sum, use the estimated boundary.",
				boundaries: [0, 5],
				counts: [0, 2, 0],
				sum: 2.3,
				expectedMax: 5
			},
			{
				description: "Only the first bucket has a value, use the upper bound.",
				boundaries: [1, 2, 3, 4, 5],
				counts: [3, 0, 0, 0, 0, 0],
				sum: 1.5,
				expectedMax: 1
			},
			{
				description: "Sum is smaller than the largest bucket bound, mean is larger. Use mean. Otherwise, max would be estimated as -5 and max >= avg would be violated",
				boundaries: [-10, -5],
				counts: [0, 0, 3],
				sum: -7.5,
				expectedMax: -2.5
			}
		];

		for (const testCase of cases) {
			test(testCase.description, () => {
				const summary = estimateHistogram({
					attributes: {},
					endTime: [0, 0],
					startTime: [0, 0],
					value: {
						sum: testCase.sum,
						buckets: {
							boundaries: testCase.boundaries,
							counts: testCase.counts
						},
						count: testCase.counts.reduce((p, c) => p + c)
					}
				});

				assert.ok(summary);
				expect(summary.max).toBeCloseTo(testCase.expectedMax);
			});
		}
	});
});
