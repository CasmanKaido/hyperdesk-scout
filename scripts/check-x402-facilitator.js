import { OKXFacilitatorClient } from "@okxweb3/x402-core";

const apiKey = process.env.OKX_API_KEY;
const secretKey = process.env.OKX_SECRET_KEY;
const passphrase = process.env.OKX_API_PASSPHRASE;
const baseUrl = process.env.X402_FACILITATOR_URL || "https://web3.okx.com";
const network = process.env.X402_NETWORK || "eip155:1952";
const scheme = "exact";

if (!apiKey || !secretKey || !passphrase) {
  console.error(JSON.stringify({
    ok: false,
    error: "missing_okx_facilitator_credentials",
    required: ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_API_PASSPHRASE"],
  }));
  process.exitCode = 1;
} else if (!/^https:\/\//.test(baseUrl)) {
  console.error(JSON.stringify({ ok: false, error: "invalid_facilitator_url" }));
  process.exitCode = 1;
} else {
  const client = new OKXFacilitatorClient({ apiKey, secretKey, passphrase, baseUrl, syncSettle: true });
  try {
    const response = await client.getSupported();
    const kinds = Array.isArray(response?.kinds) ? response.kinds : [];
    const matches = kinds.filter((kind) => (
      kind?.x402Version === 2 && kind?.scheme === scheme && kind?.network === network
    ));
    const supported = matches.length > 0;
    console.log(JSON.stringify({
      ok: supported,
      expected: { x402Version: 2, scheme, network },
      matching_kinds: matches,
      advertised_kind_count: kinds.length,
    }, null, 2));
    if (!supported) process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: "facilitator_supported_check_failed",
      error_type: error?.name || "Error",
    }));
    process.exitCode = 1;
  }
}
