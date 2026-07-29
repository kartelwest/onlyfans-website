import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isProxyCompany,
  isValidProxyIp,
} from "../lib/models/proxyDetails";

import {
  COUNTRY_CODES,
  getCountryName,
  isCountryCode,
  listCountries,
} from "../lib/countries";

describe("isValidProxyIp", () => {
  it("accepts IPv4 addresses, with or without a port", () => {
    assert.equal(isValidProxyIp("48.45.165.230"), true);
    assert.equal(isValidProxyIp("48.45.165.230:8080"), true);
    assert.equal(isValidProxyIp("0.0.0.0"), true);
    assert.equal(isValidProxyIp("255.255.255.255"), true);
  });

  it("rejects malformed addresses and out-of-range ports", () => {
    assert.equal(isValidProxyIp("48.45.165"), false);
    assert.equal(isValidProxyIp("256.45.165.230"), false);
    assert.equal(isValidProxyIp("48.45.165.230:0"), false);
    assert.equal(isValidProxyIp("48.45.165.230:70000"), false);
    assert.equal(isValidProxyIp("proxy.example.com"), false);
    assert.equal(isValidProxyIp(""), false);
  });
});

describe("isProxyCompany", () => {
  it("only accepts the two supported companies", () => {
    assert.equal(isProxyCompany("proxy_empire"), true);
    assert.equal(isProxyCompany("other"), true);
    assert.equal(isProxyCompany("Proxy Empire"), false);
    assert.equal(isProxyCompany(""), false);
  });
});

describe("countries", () => {
  it("lists every ISO 3166-1 alpha-2 country exactly once", () => {
    const countries = listCountries();

    assert.equal(countries.length, COUNTRY_CODES.length);
    assert.equal(new Set(COUNTRY_CODES).size, COUNTRY_CODES.length);
  });

  it("resolves every code to a localized name", () => {
    for (const { code, name } of listCountries()) {
      assert.notEqual(name, code, `missing localized name for ${code}`);
    }
  });

  it("sorts names alphabetically in pt-BR", () => {
    const names = listCountries().map((country) => country.name);

    const sorted = [...names].sort((first, second) =>
      first.localeCompare(second, "pt-BR", { sensitivity: "base" }),
    );

    assert.deepEqual(names, sorted);
  });

  it("validates and translates codes", () => {
    assert.equal(isCountryCode("BR"), true);
    assert.equal(isCountryCode("XX"), false);
    assert.equal(getCountryName("BR"), "Brasil");
    assert.equal(getCountryName(null), null);
  });
});
