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
	test("should normalize metric names", () => {
		expect(normalizeMetricKey("just.a.normal.key")).toEqual("just.a.normal.key");
		expect(normalizeMetricKey("Case")).toEqual("Case");
		expect(normalizeMetricKey("~0something")).toEqual("something");
		expect(normalizeMetricKey("some~thing")).toEqual("some_thing");
		expect(normalizeMetricKey("some~ä#thing")).toEqual("some_thing");
		expect(normalizeMetricKey("a..b")).toEqual("a.b");
		expect(normalizeMetricKey("a.....b")).toEqual("a.b");
		expect(normalizeMetricKey("asd")).toEqual("asd");
		expect(normalizeMetricKey(".")).toEqual(null);
		expect(normalizeMetricKey(".a")).toEqual(null);
		expect(normalizeMetricKey("a.")).toEqual("a");
		expect(normalizeMetricKey(".a.")).toEqual(null);
		expect(normalizeMetricKey("_a")).toEqual("_a");
		expect(normalizeMetricKey("a_")).toEqual("a_");
		expect(normalizeMetricKey("_a_")).toEqual("_a_");
		expect(normalizeMetricKey(".a_")).toEqual(null);
		expect(normalizeMetricKey("_a.")).toEqual("_a");
		expect(normalizeMetricKey("._._a_._._")).toEqual(null);
		expect(normalizeMetricKey("test..empty.test")).toEqual("test.empty.test");
		expect(normalizeMetricKey("a,,,b  c=d\\e\\ =,f")).toEqual("a_b_c_d_e_f");
		expect(normalizeMetricKey("a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7")).toEqual("a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7");

		expect(normalizeMetricKey("basecase")).toEqual("basecase");
		expect(normalizeMetricKey("just.a.normal.key")).toEqual("just.a.normal.key");
		expect(normalizeMetricKey("_case")).toEqual("_case");
		expect(normalizeMetricKey("case_case")).toEqual("case_case");
		expect(normalizeMetricKey("case1")).toEqual("case1");
		expect(normalizeMetricKey("1case")).toEqual("case");
		expect(normalizeMetricKey("Case")).toEqual("Case");
		expect(normalizeMetricKey("CASE")).toEqual("CASE");
		expect(normalizeMetricKey("someCase")).toEqual("someCase");
		expect(normalizeMetricKey("prefix.case")).toEqual("prefix.case");
		expect(normalizeMetricKey("This.Is.Valid")).toEqual("This.Is.Valid");
		expect(normalizeMetricKey("0a.b")).toEqual("a.b");
		expect(normalizeMetricKey("_a.b")).toEqual("_a.b");
		expect(normalizeMetricKey("a.0")).toEqual("a.0");
		expect(normalizeMetricKey("a.0.c")).toEqual("a.0.c");
		expect(normalizeMetricKey("a.0b.c")).toEqual("a.0b.c");
		expect(normalizeMetricKey("-dim")).toEqual("dim");
		expect(normalizeMetricKey("dim-")).toEqual("dim-");
		expect(normalizeMetricKey("dim---")).toEqual("dim---");
		expect(normalizeMetricKey("")).toEqual(null);
		expect(normalizeMetricKey("000")).toEqual(null);
		expect(normalizeMetricKey("0.section")).toEqual(null);
		expect(normalizeMetricKey("~key")).toEqual("key");
		expect(normalizeMetricKey("~0#key")).toEqual("key");
		expect(normalizeMetricKey("some~key")).toEqual("some_key");
		expect(normalizeMetricKey("some#~äkey")).toEqual("some_key");
		expect(normalizeMetricKey("a..b")).toEqual("a.b");
		expect(normalizeMetricKey("a.....b")).toEqual("a.b");
		expect(normalizeMetricKey(".")).toEqual(null);
		expect(normalizeMetricKey(".a")).toEqual(null);
		expect(normalizeMetricKey("a.")).toEqual("a");
		expect(normalizeMetricKey(".a.")).toEqual(null);
		expect(normalizeMetricKey("___a")).toEqual("___a");
		expect(normalizeMetricKey("a___")).toEqual("a___");
		// TODO: from georg: expect(normalizeMetricKey("a$%@")).toEqual("a");
		// i expected:
		expect(normalizeMetricKey("a$%@")).toEqual("a_");
		// TODO: from georg: expect(normalizeMetricKey("a.b$%@.c")).toEqual("a.b.c");
		// i expected:
		expect(normalizeMetricKey("a.b$%@.c")).toEqual("a.b_.c");
		expect(normalizeMetricKey("a___b")).toEqual("a___b");
		expect(normalizeMetricKey("._._._a_._._.")).toEqual(null);
		expect(normalizeMetricKey("_._._.a_._")).toEqual("_._._.a_._");
		expect(normalizeMetricKey("an..empty.section")).toEqual("an.empty.section");
		expect(normalizeMetricKey("a,,,b  c=d\\e\\ =,f")).toEqual("a_b_c_d_e_f");
		expect(normalizeMetricKey("a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7")).toEqual("a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7");
		expect(normalizeMetricKey("a.b.+")).toEqual("a.b");
		expect(normalizeMetricKey("metric.key-number-1.001")).toEqual("metric.key-number-1.001");
		expect(normalizeMetricKey("MyMetric")).toEqual("MyMetric");
		expect(normalizeMetricKey("0MyMetric")).toEqual("MyMetric");
		expect(normalizeMetricKey("mÄtric")).toEqual("m_tric");
		// TODO: from georg: expect(normalizeMetricKey("metriÄ")).toEqual("metri");
		// i expected:
		expect(normalizeMetricKey("metriÄ")).toEqual("metri_");
		expect(normalizeMetricKey("Ätric")).toEqual("tric");
		expect(normalizeMetricKey("meträääääÖÖÖc")).toEqual("metr_c");
		expect(normalizeMetricKey(Array(270).fill("a").join(""))).toEqual(Array(250).fill("a").join(""));
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
		expect(normalizeDimensionKey(".")).toEqual(null);
		expect(normalizeDimensionKey(".a")).toEqual("a");
		expect(normalizeDimensionKey("a.")).toEqual("a");
		expect(normalizeDimensionKey(".a.")).toEqual("a");
		expect(normalizeDimensionKey("_a")).toEqual("_a");
		expect(normalizeDimensionKey("a_")).toEqual("a_");
		expect(normalizeDimensionKey("_a_")).toEqual("_a_");
		expect(normalizeDimensionKey(".a_")).toEqual("a_");
		expect(normalizeDimensionKey("_a.")).toEqual("_a");
		expect(normalizeDimensionKey("._._a_._._")).toEqual("_._a_._._");
		expect(normalizeDimensionKey("test..empty.test")).toEqual("test.empty.test");
		expect(normalizeDimensionKey("a,,,b  c=d\\e\\ =,f")).toEqual("a_b_c_d_e_f");
		expect(normalizeDimensionKey("a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7")).toEqual("a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7");

		expect(normalizeDimensionKey("dim")).toEqual("dim");
		expect(normalizeDimensionKey("dim1")).toEqual("dim1");
		expect(normalizeDimensionKey("_dim")).toEqual("_dim");
		expect(normalizeDimensionKey("Dim")).toEqual("dim");
		expect(normalizeDimensionKey("dIm")).toEqual("dim");
		expect(normalizeDimensionKey("diM")).toEqual("dim");
		expect(normalizeDimensionKey("DIM")).toEqual("dim");
		expect(normalizeDimensionKey("dim:dim")).toEqual("dim:dim");
		expect(normalizeDimensionKey("dim_dim")).toEqual("dim_dim");
		expect(normalizeDimensionKey("dim-dim")).toEqual("dim-dim");
		expect(normalizeDimensionKey("-dim")).toEqual("dim");
		expect(normalizeDimensionKey("dim-")).toEqual("dim-");
		expect(normalizeDimensionKey("dim---")).toEqual("dim---");
		expect(normalizeDimensionKey("~0#dim")).toEqual("dim");
		expect(normalizeDimensionKey("---dim")).toEqual("dim");
		expect(normalizeDimensionKey(":dim")).toEqual("dim");
		expect(normalizeDimensionKey("~@#ä")).toEqual(null);
		expect(normalizeDimensionKey("aaa~@#ä")).toEqual("aaa");
		expect(normalizeDimensionKey("aaa___")).toEqual("aaa___");
		expect(normalizeDimensionKey("000")).toEqual(null);
		expect(normalizeDimensionKey("dim1.value1")).toEqual("dim1.value1");
		expect(normalizeDimensionKey("dim.0dim")).toEqual("dim.dim");
		expect(normalizeDimensionKey("dim.000")).toEqual("dim");
		expect(normalizeDimensionKey("dim.~val")).toEqual("dim.val");
		expect(normalizeDimensionKey("dim.val~~")).toEqual("dim.val");
		expect(normalizeDimensionKey("dim.~~~")).toEqual("dim");
		expect(normalizeDimensionKey("dim._val")).toEqual("dim._val");
		expect(normalizeDimensionKey("dim.___")).toEqual("dim.___");
		expect(normalizeDimensionKey("dim.dim.dim.dim")).toEqual("dim.dim.dim.dim");
		expect(normalizeDimensionKey("a..b")).toEqual("a.b");
		expect(normalizeDimensionKey("a.....b")).toEqual("a.b");
		expect(normalizeDimensionKey(".a")).toEqual("a");
		expect(normalizeDimensionKey("a.b:c.d")).toEqual("a.b:c.d");
		expect(normalizeDimensionKey("a.")).toEqual("a");
		expect(normalizeDimensionKey(".")).toEqual(null);
		expect(normalizeDimensionKey("a...")).toEqual("a");
		expect(normalizeDimensionKey(".a.")).toEqual("a");
		expect(normalizeDimensionKey("   a")).toEqual("a");
		expect(normalizeDimensionKey("a   ")).toEqual("a");
		expect(normalizeDimensionKey("a b")).toEqual("a_b");
		expect(normalizeDimensionKey("a    b")).toEqual("a_b");
		expect(normalizeDimensionKey("")).toEqual(null);
		expect(normalizeDimensionKey("dim.val:count.val001")).toEqual("dim.val:count.val001");
		expect(normalizeDimensionKey("a,,,b  c=d\\e\\ =,f")).toEqual("a_b_c_d_e_f");
		expect(normalizeDimensionKey("a!b\"c#d$e%f&g'h(i)j*k+l,m-n.o/p:q;r<s=t>u?v@w[x]y\\z^0 1_2;3{4|5}6~7")).toEqual("a_b_c_d_e_f_g_h_i_j_k_l_m-n.o_p:q_r_s_t_u_v_w_x_y_z_0_1_2_3_4_5_6_7");
		expect(normalizeDimensionKey("Tag")).toEqual("tag");
		expect(normalizeDimensionKey("0Tag")).toEqual("tag");
		expect(normalizeDimensionKey("tÄg")).toEqual("t_g");
		expect(normalizeDimensionKey("mytäääg")).toEqual("myt_g");
		expect(normalizeDimensionKey("ääätag")).toEqual("tag");
		expect(normalizeDimensionKey("ä_ätag")).toEqual("__tag");
		expect(normalizeDimensionKey("Bla___")).toEqual("bla___");
		expect(normalizeDimensionKey(Array(120).fill("a").join(""))).toEqual(Array(100).fill("a").join(""));
	});

	it("should normalize dimension values", () => {
		expect(normalizeDimensionValue("value")).toEqual("value");
		expect(normalizeDimensionValue("")).toEqual(null);
		expect(normalizeDimensionValue("VALUE")).toEqual("VALUE");
		expect(normalizeDimensionValue("a:3")).toEqual("a:3");
		expect(normalizeDimensionValue("~@#ä")).toEqual("~@#ä");
		expect(normalizeDimensionValue("a b")).toEqual("a\\ b");
		expect(normalizeDimensionValue("a,b")).toEqual("a\\,b");
		expect(normalizeDimensionValue("a=b")).toEqual("a\\=b");
		expect(normalizeDimensionValue("a\\b")).toEqual("a\\\\b");
		expect(normalizeDimensionValue(" ,=\\")).toEqual("\\ \\,\\=\\\\");
		expect(normalizeDimensionValue("\"\\ \"\"")).toEqual("\\\"\\\\\\ \\\"\\\"");
		expect(normalizeDimensionValue("key=\"value\"")).toEqual("key\\=\\\"value\\\"");
		expect(normalizeDimensionValue("\u0000a\u0007")).toEqual("a");
		expect(normalizeDimensionValue("\u0000\u0007")).toEqual(null);
		expect(normalizeDimensionValue("a\u0001b")).toEqual("a_b");
		expect(normalizeDimensionValue("a\u0001\u0001\u0001b")).toEqual("a_b");
		expect(normalizeDimensionValue("\u0034\u0066")).toEqual("\u0034\u0066");
		expect(normalizeDimensionValue("\u0132_\u0133_\u0150_\u0156")).toEqual("\u0132_\u0133_\u0150_\u0156");
		expect(normalizeDimensionValue("\u0000a")).toEqual("a");
		expect(normalizeDimensionValue("\u0000\u0000\u0000a")).toEqual("a");
		expect(normalizeDimensionValue("a\u0000")).toEqual("a");
		expect(normalizeDimensionValue("a\u0000\u0000\u0000")).toEqual("a");
		expect(normalizeDimensionValue("a\u0000b")).toEqual("a_b");
		expect(normalizeDimensionValue("a\u0000\u0000\u0000b")).toEqual("a_b");
		expect(normalizeDimensionValue(Array(270).fill("a").join(""))).toEqual(Array(250).fill("a").join(""));
		expect(normalizeDimensionValue(Array(270).fill("=").join(""))).toEqual(Array(125).fill("\\=").join(""));
	});
});
