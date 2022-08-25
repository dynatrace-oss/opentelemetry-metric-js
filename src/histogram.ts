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

import { SummaryValue } from "@dynatrace/metric-utils";
import { DataPoint, Histogram } from "@opentelemetry/sdk-metrics-base";

export function estimateHistogram(point: DataPoint<Histogram>): SummaryValue {
	const { min, max, sum } = estimateOptionalProperties(point);

	return {
		count: point.value.count,
		sum,
		max,
		min
	};
}

function estimateSingleBucketHistogram(point: DataPoint<Histogram>): { min: number; max: number; sum: number } {
	const sum = point.value.sum ?? 0;
	// Only called after checking that count > 0
	const mean = sum / point.value.count;

	return { min: point.value.min ?? mean, max: point.value.max ?? mean, sum };
}

function estimateOptionalProperties(point: DataPoint<Histogram>): { min: number; max: number; sum: number } {
	// shortcut if min, max, and sum are provided
	if (point.value.min != null && point.value.max != null && point.value.sum != null) {
		return { min: point.value.min, max: point.value.max, sum: point.value.sum };
	}

	// Shortcut for 0 count histograms
	if (point.value.count === 0) {
		return { min: 0, max: 0, sum: 0 };
	}

	const counts = point.value.buckets.counts;
	const boundaries = point.value.buckets.boundaries;

	// a single-bucket histogram is a special case
	if (counts.length === 1) {
		return estimateSingleBucketHistogram(point);
	}

	// If any of min, max, sum is not provided in the data point,
	// loop through the buckets to estimate them.
	// All three values are estimated in order to avoid looping multiple times
	// or complicating the loop with branches. After the loop, estimates
	// will be overridden with any values provided by the data point.
	let foundNonEmptyBucket = false;
	let min = 0;
	let max = 0;
	let sum = 0;

	// Because we do not know the actual min, max, or sum, we estimate them based on non-empty buckets
	for (let i = 0; i < counts.length; i++) {
		// empty bucket.
		if (counts[i] === 0) {
			continue;
		}

		// range for bucket counts[i] is bounds[i-1] to bounds[i]

		// min estimation.
		if (!foundNonEmptyBucket) {
			foundNonEmptyBucket = true;
			if (i === 0) {
				// if we're in the first bucket, the best estimate we can make for min is the upper bound
				min = boundaries[i];
			} else {
				min = boundaries[i - 1];
			}
		}

		// max estimation
		if (i === counts.length - 1) {
			// if we're in the last bucket, the best estimate we can make for max is the lower bound
			max = boundaries[i - 1];
		} else {
			max = boundaries[i];
		}

		// sum estimation
		switch (i) {
			case 0:
				// in the first bucket, estimate sum using the upper bound
				sum += counts[i] * boundaries[i];
				break;
			case counts.length - 1:
				// in the last bucket, estimate sum using the lower bound
				sum += counts[i] * boundaries[i - 1];
				break;
			default:
				// in any other bucket, estimate sum using the bucket midpoint
				sum += counts[i] * (boundaries[i] + boundaries[i - 1]) / 2;
				break;
		}
	}

	// Override estimates with any values provided by the data point
	min = point.value.min ?? min;
	max = point.value.max ?? max;
	sum = point.value.sum ?? sum;

	// Set min to average when higher than average. This can happen when most values are lower than first boundary (falling in first bucket).
	// Set max to average when lower than average. This can happen when most values are higher than last boundary (falling in last bucket).
	// point.value.count will never be zero, as this is checked above.
	const avg = sum / point.value.count;
	if (min > avg) {
		min = avg;
	}
	if (max < avg) {
		max = avg;
	}

	return { min, max, sum };
}
