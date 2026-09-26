export type SnippetLanguage = 'python' | 'typescript';

export type SnippetCategory = 'Quant' | 'Trading' | 'Crypto' | 'ML' | 'Data' | 'Python' | 'Testing';

/** Display order of the categories, e.g. for filter chips. */
export const SNIPPET_CATEGORIES: readonly SnippetCategory[] = [
	'Quant',
	'Trading',
	'Crypto',
	'ML',
	'Data',
	'Python',
	'Testing',
];

export interface Snippet {
	/** Unique kebab-case id. */
	id: string;
	/** Trigger text, unique per language. */
	prefix: string;
	name: string;
	description: string;
	language: SnippetLanguage;
	category: SnippetCategory;
	/** Monaco/VS Code snippet syntax: ${1:placeholder}, ${2|a,b|}, $0. Tabs for indentation. */
	body: string;
}

/**
 * Bodies are written as raw template literals so Python backslashes stay literal and code reads
 * naturally. Inside them a snippet placeholder is written `\${1:x}` (the backslash only stops JS
 * interpolation and is stripped here) and a backtick is written as an escaped backtick.
 */
function code(strings: TemplateStringsArray, ...values: string[]): string {
	let out = '';
	strings.raw.forEach((part, i) => {
		out += part.replace(/\\\$\{/g, '${').replace(/\\`/g, '`') + (values[i] ?? '');
	});
	return out.replace(/^\n/, '').replace(/\n$/, '');
}

/** Snippet-syntax escape for a literal `$` (e.g. inside a JS template literal in a body). */
const DOLLAR = '\\$';

const QUANT: readonly Snippet[] = [
	{
		id: 'py-returns',
		prefix: 'returns',
		name: 'Simple and log returns',
		description: 'Periodic simple (pct_change) and log returns from a price series',
		language: 'python',
		category: 'Quant',
		body: code`
import numpy as np
import pandas as pd


def simple_returns(prices: pd.Series) -> pd.Series:
	return prices.pct_change().dropna()


def log_returns(prices: pd.Series) -> pd.Series:
	return np.log(prices / prices.shift(1)).dropna()


rets = \${1|simple_returns,log_returns|}(\${2:df['close']})
$0`,
	},
	{
		id: 'py-sharpe',
		prefix: 'sharpe',
		name: 'Annualised Sharpe ratio',
		description: 'Sharpe ratio of periodic returns with a periods-per-year parameter',
		language: 'python',
		category: 'Quant',
		body: code`
import numpy as np
import pandas as pd


def sharpe_ratio(
	returns: pd.Series, risk_free: float = \${1:0.0}, periods_per_year: int = \${2|252,365,52,12|}
) -> float:
	"""Annualised Sharpe of periodic simple returns; risk_free is an annual rate."""
	excess = returns.dropna() - risk_free / periods_per_year
	std = excess.std(ddof=1)
	if not std or np.isnan(std):
		return float('nan')
	return float(np.sqrt(periods_per_year) * excess.mean() / std)
$0`,
	},
	{
		id: 'py-sortino',
		prefix: 'sortino',
		name: 'Annualised Sortino ratio',
		description: 'Sortino ratio using downside deviation below a target return',
		language: 'python',
		category: 'Quant',
		body: code`
import numpy as np
import pandas as pd


def sortino_ratio(
	returns: pd.Series, target: float = \${1:0.0}, periods_per_year: int = \${2|252,365,52,12|}
) -> float:
	"""Annualised Sortino; target is an annual rate, downside deviation spans all periods."""
	excess = returns.dropna() - target / periods_per_year
	downside = np.minimum(excess, 0.0)
	downside_dev = np.sqrt((downside**2).mean())
	if downside_dev == 0:
		return float('nan')
	return float(np.sqrt(periods_per_year) * excess.mean() / downside_dev)
$0`,
	},
	{
		id: 'py-max-drawdown',
		prefix: 'maxdd',
		name: 'Max drawdown with drawdown series',
		description:
			'Drawdown series from the running peak plus max drawdown, peak and trough dates',
		language: 'python',
		category: 'Quant',
		body: code`
import pandas as pd


def drawdown_series(equity: pd.Series) -> pd.Series:
	"""Fractional drawdown from the running peak: 0 at new highs, negative below."""
	return equity / equity.cummax() - 1.0


def max_drawdown(equity: pd.Series) -> tuple[float, object, object]:
	"""Returns (max drawdown, peak label, trough label)."""
	dd = drawdown_series(equity)
	trough = dd.idxmin()
	peak = equity.loc[:trough].idxmax()
	return float(dd.min()), peak, trough


mdd, peak, trough = max_drawdown(\${1:equity})
$0`,
	},
	{
		id: 'py-cagr',
		prefix: 'cagr',
		name: 'CAGR from equity curve',
		description: 'Compound annual growth rate of an equity curve sampled at a fixed frequency',
		language: 'python',
		category: 'Quant',
		body: code`
import pandas as pd


def cagr(equity: pd.Series, periods_per_year: int = \${1|252,365,52,12|}) -> float:
	n_periods = len(equity) - 1
	if n_periods <= 0 or equity.iloc[0] <= 0:
		return float('nan')
	years = n_periods / periods_per_year
	return float((equity.iloc[-1] / equity.iloc[0]) ** (1 / years) - 1)
$0`,
	},
	{
		id: 'py-calmar',
		prefix: 'calmar',
		name: 'Calmar ratio',
		description: 'CAGR divided by absolute max drawdown',
		language: 'python',
		category: 'Quant',
		body: code`
import pandas as pd


def calmar_ratio(equity: pd.Series, periods_per_year: int = \${1|252,365,52,12|}) -> float:
	n_periods = len(equity) - 1
	if n_periods <= 0 or equity.iloc[0] <= 0:
		return float('nan')
	growth = (equity.iloc[-1] / equity.iloc[0]) ** (periods_per_year / n_periods) - 1
	max_dd = (equity / equity.cummax() - 1.0).min()
	if max_dd == 0:
		return float('nan')
	return float(growth / abs(max_dd))
$0`,
	},
	{
		id: 'py-rolling-vol',
		prefix: 'rollvol',
		name: 'Rolling volatility (annualised)',
		description: 'Annualised rolling standard deviation of returns',
		language: 'python',
		category: 'Quant',
		body: code`
import numpy as np
import pandas as pd


def rolling_volatility(
	returns: pd.Series, window: int = \${1:21}, periods_per_year: int = \${2|252,365,52,12|}
) -> pd.Series:
	return returns.rolling(window, min_periods=window).std(ddof=1) * np.sqrt(periods_per_year)
$0`,
	},
	{
		id: 'py-beta',
		prefix: 'beta',
		name: 'Beta vs benchmark',
		description: 'Full-sample OLS beta and rolling beta of returns against a benchmark',
		language: 'python',
		category: 'Quant',
		body: code`
import pandas as pd


def beta(returns: pd.Series, benchmark: pd.Series) -> float:
	"""OLS beta over the dates both series share."""
	aligned = pd.concat([returns, benchmark], axis=1, join='inner').dropna()
	r, b = aligned.iloc[:, 0], aligned.iloc[:, 1]
	var_b = b.var(ddof=1)
	if var_b == 0:
		return float('nan')
	return float(r.cov(b) / var_b)


def rolling_beta(returns: pd.Series, benchmark: pd.Series, window: int = \${1:63}) -> pd.Series:
	return returns.rolling(window).cov(benchmark) / benchmark.rolling(window).var()
$0`,
	},
	{
		id: 'py-var-cvar',
		prefix: 'var',
		name: 'Historical VaR and CVaR',
		description:
			'One-period historical value-at-risk and expected shortfall as positive losses',
		language: 'python',
		category: 'Quant',
		body: code`
import numpy as np
import pandas as pd


def historical_var_cvar(returns: pd.Series, alpha: float = \${1:0.95}) -> tuple[float, float]:
	"""Returns (VaR, CVaR) as positive loss fractions at the given confidence level."""
	r = returns.dropna().to_numpy()
	cutoff = np.quantile(r, 1 - alpha)
	tail = r[r <= cutoff]
	return float(-cutoff), float(-tail.mean())
$0`,
	},
	{
		id: 'py-kelly',
		prefix: 'kelly',
		name: 'Kelly fraction',
		description: 'Discrete Kelly bet size and continuous Kelly leverage from returns',
		language: 'python',
		category: 'Quant',
		body: code`
import pandas as pd


def kelly_fraction(win_prob: float, win_loss_ratio: float) -> float:
	"""f* = p - (1 - p) / b for a bet that wins b per 1 risked."""
	if win_loss_ratio <= 0:
		raise ValueError('win_loss_ratio must be positive')
	return win_prob - (1 - win_prob) / win_loss_ratio


def kelly_leverage(excess_returns: pd.Series) -> float:
	"""Continuous-time Kelly leverage mu / sigma^2 from periodic excess returns."""
	var = excess_returns.var(ddof=1)
	return float(excess_returns.mean() / var) if var > 0 else float('nan')


# Full Kelly is very aggressive with estimated inputs; a fraction of it is the usual choice.
f = \${1:0.5} * kelly_fraction(\${2:0.55}, \${3:1.0})
$0`,
	},
	{
		id: 'py-black-scholes',
		prefix: 'bs',
		name: 'Black-Scholes price and greeks',
		description: 'European option price, delta, gamma, vega, theta, rho with dividend yield',
		language: 'python',
		category: 'Quant',
		body: code`
import math
from dataclasses import dataclass


def _norm_cdf(x: float) -> float:
	return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x: float) -> float:
	return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


@dataclass(frozen=True)
class Greeks:
	price: float
	delta: float
	gamma: float
	vega: float  # per 1.00 (100 vol points) change in volatility
	theta: float  # per year
	rho: float  # per 1.00 change in the rate


def black_scholes(
	spot: float,
	strike: float,
	t: float,
	rate: float,
	vol: float,
	call: bool = True,
	div: float = 0.0,
) -> Greeks:
	"""Black-Scholes-Merton with continuous dividend yield; t in years, rates annualised."""
	if t <= 0 or vol <= 0:
		raise ValueError('t and vol must be positive')
	sqrt_t = math.sqrt(t)
	d1 = (math.log(spot / strike) + (rate - div + 0.5 * vol * vol) * t) / (vol * sqrt_t)
	d2 = d1 - vol * sqrt_t
	df_r = math.exp(-rate * t)
	df_q = math.exp(-div * t)
	pdf_d1 = _norm_pdf(d1)
	gamma = df_q * pdf_d1 / (spot * vol * sqrt_t)
	vega = spot * df_q * pdf_d1 * sqrt_t
	decay = -spot * df_q * pdf_d1 * vol / (2 * sqrt_t)
	if call:
		price = spot * df_q * _norm_cdf(d1) - strike * df_r * _norm_cdf(d2)
		delta = df_q * _norm_cdf(d1)
		theta = decay - rate * strike * df_r * _norm_cdf(d2) + div * spot * df_q * _norm_cdf(d1)
		rho = strike * t * df_r * _norm_cdf(d2)
	else:
		price = strike * df_r * _norm_cdf(-d2) - spot * df_q * _norm_cdf(-d1)
		delta = -df_q * _norm_cdf(-d1)
		theta = decay + rate * strike * df_r * _norm_cdf(-d2) - div * spot * df_q * _norm_cdf(-d1)
		rho = -strike * t * df_r * _norm_cdf(-d2)
	return Greeks(price, delta, gamma, vega, theta, rho)
$0`,
	},
	{
		id: 'py-implied-vol',
		prefix: 'iv',
		name: 'Implied volatility (Newton + bisection)',
		description: 'Solve Black-Scholes implied vol with Newton steps and a bisection fallback',
		language: 'python',
		category: 'Quant',
		body: code`
import math


def _norm_cdf(x: float) -> float:
	return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _bs_price_vega(
	spot: float, strike: float, t: float, rate: float, vol: float, call: bool
) -> tuple[float, float]:
	sqrt_t = math.sqrt(t)
	d1 = (math.log(spot / strike) + (rate + 0.5 * vol * vol) * t) / (vol * sqrt_t)
	d2 = d1 - vol * sqrt_t
	disc = math.exp(-rate * t)
	if call:
		price = spot * _norm_cdf(d1) - strike * disc * _norm_cdf(d2)
	else:
		price = strike * disc * _norm_cdf(-d2) - spot * _norm_cdf(-d1)
	vega = spot * math.exp(-0.5 * d1 * d1) / math.sqrt(2.0 * math.pi) * sqrt_t
	return price, vega


def implied_vol(
	price: float,
	spot: float,
	strike: float,
	t: float,
	rate: float = 0.0,
	call: bool = True,
	tol: float = 1e-8,
	max_iter: int = 100,
) -> float:
	lo, hi = 1e-6, 5.0
	vol = 0.2
	for _ in range(max_iter):
		model, vega = _bs_price_vega(spot, strike, t, rate, vol, call)
		diff = model - price
		if abs(diff) < tol:
			return vol
		# Price rises with vol, so the sign of diff says which side of the root we are on.
		if diff > 0:
			hi = vol
		else:
			lo = vol
		newton = vol - diff / vega if vega > 1e-12 else -1.0
		vol = newton if lo < newton < hi else 0.5 * (lo + hi)
	raise RuntimeError('implied_vol did not converge; check the price is within no-arbitrage bounds')


iv = implied_vol(\${1:price}, \${2:spot}, \${3:strike}, \${4:t})
$0`,
	},
	{
		id: 'py-position-size',
		prefix: 'possize',
		name: 'Fixed-fractional position size',
		description: 'Units to trade so that hitting the stop loses a fixed % of equity',
		language: 'python',
		category: 'Quant',
		body: code`
import math


def fixed_fractional_size(
	equity: float,
	risk_pct: float,
	entry: float,
	stop: float,
	contract_size: float = 1.0,
	lot_step: float = \${1:0.001},
) -> float:
	"""risk_pct is in percent (1.0 = 1% of equity at risk); rounds down to the lot step."""
	risk_per_unit = abs(entry - stop) * contract_size
	if risk_per_unit == 0:
		raise ValueError('entry and stop must differ')
	units = equity * risk_pct / 100 / risk_per_unit
	return math.floor(units / lot_step) * lot_step


size = fixed_fractional_size(\${2:equity}, \${3:1.0}, \${4:entry}, \${5:stop})
$0`,
	},
];

const TRADING: readonly Snippet[] = [
	{
		id: 'py-vector-backtest',
		prefix: 'backtest',
		name: 'Vectorised backtest (no look-ahead)',
		description: 'Positions shifted one bar, turnover costs in bps, equity and summary stats',
		language: 'python',
		category: 'Trading',
		body: code`
import numpy as np
import pandas as pd


def backtest(
	close: pd.Series,
	signal: pd.Series,
	cost_bps: float = \${1:5.0},
	periods_per_year: int = \${2|252,365,8760|},
) -> tuple[pd.DataFrame, dict[str, float]]:
	"""The signal known at bar t's close is held over bar t+1, so it never sees its own return."""
	returns = close.pct_change().fillna(0.0)
	position = signal.reindex(close.index).shift(1).fillna(0.0)
	turnover = position.diff().abs().fillna(position.abs())
	costs = turnover * cost_bps / 10_000
	strategy = position * returns - costs
	equity = (1.0 + strategy).cumprod()
	frame = pd.DataFrame(
		{'position': position, 'returns': returns, 'costs': costs, 'strategy': strategy, 'equity': equity}
	)
	std = strategy.std(ddof=1)
	stats = {
		'total_return': float(equity.iloc[-1] - 1.0),
		'sharpe': float(np.sqrt(periods_per_year) * strategy.mean() / std) if std else float('nan'),
		'max_drawdown': float((equity / equity.cummax() - 1.0).min()),
		'turnover_per_year': float(turnover.mean() * periods_per_year),
	}
	return frame, stats


frame, stats = backtest(\${3:df['close']}, \${4:signal})
$0`,
	},
	{
		id: 'py-walk-forward',
		prefix: 'walkforward',
		name: 'Walk-forward splits',
		description: 'Rolling or expanding train/test windows that march forward in time',
		language: 'python',
		category: 'Trading',
		body: code`
from collections.abc import Iterator

import numpy as np


def walk_forward_splits(
	n: int,
	train_size: int,
	test_size: int,
	step: int | None = None,
	expanding: bool = False,
) -> Iterator[tuple[np.ndarray, np.ndarray]]:
	"""Yield (train_idx, test_idx); test windows never overlap when step == test_size."""
	step = step or test_size
	start = 0
	while start + train_size + test_size <= n:
		train_start = 0 if expanding else start
		train_idx = np.arange(train_start, start + train_size)
		test_idx = np.arange(start + train_size, start + train_size + test_size)
		yield train_idx, test_idx
		start += step


for fold, (train_idx, test_idx) in enumerate(
	walk_forward_splits(len(\${1:df}), train_size=\${2:500}, test_size=\${3:100})
):
	$0`,
	},
	{
		id: 'py-triple-barrier',
		prefix: 'triplebarrier',
		name: 'Triple-barrier labels',
		description:
			'Label bars +1/-1/0 by the first of take-profit, stop-loss or time barrier hit',
		language: 'python',
		category: 'Trading',
		body: code`
import numpy as np
import pandas as pd


def triple_barrier_labels(
	close: pd.Series,
	vol: pd.Series,
	pt_mult: float = \${1:2.0},
	sl_mult: float = \${2:2.0},
	max_holding: int = \${3:20},
) -> pd.DataFrame:
	"""Barriers are multiples of vol (e.g. rolling std of returns) measured at the entry bar.

	Labels are forward-looking by construction: use them as targets only, never as features.
	"""
	prices = close.to_numpy(dtype=float)
	vols = vol.reindex(close.index).to_numpy(dtype=float)
	n = len(prices)
	labels = np.full(n, np.nan)
	exit_idx = np.full(n, -1)
	rets = np.full(n, np.nan)
	for i in range(n - 1):
		if np.isnan(vols[i]):
			continue
		upper, lower = pt_mult * vols[i], -sl_mult * vols[i]
		end = min(i + max_holding, n - 1)
		path = prices[i + 1 : end + 1] / prices[i] - 1.0
		hit_up = np.flatnonzero(path >= upper)
		hit_dn = np.flatnonzero(path <= lower)
		first_up = hit_up[0] if hit_up.size else np.inf
		first_dn = hit_dn[0] if hit_dn.size else np.inf
		if first_up < first_dn:
			labels[i], j = 1, int(first_up)
		elif first_dn < first_up:
			labels[i], j = -1, int(first_dn)
		else:
			labels[i], j = 0, len(path) - 1
		exit_idx[i] = i + 1 + j
		rets[i] = path[j]
	return pd.DataFrame({'label': labels, 'exit_idx': exit_idx, 'ret': rets}, index=close.index)
$0`,
	},
	{
		id: 'py-resample-polars',
		prefix: 'resample-pl',
		name: 'Resample OHLCV (polars)',
		description: 'Aggregate OHLCV bars to a coarser timeframe with group_by_dynamic',
		language: 'python',
		category: 'Trading',
		body: code`
import polars as pl


def resample_ohlcv(df: pl.DataFrame, every: str = '\${1:1h}', ts: str = 'ts') -> pl.DataFrame:
	"""Left-labelled, left-closed bars; ts must be a datetime column."""
	return (
		df.sort(ts)
		.group_by_dynamic(ts, every=every, closed='left', label='left')
		.agg(
			pl.col('open').first(),
			pl.col('high').max(),
			pl.col('low').min(),
			pl.col('close').last(),
			pl.col('volume').sum(),
		)
	)
$0`,
	},
	{
		id: 'py-resample-pandas',
		prefix: 'resample-pd',
		name: 'Resample OHLCV (pandas)',
		description: 'Aggregate OHLCV bars on a DatetimeIndex, dropping empty periods',
		language: 'python',
		category: 'Trading',
		body: code`
import pandas as pd

OHLCV_AGG = {'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}


def resample_ohlcv(df: pd.DataFrame, rule: str = '\${1:1h}') -> pd.DataFrame:
	"""Left-labelled, left-closed bars; df needs a sorted DatetimeIndex."""
	bars = df.resample(rule, label='left', closed='left').agg(OHLCV_AGG)
	return bars.dropna(subset=['open'])
$0`,
	},
	{
		id: 'py-ccxt-ohlcv',
		prefix: 'ccxt',
		name: 'ccxt async OHLCV with pagination',
		description: 'Page through fetch_ohlcv (public, no API keys) into a pandas DataFrame',
		language: 'python',
		category: 'Trading',
		body: code`
import asyncio

import ccxt.async_support as ccxt
import pandas as pd


async def fetch_ohlcv_all(
	exchange_id: str, symbol: str, timeframe: str, since_ms: int, limit: int = 1000
) -> pd.DataFrame:
	"""Public market data only: pages forward from since_ms until no newer candles arrive."""
	exchange = getattr(ccxt, exchange_id)({'enableRateLimit': True})
	rows: list[list[float]] = []
	try:
		since = since_ms
		while True:
			batch = await exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=limit)
			if not batch:
				break
			rows.extend(batch)
			last_ts = int(batch[-1][0])
			if last_ts < since:
				break
			since = last_ts + 1
	finally:
		await exchange.close()
	df = pd.DataFrame(rows, columns=['ts', 'open', 'high', 'low', 'close', 'volume'])
	df = df.drop_duplicates('ts').sort_values('ts')
	df['ts'] = pd.to_datetime(df['ts'], unit='ms', utc=True)
	return df.set_index('ts')


if __name__ == '__main__':
	start = int(pd.Timestamp('\${4:2024-01-01}', tz='UTC').timestamp() * 1000)
	bars = asyncio.run(fetch_ohlcv_all('\${1:binance}', '\${2:BTC/USDT}', '\${3:1h}', start))
	print(bars.tail())
$0`,
	},
	{
		id: 'py-ws-ticker',
		prefix: 'wsticker',
		name: 'WebSocket ticker stream',
		description: 'Binance mini-ticker over websockets with reconnect and exponential backoff',
		language: 'python',
		category: 'Trading',
		body: code`
import asyncio
import json

import websockets


async def stream_ticker(symbol: str = '\${1:btcusdt}') -> None:
	url = f'wss://stream.binance.com:9443/ws/{symbol}@miniTicker'
	delay = 1.0
	while True:
		try:
			async with websockets.connect(url, ping_interval=20) as ws:
				delay = 1.0
				async for raw in ws:
					msg = json.loads(raw)
					print(msg['s'], msg['c'], msg['v'])
		except (websockets.ConnectionClosed, OSError) as exc:
			print(f'disconnected ({exc!r}); retrying in {delay:.0f}s')
			await asyncio.sleep(delay)
			delay = min(delay * 2, 60.0)


if __name__ == '__main__':
	asyncio.run(stream_ticker())
$0`,
	},
];

const CRYPTO: readonly Snippet[] = [
	{
		id: 'py-solana-balance',
		prefix: 'solbalance',
		name: 'Solana SOL balance (read-only)',
		description: 'getBalance for a public address over JSON-RPC with httpx',
		language: 'python',
		category: 'Crypto',
		body: code`
import asyncio

import httpx

LAMPORTS_PER_SOL = 1_000_000_000


async def get_sol_balance(
	address: str, rpc_url: str = '\${2:https://api.mainnet-beta.solana.com}'
) -> float:
	"""Read-only lookup by public address; nothing here touches keys or signs anything."""
	payload = {
		'jsonrpc': '2.0',
		'id': 1,
		'method': 'getBalance',
		'params': [address, {'commitment': 'confirmed'}],
	}
	async with httpx.AsyncClient(timeout=10) as client:
		resp = await client.post(rpc_url, json=payload)
		resp.raise_for_status()
		data = resp.json()
	if 'error' in data:
		raise RuntimeError(f"RPC error: {data['error']}")
	return data['result']['value'] / LAMPORTS_PER_SOL


print(asyncio.run(get_sol_balance('\${1:address}')))
$0`,
	},
	{
		id: 'py-solana-spl-balances',
		prefix: 'splbalances',
		name: 'Solana SPL token balances (read-only)',
		description: 'getTokenAccountsByOwner (jsonParsed) summed per mint for a public address',
		language: 'python',
		category: 'Crypto',
		body: code`
import httpx

TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'


async def get_spl_balances(
	owner: str, rpc_url: str = '\${1:https://api.mainnet-beta.solana.com}'
) -> dict[str, float]:
	"""Read-only: mint address -> UI amount for every SPL token account of a public address."""
	payload = {
		'jsonrpc': '2.0',
		'id': 1,
		'method': 'getTokenAccountsByOwner',
		'params': [owner, {'programId': TOKEN_PROGRAM_ID}, {'encoding': 'jsonParsed'}],
	}
	async with httpx.AsyncClient(timeout=15) as client:
		resp = await client.post(rpc_url, json=payload)
		resp.raise_for_status()
		data = resp.json()
	if 'error' in data:
		raise RuntimeError(f"RPC error: {data['error']}")
	balances: dict[str, float] = {}
	for account in data['result']['value']:
		info = account['account']['data']['parsed']['info']
		amount = float(info['tokenAmount']['uiAmountString'])
		balances[info['mint']] = balances.get(info['mint'], 0.0) + amount
	return balances
$0`,
	},
	{
		id: 'py-erc20-balance',
		prefix: 'erc20balance',
		name: 'ERC-20 balanceOf (read-only, web3.py)',
		description: 'Read-only eth_call of balanceOf/decimals/symbol for a public address',
		language: 'python',
		category: 'Crypto',
		body: code`
from decimal import Decimal

from web3 import Web3

ERC20_ABI = [
	{
		'name': 'balanceOf',
		'type': 'function',
		'stateMutability': 'view',
		'inputs': [{'name': 'owner', 'type': 'address'}],
		'outputs': [{'name': '', 'type': 'uint256'}],
	},
	{
		'name': 'decimals',
		'type': 'function',
		'stateMutability': 'view',
		'inputs': [],
		'outputs': [{'name': '', 'type': 'uint8'}],
	},
	{
		'name': 'symbol',
		'type': 'function',
		'stateMutability': 'view',
		'inputs': [],
		'outputs': [{'name': '', 'type': 'string'}],
	},
]


def erc20_balance(rpc_url: str, token: str, owner: str) -> tuple[str, Decimal]:
	"""View calls only: no account, signer or transaction is involved."""
	w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))
	contract = w3.eth.contract(address=Web3.to_checksum_address(token), abi=ERC20_ABI)
	raw = contract.functions.balanceOf(Web3.to_checksum_address(owner)).call()
	decimals = contract.functions.decimals().call()
	symbol = contract.functions.symbol().call()
	return symbol, Decimal(raw) / (Decimal(10) ** decimals)


symbol, amount = erc20_balance('\${1:https://eth.llamarpc.com}', '\${2:token_address}', '\${3:owner}')
$0`,
	},
	{
		id: 'py-dexscreener-pairs',
		prefix: 'dexpairs',
		name: 'DexScreener pairs for a token',
		description: 'Public DexScreener API: all pairs for a token address, most liquid first',
		language: 'python',
		category: 'Crypto',
		body: code`
import httpx


async def dexscreener_pairs(token_address: str) -> list[dict[str, object]]:
	"""Public endpoint, rate-limited: cache results instead of polling in a tight loop."""
	url = f'https://api.dexscreener.com/latest/dex/tokens/{token_address}'
	async with httpx.AsyncClient(timeout=10) as client:
		resp = await client.get(url)
		resp.raise_for_status()
	pairs = resp.json().get('pairs') or []

	def liquidity(pair: dict[str, object]) -> float:
		liq = pair.get('liquidity') or {}
		return float(liq.get('usd') or 0) if isinstance(liq, dict) else 0.0

	return sorted(pairs, key=liquidity, reverse=True)
$0`,
	},
];

const ML: readonly Snippet[] = [
	{
		id: 'py-torch-train-loop',
		prefix: 'trainloop',
		name: 'PyTorch train/val loop',
		description: 'Epoch loop with train and no-grad evaluation, gradient clipping and logging',
		language: 'python',
		category: 'ML',
		body: code`
import torch
from torch import nn
from torch.utils.data import DataLoader


def train_one_epoch(
	model: nn.Module,
	loader: DataLoader,
	optimizer: torch.optim.Optimizer,
	loss_fn: nn.Module,
	device: torch.device,
	max_grad_norm: float = 1.0,
) -> float:
	model.train()
	total, count = 0.0, 0
	for x, y in loader:
		x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
		optimizer.zero_grad(set_to_none=True)
		loss = loss_fn(model(x), y)
		loss.backward()
		nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
		optimizer.step()
		total += loss.item() * x.size(0)
		count += x.size(0)
	return total / max(count, 1)


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader, loss_fn: nn.Module, device: torch.device) -> float:
	model.eval()
	total, count = 0.0, 0
	for x, y in loader:
		x, y = x.to(device), y.to(device)
		total += loss_fn(model(x), y).item() * x.size(0)
		count += x.size(0)
	return total / max(count, 1)


optimizer = torch.optim.AdamW(model.parameters(), lr=\${1:1e-3}, weight_decay=\${2:1e-2})
loss_fn = \${3:nn.MSELoss()}
for epoch in range(1, \${4:50} + 1):
	train_loss = train_one_epoch(model, train_loader, optimizer, loss_fn, device)
	val_loss = evaluate(model, val_loader, loss_fn, device)
	print(f'epoch {epoch:03d}  train {train_loss:.5f}  val {val_loss:.5f}')
	$0`,
	},
	{
		id: 'py-torch-dataset',
		prefix: 'dataset',
		name: 'PyTorch Dataset + DataLoader',
		description: 'Sliding-window time-series Dataset and its DataLoaders',
		language: 'python',
		category: 'ML',
		body: code`
import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset


class \${1:WindowDataset}(Dataset[tuple[torch.Tensor, torch.Tensor]]):
	"""Each item is (features[t - window : t], target[t])."""

	def __init__(self, features: np.ndarray, targets: np.ndarray, window: int) -> None:
		if len(features) != len(targets):
			raise ValueError('features and targets must have the same length')
		self.x = torch.as_tensor(features, dtype=torch.float32)
		self.y = torch.as_tensor(targets, dtype=torch.float32)
		self.window = window

	def __len__(self) -> int:
		return max(len(self.x) - self.window, 0)

	def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
		return self.x[idx : idx + self.window], self.y[idx + self.window]


# Time series: split by time before building datasets and never shuffle validation.
# On Windows, num_workers > 0 requires the if __name__ == '__main__' guard.
train_loader = DataLoader(
	\${1:WindowDataset}(x_train, y_train, window=\${2:64}),
	batch_size=\${3:256},
	shuffle=True,
	num_workers=0,
	pin_memory=torch.cuda.is_available(),
)
val_loader = DataLoader(\${1:WindowDataset}(x_val, y_val, window=\${2:64}), batch_size=\${3:256})
$0`,
	},
	{
		id: 'py-seed-everything',
		prefix: 'seed',
		name: 'Seed everything',
		description:
			'Seed random, NumPy and PyTorch (CPU + CUDA), optionally deterministic kernels',
		language: 'python',
		category: 'ML',
		body: code`
import os
import random

import numpy as np
import torch


def seed_everything(seed: int = \${1:42}, deterministic: bool = False) -> None:
	random.seed(seed)
	os.environ['PYTHONHASHSEED'] = str(seed)
	np.random.seed(seed)
	torch.manual_seed(seed)
	torch.cuda.manual_seed_all(seed)
	if deterministic:
		# Slower, but forces reproducible cuDNN/cuBLAS kernels.
		os.environ.setdefault('CUBLAS_WORKSPACE_CONFIG', ':4096:8')
		torch.backends.cudnn.deterministic = True
		torch.backends.cudnn.benchmark = False
		torch.use_deterministic_algorithms(True, warn_only=True)
$0`,
	},
	{
		id: 'py-torch-device',
		prefix: 'device',
		name: 'Pick torch device',
		description: 'Choose CUDA, then Apple MPS, then CPU',
		language: 'python',
		category: 'ML',
		body: code`
import torch


def pick_device() -> torch.device:
	if torch.cuda.is_available():
		return torch.device('cuda')
	if torch.backends.mps.is_available():
		return torch.device('mps')
	return torch.device('cpu')


device = pick_device()
$0`,
	},
	{
		id: 'py-early-stopping',
		prefix: 'earlystop',
		name: 'Early stopping class',
		description: 'Stop after N epochs without improvement and keep the best weights',
		language: 'python',
		category: 'ML',
		body: code`
import math

import torch


class EarlyStopping:
	def __init__(self, patience: int = \${1:10}, min_delta: float = 0.0, mode: str = '\${2|min,max|}') -> None:
		if mode not in ('min', 'max'):
			raise ValueError("mode must be 'min' or 'max'")
		self.patience = patience
		self.min_delta = min_delta
		self.sign = 1.0 if mode == 'min' else -1.0
		self.best = math.inf
		self.counter = 0
		self.best_state: dict[str, torch.Tensor] | None = None

	def step(self, metric: float, model: torch.nn.Module | None = None) -> bool:
		"""Record an epoch's metric; returns True when training should stop."""
		score = self.sign * metric
		if score < self.best - self.min_delta:
			self.best = score
			self.counter = 0
			if model is not None:
				self.best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
		else:
			self.counter += 1
		return self.counter >= self.patience

	def restore(self, model: torch.nn.Module) -> None:
		if self.best_state is not None:
			model.load_state_dict(self.best_state)
$0`,
	},
	{
		id: 'py-sklearn-pipeline',
		prefix: 'skpipe',
		name: 'sklearn Pipeline + ColumnTransformer',
		description: 'Impute/scale numeric, impute/one-hot categorical, then a model',
		language: 'python',
		category: 'ML',
		body: code`
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

numeric_features = [\${1:'feature_a', 'feature_b'}]
categorical_features = [\${2:'sector'}]

numeric = Pipeline([('impute', SimpleImputer(strategy='median')), ('scale', StandardScaler())])
categorical = Pipeline(
	[
		('impute', SimpleImputer(strategy='most_frequent')),
		('onehot', OneHotEncoder(handle_unknown='ignore')),
	]
)
preprocess = ColumnTransformer(
	[('num', numeric, numeric_features), ('cat', categorical, categorical_features)]
)
model = Pipeline([('preprocess', preprocess), ('model', \${3:LogisticRegression(max_iter=1000)})])
model.fit(X_train, y_train)
$0`,
	},
	{
		id: 'py-lightgbm-tscv',
		prefix: 'lgbmcv',
		name: 'LightGBM with TimeSeriesSplit CV',
		description:
			'Forward-chaining CV; early stopping on the tail of each train fold, not the test',
		language: 'python',
		category: 'ML',
		body: code`
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import TimeSeriesSplit

PARAMS = {
	'objective': 'binary',
	'learning_rate': 0.05,
	'num_leaves': 31,
	'min_child_samples': 50,
	'subsample': 0.8,
	'subsample_freq': 1,
	'colsample_bytree': 0.8,
	'verbose': -1,
}


def cv_lightgbm(X: pd.DataFrame, y: pd.Series, n_splits: int = \${1:5}, gap: int = \${2:0}) -> list[float]:
	"""gap drops rows between train and test so overlapping labels cannot leak."""
	scores: list[float] = []
	for fold, (train_idx, test_idx) in enumerate(TimeSeriesSplit(n_splits=n_splits, gap=gap).split(X)):
		# Early-stop on the last 10% of the training fold so the test fold stays untouched.
		cut = int(len(train_idx) * 0.9)
		fit_idx, val_idx = train_idx[:cut], train_idx[cut:]
		model = lgb.LGBMClassifier(n_estimators=5000, **PARAMS)
		model.fit(
			X.iloc[fit_idx],
			y.iloc[fit_idx],
			eval_set=[(X.iloc[val_idx], y.iloc[val_idx])],
			callbacks=[lgb.early_stopping(100, verbose=False)],
		)
		proba = model.predict_proba(X.iloc[test_idx])[:, 1]
		score = roc_auc_score(y.iloc[test_idx], proba)
		scores.append(float(score))
		print(f'fold {fold}: auc={score:.4f} trees={model.best_iteration_}')
	print(f'mean auc {np.mean(scores):.4f} +/- {np.std(scores):.4f}')
	return scores
$0`,
	},
	{
		id: 'py-optuna-study',
		prefix: 'optuna',
		name: 'Optuna study',
		description: 'TPE sampler, median pruner and a resumable SQLite-backed study',
		language: 'python',
		category: 'ML',
		body: code`
import optuna


def objective(trial: optuna.Trial) -> float:
	params = {
		'learning_rate': trial.suggest_float('learning_rate', 1e-3, 0.3, log=True),
		'num_leaves': trial.suggest_int('num_leaves', 8, 256, log=True),
		'min_child_samples': trial.suggest_int('min_child_samples', 10, 200),
		'colsample_bytree': trial.suggest_float('colsample_bytree', 0.4, 1.0),
	}
	return \${1:evaluate(params)}


study = optuna.create_study(
	study_name='\${2:study}',
	storage='sqlite:///\${2:study}.db',
	load_if_exists=True,
	direction='\${3|maximize,minimize|}',
	sampler=optuna.samplers.TPESampler(seed=42),
	pruner=optuna.pruners.MedianPruner(n_warmup_steps=5),
)
study.optimize(objective, n_trials=\${4:100})
print(study.best_value, study.best_params)
$0`,
	},
	{
		id: 'py-purged-kfold',
		prefix: 'purgedkfold',
		name: 'Purged K-fold with embargo',
		description:
			'K-fold CV that purges overlapping labels and embargoes rows after each test fold',
		language: 'python',
		category: 'ML',
		body: code`
from collections.abc import Iterator

import numpy as np


class PurgedKFold:
	"""Lopez de Prado style CV for labels that span several bars.

	label_end[i] is the integer position at which sample i's label is fully known
	(e.g. the exit bar from triple-barrier labelling).
	"""

	def __init__(self, n_splits: int = \${1:5}, embargo_pct: float = \${2:0.01}) -> None:
		if n_splits < 2:
			raise ValueError('n_splits must be at least 2')
		self.n_splits = n_splits
		self.embargo_pct = embargo_pct

	def split(self, label_end: np.ndarray) -> Iterator[tuple[np.ndarray, np.ndarray]]:
		label_end = np.asarray(label_end)
		n = len(label_end)
		indices = np.arange(n)
		embargo = int(n * self.embargo_pct)
		for test_idx in np.array_split(indices, self.n_splits):
			start, stop = int(test_idx[0]), int(test_idx[-1])
			test_label_end = max(stop, int(label_end[test_idx].max()))
			# Purge: earlier samples whose label window reaches into the test span.
			before = indices[(indices < start) & (label_end < start)]
			# Embargo: later samples whose features were formed while test labels were live.
			after = indices[indices > test_label_end + embargo]
			yield np.concatenate([before, after]), test_idx
$0`,
	},
];

const DATA: readonly Snippet[] = [
	{
		id: 'py-polars-scan-parquet',
		prefix: 'scanparquet',
		name: 'Polars lazy scan_parquet pipeline',
		description: 'scan_parquet -> filter -> group_by -> collect with predicate pushdown',
		language: 'python',
		category: 'Data',
		body: code`
import polars as pl

daily = (
	pl.scan_parquet('\${1:data/*.parquet}')
	.filter(pl.col('\${2:symbol}') == '\${3:BTCUSDT}')
	.group_by(pl.col('ts').dt.truncate('\${4:1d}').alias('day'))
	.agg(
		pl.col('close').sort_by('ts').last().alias('close'),
		pl.col('volume').sum().alias('volume'),
		pl.len().alias('rows'),
	)
	.sort('day')
	.collect()
)
$0`,
	},
	{
		id: 'py-duckdb-parquet',
		prefix: 'duckdb',
		name: 'DuckDB query over Parquet',
		description:
			'SQL directly on Parquet files with a bound parameter, returned as a DataFrame',
		language: 'python',
		category: 'Data',
		body: code`
import duckdb

con = duckdb.connect()
result = con.execute(
	"""
	SELECT symbol, date_trunc('day', ts) AS day, arg_max(close, ts) AS close, sum(volume) AS volume
	FROM read_parquet('\${1:data/*.parquet}')
	WHERE ts >= ?
	GROUP BY ALL
	ORDER BY symbol, day
	""",
	['\${2:2024-01-01}'],
).\${3|pl,df|}()
$0`,
	},
	{
		id: 'py-pandas-read-csv',
		prefix: 'readcsv',
		name: 'pandas read_csv with dtypes and dates',
		description: 'Typed read_csv with parsed UTC timestamps as a sorted index',
		language: 'python',
		category: 'Data',
		body: code`
import pandas as pd

df = pd.read_csv(
	'\${1:data.csv}',
	dtype={'\${2:symbol}': 'category', 'volume': 'float64'},
	parse_dates=['\${3:timestamp}'],
)
df['\${3:timestamp}'] = pd.to_datetime(df['\${3:timestamp}'], utc=True)
df = df.set_index('\${3:timestamp}').sort_index()
$0`,
	},
	{
		id: 'py-equity-plot',
		prefix: 'equityplot',
		name: 'Equity curve + drawdown plot',
		description: 'Matplotlib equity curve with an underwater drawdown panel',
		language: 'python',
		category: 'Data',
		body: code`
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.ticker import PercentFormatter


def plot_equity(equity: pd.Series, title: str = '\${1:Equity curve}') -> None:
	drawdown = equity / equity.cummax() - 1.0
	fig, (ax_eq, ax_dd) = plt.subplots(
		2, 1, figsize=(12, 7), sharex=True, gridspec_kw={'height_ratios': [3, 1]}
	)
	ax_eq.plot(equity.index, equity.to_numpy(), lw=1.2)
	ax_eq.set_title(title)
	ax_eq.set_ylabel('Equity')
	ax_eq.grid(alpha=0.3)
	ax_dd.fill_between(drawdown.index, drawdown.to_numpy(), 0.0, color='tab:red', alpha=0.4)
	ax_dd.set_ylabel('Drawdown')
	ax_dd.yaxis.set_major_formatter(PercentFormatter(1.0))
	ax_dd.grid(alpha=0.3)
	fig.tight_layout()
	plt.show()
$0`,
	},
	{
		id: 'py-cell-template',
		prefix: 'cell',
		name: 'Interactive # %% cell template',
		description: 'Percent-format cells for running a .py file like a notebook',
		language: 'python',
		category: 'Data',
		body: code`
# %% [markdown]
# # \${1:Title}

# %%
import numpy as np
import pandas as pd
import polars as pl

# %%
$0`,
	},
];

const PYTHON: readonly Snippet[] = [
	{
		id: 'py-dataclass-config',
		prefix: 'config',
		name: 'Dataclass config',
		description: 'Frozen, slotted dataclass config with validation',
		language: 'python',
		category: 'Python',
		body: code`
from dataclasses import asdict, dataclass, field
from pathlib import Path


@dataclass(frozen=True, slots=True)
class \${1:Config}:
	data_dir: Path = Path('\${2:data}')
	symbols: tuple[str, ...] = ('BTCUSDT', 'ETHUSDT')
	lookback: int = 20
	seed: int = 42
	tags: list[str] = field(default_factory=list)

	def __post_init__(self) -> None:
		if self.lookback <= 0:
			raise ValueError('lookback must be positive')

	def to_dict(self) -> dict[str, object]:
		return asdict(self)
$0`,
	},
	{
		id: 'py-argparse-cli',
		prefix: 'argparse',
		name: 'argparse CLI',
		description: 'Standard-library CLI with a positional path, options and a main()',
		language: 'python',
		category: 'Python',
		body: code`
import argparse
import sys
from pathlib import Path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
	parser = argparse.ArgumentParser(description='\${1:Describe the script}')
	parser.add_argument('input', type=Path, help='input file')
	parser.add_argument('--start', default='2024-01-01', help='start date (YYYY-MM-DD)')
	parser.add_argument('--dry-run', action='store_true', help='do everything except write')
	parser.add_argument('-v', '--verbose', action='count', default=0)
	return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
	args = parse_args(argv)
	$0
	return 0


if __name__ == '__main__':
	sys.exit(main())`,
	},
	{
		id: 'py-typer-cli',
		prefix: 'typer',
		name: 'Typer CLI',
		description: 'Typer app with an annotated argument and options',
		language: 'python',
		category: 'Python',
		body: code`
from pathlib import Path
from typing import Annotated

import typer

app = typer.Typer(no_args_is_help=True)


@app.command()
def \${1:run}(
	input_path: Annotated[Path, typer.Argument(exists=True, dir_okay=False)],
	start: Annotated[str, typer.Option(help='Start date (YYYY-MM-DD)')] = '2024-01-01',
	dry_run: Annotated[bool, typer.Option('--dry-run')] = False,
) -> None:
	"""\${2:Describe the command.}"""
	$0


if __name__ == '__main__':
	app()`,
	},
	{
		id: 'py-logging-setup',
		prefix: 'logging',
		name: 'Logging setup',
		description: 'basicConfig with timestamped format, optional file handler, quiet HTTP libs',
		language: 'python',
		category: 'Python',
		body: code`
import logging
import sys


def setup_logging(level: int | str = logging.INFO, log_file: str | None = None) -> None:
	handlers: list[logging.Handler] = [logging.StreamHandler(sys.stderr)]
	if log_file:
		handlers.append(logging.FileHandler(log_file, encoding='utf-8'))
	logging.basicConfig(
		level=level,
		format='%(asctime)s %(levelname)-8s %(name)s: %(message)s',
		datefmt='%Y-%m-%d %H:%M:%S',
		handlers=handlers,
		force=True,
	)
	# HTTP clients log every request at INFO, which drowns out our own logs.
	for noisy in ('httpx', 'httpcore', 'urllib3'):
		logging.getLogger(noisy).setLevel(logging.WARNING)


log = logging.getLogger(__name__)
$0`,
	},
	{
		id: 'py-httpx-retry',
		prefix: 'httpxretry',
		name: 'Async httpx client with retries',
		description: 'GET JSON with exponential backoff + jitter, honouring Retry-After',
		language: 'python',
		category: 'Python',
		body: code`
import asyncio
import logging
import random

import httpx

log = logging.getLogger(__name__)
RETRY_STATUS = {429, 500, 502, 503, 504}


async def get_json(
	client: httpx.AsyncClient,
	url: str,
	params: dict[str, str] | None = None,
	retries: int = 5,
	base_delay: float = 0.5,
) -> object:
	for attempt in range(retries + 1):
		retry_after: str | None = None
		try:
			resp = await client.get(url, params=params)
			if resp.status_code not in RETRY_STATUS:
				resp.raise_for_status()
				return resp.json()
			retry_after = resp.headers.get('Retry-After')
			reason = f'HTTP {resp.status_code}'
		except httpx.TransportError as exc:
			reason = repr(exc)
		if attempt == retries:
			raise RuntimeError(f'{url} failed after {retries + 1} attempts: {reason}')
		if retry_after and retry_after.isdigit():
			delay = float(retry_after)
		else:
			delay = base_delay * 2**attempt
			delay += random.uniform(0, delay / 2)
		log.warning('retrying %s in %.1fs (%s)', url, delay, reason)
		await asyncio.sleep(delay)
	raise AssertionError('unreachable')


async def main() -> None:
	timeout = httpx.Timeout(10.0)
	async with httpx.AsyncClient(timeout=timeout, headers={'User-Agent': 'anvil'}) as client:
		data = await get_json(client, '\${1:https://api.example.com/data}')
		$0


if __name__ == '__main__':
	asyncio.run(main())`,
	},
	{
		id: 'py-main-guard',
		prefix: 'main',
		name: "if __name__ == '__main__'",
		description: 'main() returning an exit code behind the __main__ guard',
		language: 'python',
		category: 'Python',
		body: code`
import sys


def main() -> int:
	\${1:pass}
	return 0


if __name__ == '__main__':
	sys.exit(main())`,
	},
];

const TESTING: readonly Snippet[] = [
	{
		id: 'py-pytest-fixture-parametrize',
		prefix: 'pytest',
		name: 'pytest fixture + parametrize',
		description: 'Seeded synthetic price fixture and a parametrized test',
		language: 'python',
		category: 'Testing',
		body: code`
import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def prices() -> pd.Series:
	idx = pd.date_range('2024-01-01', periods=250, freq='B')
	rng = np.random.default_rng(0)
	return pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, len(idx)))), index=idx)


@pytest.mark.parametrize(
	('\${1:window}', 'expected'),
	[
		(\${2:5}, \${3:None}),
		(\${4:20}, \${5:None}),
	],
)
def test_\${6:name}(prices: pd.Series, \${1:window}: int, expected: object) -> None:
	$0`,
	},
	{
		id: 'py-pytest-approx-raises',
		prefix: 'pytest-approx',
		name: 'pytest approx + raises',
		description: 'Numeric assertion with tolerance and an expected-exception check',
		language: 'python',
		category: 'Testing',
		body: code`
import pytest


def test_\${1:name}() -> None:
	assert \${2:result} == pytest.approx(\${3:expected}, rel=\${4:1e-9})


def test_\${1:name}_rejects_bad_input() -> None:
	with pytest.raises(\${5:ValueError}, match='\${6:must be}'):
		$0`,
	},
];

const TYPESCRIPT: readonly Snippet[] = [
	{
		id: 'ts-zod-schema',
		prefix: 'zod',
		name: 'zod schema + inferred type',
		description: 'z.object schema with its inferred TypeScript type',
		language: 'typescript',
		category: 'Data',
		body: code`
import { z } from 'zod';

export const \${1:Thing}Schema = z.object({
	id: z.string().min(1),
	\${2:name}: z.string(),
	createdAt: z.coerce.date(),
});
export type \${1:Thing} = z.infer<typeof \${1:Thing}Schema>;
$0`,
	},
	{
		id: 'ts-fetch-json',
		prefix: 'fetchjson',
		name: 'Typed fetch with timeout and AbortController',
		description: 'fetch JSON with a timeout, caller cancellation and HTTP error handling',
		language: 'typescript',
		category: 'Data',
		body: code`
export async function fetchJson<T>(
	url: string,
	init: RequestInit = {},
	timeoutMs = 10_000,
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);
	init.signal?.addEventListener('abort', () => controller.abort(init.signal?.reason), {
		once: true,
	});
	try {
		const res = await fetch(url, { ...init, signal: controller.signal });
		if (!res.ok) throw new Error(\`HTTP ${DOLLAR}{res.status} for ${DOLLAR}{url}\`);
		return (await res.json()) as T;
	} finally {
		clearTimeout(timer);
	}
}
$0`,
	},
	{
		id: 'ts-ws-ticker',
		prefix: 'wsticker',
		name: 'WebSocket ticker with reconnect',
		description: 'Browser WebSocket price stream with exponential-backoff reconnect',
		language: 'typescript',
		category: 'Trading',
		body: code`
/** Streams last price for a Binance symbol; returns a function that stops the stream. */
export function streamTicker(symbol: string, onPrice: (price: number) => void): () => void {
	let ws: WebSocket | null = null;
	let delay = 1_000;
	let stopped = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	const connect = (): void => {
		ws = new WebSocket(\`wss://stream.binance.com:9443/ws/${DOLLAR}{symbol.toLowerCase()}@miniTicker\`);
		ws.onopen = () => {
			delay = 1_000;
		};
		ws.onmessage = (event: MessageEvent<string>) => {
			const msg = JSON.parse(event.data) as { c: string };
			onPrice(Number(msg.c));
		};
		ws.onclose = () => {
			if (stopped) return;
			timer = setTimeout(connect, delay);
			delay = Math.min(delay * 2, 60_000);
		};
	};
	connect();
	return () => {
		stopped = true;
		clearTimeout(timer);
		ws?.close();
	};
}

const stop = streamTicker('\${1:BTCUSDT}', (price) => {
	$0
});`,
	},
	{
		id: 'ts-use-effect-abort',
		prefix: 'useeffectabort',
		name: 'useEffect with AbortController',
		description: 'Load data in an effect and cancel it on unmount or dependency change',
		language: 'typescript',
		category: 'Data',
		body: code`
useEffect(() => {
	const controller = new AbortController();
	\${1:load}(controller.signal).then(\${2:setData}, (err: unknown) => {
		if (!controller.signal.aborted) \${3:setError}(err instanceof Error ? err.message : String(err));
	});
	return () => controller.abort();
}, [\${4}]);
$0`,
	},
	{
		id: 'ts-vitest-suite',
		prefix: 'describe',
		name: 'vitest test suite',
		description: 'describe/it block importing from vitest',
		language: 'typescript',
		category: 'Testing',
		body: code`
import { describe, expect, it } from 'vitest';

import { \${1:fn} } from './\${2:module}';

describe('\${1:fn}', () => {
	it('\${3:does the thing}', () => {
		expect(\${1:fn}(\${4})).toEqual(\${5});
	});
});
$0`,
	},
];

export const SNIPPETS: readonly Snippet[] = [
	...QUANT,
	...TRADING,
	...CRYPTO,
	...ML,
	...DATA,
	...PYTHON,
	...TESTING,
	...TYPESCRIPT,
];

// Editors report TSX as its own language id; the TS snippets apply there too.
const LANGUAGE_IDS: Record<string, SnippetLanguage> = {
	python: 'python',
	typescript: 'typescript',
	typescriptreact: 'typescript',
};

/** Every Monaco language id that has snippets, e.g. for registering completion providers. */
export const SNIPPET_LANGUAGE_IDS: readonly string[] = Object.keys(LANGUAGE_IDS);

/** Snippets for a Monaco language id; unknown languages get none. */
export function snippetsFor(language: string): Snippet[] {
	const lang = LANGUAGE_IDS[language];
	return lang ? SNIPPETS.filter((s) => s.language === lang) : [];
}

function rank(snippet: Snippet, query: string): number {
	const prefix = snippet.prefix.toLowerCase();
	// Typing a snippet's exact prefix is an unambiguous request for it.
	if (prefix === query) return 0;
	if (snippet.name.toLowerCase().includes(query)) return 1;
	if (prefix.startsWith(query)) return 2;
	if (prefix.includes(query)) return 3;
	return 4;
}

/**
 * Case-insensitive search over name, prefix, description and category. Every whitespace-separated
 * term must match somewhere; results are ordered exact prefix, name match, prefix match, other.
 */
export function searchSnippets(query: string): Snippet[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...SNIPPETS];
	const terms = q.split(/\s+/);
	return SNIPPETS.map((snippet, index) => ({ snippet, index }))
		.filter(({ snippet }) => {
			const haystack = [snippet.name, snippet.prefix, snippet.description, snippet.category]
				.join('\n')
				.toLowerCase();
			return terms.every((term) => haystack.includes(term));
		})
		.map((entry) => ({ ...entry, rank: rank(entry.snippet, q) }))
		.sort((a, b) => a.rank - b.rank || a.index - b.index)
		.map(({ snippet }) => snippet);
}
