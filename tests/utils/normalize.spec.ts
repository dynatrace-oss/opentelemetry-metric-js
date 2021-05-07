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

import { normalizeDimensionKey, normalizeDimensionValue, normalizeMetricKey } from "../../src/utils/normalize";

describe("Normalization", () => {
	describe("Metric Keys", () => {
		const cases: [string, string | null][] = [
			["~0something", "something"],
			["some~thing", "some_thing"],
			["some~ä#thing", "some_thing"],
			["asd", "asd"],
			["_a", "_a"],
			["a_", "a_"],
			["_a_", "_a_"],
			[".a_", null],
			["_a.", "_a"],
			["._._a_._._", null],
			["test..empty.test", "test.empty.test"],
			["basecase", "basecase"],
			["just.a.normal.key", "just.a.normal.key"],
			["_case", "_case"],
			["case_case", "case_case"],
			["case1", "case1"],
			["1case", "case"],
			["Case", "Case"],
			["CASE", "CASE"],
			["someCase", "someCase"],
			["prefix.case", "prefix.case"],
			["This.Is.Valid", "This.Is.Valid"],
			["0a.b", "a.b"],
			["_a.b", "_a.b"],
			["a.0", "a.0"],
			["a.0.c", "a.0.c"],
			["a.0b.c", "a.0b.c"],
			["-dim", "dim"],
			["dim-", "dim-"],
			["dim---", "dim---"],
			["", null],
			["000", null],
			["0.section", null],
			["~key", "key"],
			["~0#key", "key"],
			["some~key", "some_key"],
			["some#~äkey", "some_key"],
			["a..b", "a.b"],
			["a.....b", "a.b"],
			[".", null],
			[".a", null],
			["a.", "a"],
			[".a.", null],
			["___a", "___a"],
			["a___", "a___"],
			["a$%@", "a"],
			["a.b$%@.c", "a.b.c"],
			["a___b", "a___b"],
			["._._._a_._._.", null],
			["_._._.a_._", "_._._.a_._"],
			["an..empty.section", "an.empty.section"],
			["a,,,b  c=d\\e\\ =,f", "a_b_c_d_e_f"],
			["a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7", "a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7"],
			["a.b.+", "a.b"],
			["metric.key-number-1.001", "metric.key-number-1.001"],
			["MyMetric", "MyMetric"],
			["0MyMetric", "MyMetric"],
			["mÄtric", "m_tric"],
			["metriÄ", "metri"],
			["Ätric", "tric"],
			["meträääääÖÖÖc", "metr_c"]
		];

		test.each(cases)("Expect %s to be normalized to %s", (input, expected) => {
			expect(normalizeMetricKey(input)).toEqual(expected);
		});
	});

	describe("Dimension Keys", () => {
		const cases: [string, string | null][] = [
			["just.a.normal.key", "just.a.normal.key"],
			["Case", "case"],
			["~0something", "something"],
			["some~thing", "some_thing"],
			["some~ä#thing", "some_thing"],
			["asd", "asd"],
			["_a", "_a"],
			["a_", "a_"],
			["_a_", "_a_"],
			[".a_", "a_"],
			["_a.", "_a"],
			["._._a_._._", "_._a_._._"],
			["test..empty.test", "test.empty.test"],
			["dim", "dim"],
			["dim1", "dim1"],
			["_dim", "_dim"],
			["Dim", "dim"],
			["dIm", "dim"],
			["diM", "dim"],
			["DIM", "dim"],
			["dim:dim", "dim:dim"],
			["dim_dim", "dim_dim"],
			["dim-dim", "dim-dim"],
			["-dim", "dim"],
			["dim-", "dim-"],
			["dim---", "dim---"],
			["~0#dim", "dim"],
			["---dim", "dim"],
			[":dim", "dim"],
			["~@#ä", null],
			["aaa~@#ä", "aaa"],
			["aaa___", "aaa___"],
			["000", null],
			["dim1.value1", "dim1.value1"],
			["dim.0dim", "dim.dim"],
			["dim.000", "dim"],
			["dim.~val", "dim.val"],
			["dim.val~~", "dim.val"],
			["dim.~~~", "dim"],
			["dim._val", "dim._val"],
			["dim.___", "dim.___"],
			["dim.dim.dim.dim", "dim.dim.dim.dim"],
			["a..b", "a.b"],
			["a.....b", "a.b"],
			[".a", "a"],
			["a.b:c.d", "a.b:c.d"],
			["a.", "a"],
			[".", null],
			["a...", "a"],
			[".a.", "a"],
			["   a", "a"],
			["a   ", "a"],
			["a b", "a_b"],
			["a    b", "a_b"],
			["", null],
			["dim.val:count.val001", "dim.val:count.val001"],
			["a,,,b  c=d\\e\\ =,f", "a_b_c_d_e_f"],
			["a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7", "a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7"],
			["Tag", "tag"],
			["0Tag", "tag"],
			["tÄg", "t_g"],
			["mytäääg", "myt_g"],
			["ääätag", "tag"],
			["ä_ätag", "__tag"],
			["Bla___", "bla___"],
			[Array(120).fill("a").join(""), Array(100).fill("a").join("")]
		];

		test.each(cases)("Expect %s to be normalized to %s", (input, expected) => {
			expect(normalizeDimensionKey(input)).toEqual(expected);
		});
	});

	describe("Dimension Values", () => {
		const cases: [string, string | null][] = [
			["value","value"],
			["",null],
			["VALUE","VALUE"],
			["a:3","a:3"],
			["~@#ä","~@#ä"],
			["a b","a\\ b"],
			["a,b","a\\,b"],
			["a=b","a\\=b"],
			["a\\b","a\\\\b"],
			[" ,=\\","\\ \\,\\=\\\\"],
			["\"\\ \"\"","\\\"\\\\\\ \\\"\\\""],
			["key=\"value\"","key\\=\\\"value\\\""],
			["\u0000a\u0007","a"],
			["\u0000\u0007",null],
			["a\u0001b","a_b"],
			["a\u0001\u0001\u0001b","a_b"],
			["\u0034\u0066","\u0034\u0066"],
			["\u0132_\u0133_\u0150_\u0156","\u0132_\u0133_\u0150_\u0156"],
			["\u0000a","a"],
			["\u0000\u0000\u0000a","a"],
			["a\u0000","a"],
			["a\u0000\u0000\u0000","a"],
			["a\u0000b","a_b"],
			["a\u0000\u0000\u0000b","a_b"],
			[Array(270).fill("a").join(""),Array(250).fill("a").join("")],
			[Array(270).fill("=").join(""),Array(125).fill("\\=").join("")]
		];

		test.each(cases)("Expect %s to be normalized to %s", (input, expected) => {
			expect(normalizeDimensionValue(input)).toEqual(expected);
		});
	});
});
