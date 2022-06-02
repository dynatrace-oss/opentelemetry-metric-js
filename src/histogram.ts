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

import { SummaryValue } from "@dynatrace/metric-utils";
import { DataPoint, Histogram } from "@opentelemetry/sdk-metrics-base";

export function estimateHistogram(point: DataPoint<Histogram>): SummaryValue | null {
	if (point.value.count === 0) {
		return null;
	}

	const { min, max } = estimateHistMinMax(point);

	return {
		count: point.value.count,
		sum: point.value.sum,
		max,
		min
	};
}

// Expect to be called only with points that contain actual data (point.value.count > 0)
function estimateHistMinMax(point: DataPoint<Histogram>): { min: number; max: number } {
	const { counts, boundaries } = point.value.buckets;
	const avg = point.value.sum / point.value.count;

	if (boundaries.length === 0 && counts[0] > 0) {
		return { min: avg, max: avg };
	}

	// Because we do not know the actual min and max, we estimate them based on the min and max non-empty bucket
	let minCountIdx = -1;
	let maxCountIdx = -1;
	for (let i = 0; i < counts.length; i++) {
		if (counts[i] > 0) {
			if (minCountIdx === -1) {
				minCountIdx = i;
			}
			maxCountIdx = i;
		}
	}

	// no values found
	if (minCountIdx === -1 || maxCountIdx === -1) {
		return {
			min: 0,
			max: 0
		};
	}

	let min: number;
	let max: number;

	// Use lower bound for min unless it is the first bucket which has no lower bound, then use upper
	if (minCountIdx === 0) {
		min = boundaries[minCountIdx];
	} else {
		min = boundaries[minCountIdx - 1];
	}

	// Use upper bound for max unless it is the last bucket which has no upper bound, then use lower
	if (maxCountIdx === counts.length - 1) {
		max = boundaries[maxCountIdx-1];
	} else {
		max = boundaries[maxCountIdx];
	}

	// Set min to average when higher than average. This can happen when most values are lower than first boundary (falling in first bucket).
	// Set max to average when lower than average. This can happen when most values are higher than last boundary (falling in last bucket).
	if (min > avg) {
		min = avg;
	}
	if (max < avg) {
		max = avg;
	}

	return { min, max };
}
