const CHAINS = {
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    rpc: ["https://ethereum-rpc.publicnode.com", "https://cloudflare-eth.com", "https://eth.llamarpc.com"],
    explorer: "https://etherscan.io/address/"
  },
  bsc: {
    name: "BNB Smart Chain",
    symbol: "BNB",
    decimals: 18,
    rpc: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org", "https://1rpc.io/bnb"],
    explorer: "https://bscscan.com/address/"
  },
  polygon: {
    name: "Polygon",
    symbol: "POL",
    decimals: 18,
    rpc: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com", "https://polygon.drpc.org"],
    explorer: "https://polygonscan.com/address/"
  },
  arbitrum: {
    name: "Arbitrum One",
    symbol: "ETH",
    decimals: 18,
    rpc: ["https://arbitrum-one-rpc.publicnode.com", "https://arb1.arbitrum.io/rpc"],
    explorer: "https://arbiscan.io/address/"
  },
  base: {
    name: "Base",
    symbol: "ETH",
    decimals: 18,
    rpc: ["https://base-rpc.publicnode.com", "https://mainnet.base.org"],
    explorer: "https://basescan.org/address/"
  }
};

const $ = (selector) => document.querySelector(selector);
const form = $("#balance-form");
const submitButton = $("#submit-button");
const status = $("#status");
const resultCard = $("#result-card");
const nativeBalance = $("#native-balance");
const nativeUnit = $("#native-unit");
const nativeNote = $("#native-note");
const nativeState = $("#native-state");
const tokenBalance = $("#token-balance");
const tokenUnit = $("#token-unit");
const tokenNote = $("#token-note");
const tokenState = $("#token-state");
const tokenBalanceBox = $("#token-balance-box");

function setStatus(message, type = "") {
  status.textContent = message;
  status.className = "status" + (type ? " " + type : "");
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function shortAddress(value) {
  return value.slice(0, 8) + "…" + value.slice(-6);
}

function formatUnits(value, decimals, maxFraction = 8) {
  const raw = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, "0").slice(0, maxFraction).replace(/0+$/, "");
  return fraction ? whole.toString() + "." + fraction : whole.toString();
}

function hexToUtf8(hex) {
  try {
    const bytes = new Uint8Array((hex.slice(2).match(/.{1,2}/g) || []).map((part) => parseInt(part, 16)));
    return new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

function padAddress(address) {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

async function rpcCall(chain, method, params) {
  let lastError = new Error("RPC request failed");
  for (const endpoint of chain.rpc) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error((data.error && data.error.message) || ("HTTP " + response.status));
      }
      return data.result;
    } catch (error) {
      lastError = error.name === "AbortError" ? new Error("RPC timeout") : error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function setState(element, hasBalance, label) {
  element.textContent = label;
  element.className = "state " + (hasBalance ? "has" : "zero");
}

async function readToken(chain, wallet, contract) {
  const balanceHex = await rpcCall(chain, "eth_call", [{ to: contract, data: "0x70a08231" + padAddress(wallet) }, "latest"]);
  const decimalsHex = await rpcCall(chain, "eth_call", [{ to: contract, data: "0x313ce567" }, "latest"]);
  const symbolHex = await rpcCall(chain, "eth_call", [{ to: contract, data: "0x95d89b41" }, "latest"]);
  const decimals = Number(BigInt(decimalsHex));
  const symbol = hexToUtf8(symbolHex) || "TOKEN";
  return { raw: BigInt(balanceHex), decimals, symbol };
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const wallet = $("#wallet").value.trim();
  const chain = CHAINS[$("#chain").value];
  const token = $("#token").value.trim();

  if (!isAddress(wallet)) {
    resultCard.classList.remove("visible");
    setStatus("请输入有效的 EVM 钱包地址（0x 开头，共 42 个字符）。", "error");
    $("#wallet").focus();
    return;
  }
  if (token && !isAddress(token)) {
    resultCard.classList.remove("visible");
    setStatus("Token 合约地址格式不正确。", "error");
    $("#token").focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "查询中…";
  resultCard.classList.remove("visible");
  setStatus("正在读取 " + chain.name + " 链上数据…");

  try {
    const rawNative = await rpcCall(chain, "eth_getBalance", [wallet, "latest"]);
    const native = formatUnits(rawNative, chain.decimals);
    $("#result-chain").textContent = chain.name;
    $("#result-address").textContent = wallet;
    $("#checked-at").textContent = "刚刚 · " + new Date().toLocaleString();
    nativeBalance.textContent = native;
    nativeUnit.textContent = chain.symbol;
    nativeNote.textContent = "原生币余额 · " + rawNative;
    setState(nativeState, BigInt(rawNative) > 0n, BigInt(rawNative) > 0n ? "有原生币余额" : "原生币余额为 0");

    if (token) {
      const tokenData = await readToken(chain, wallet, token);
      const tokenRaw = tokenData.raw;
      tokenBalance.textContent = formatUnits(tokenRaw, tokenData.decimals);
      tokenUnit.textContent = tokenData.symbol;
      tokenNote.textContent = "ERC‑20 合约 · " + shortAddress(token);
      setState(tokenState, tokenRaw > 0n, tokenRaw > 0n ? "有代币余额" : "代币余额为 0");
      tokenBalanceBox.style.display = "";
    } else {
      tokenBalanceBox.style.display = "none";
    }

    resultCard.classList.add("visible");
    setStatus("查询完成。数据来自公开只读 RPC，不会发起任何交易。", "success");
  } catch (error) {
    resultCard.classList.remove("visible");
    const detail = (error && error.message) || "未知网络错误";
    setStatus("查询失败：" + detail + "。请稍后重试，或更换网络节点。", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "查询余额";
  }
});

$("#wallet").addEventListener("input", () => {
  if (status.classList.contains("error")) setStatus("");
});

