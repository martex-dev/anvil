// Built-in "New project from template" catalog: uv Python projects for quant, ML and trading.

export interface TemplateDef {
	id: string;
	name: string;
	description: string;
	tags: string[];
	/** relative path using '/' separators → file content. '{{name}}' is replaced by the project name. */
	files: Record<string, string>;
}

const PYTHON_VERSION = '3.12\n';

function gitignore(extra: string[] = []): string {
	const base = [
		'.venv/',
		'__pycache__/',
		'*.py[cod]',
		'.env',
		'.ruff_cache/',
		'.pytest_cache/',
		'.ipynb_checkpoints/',
		'build/',
		'dist/',
		'*.egg-info/',
	];
	return [...base, ...extra].join('\n') + '\n';
}

interface PyProjectOptions {
	description: string;
	/** Package folder under src/ (a fixed, importable name, independent of the project name). */
	pkg: string;
	deps: string[];
	devDeps?: string[];
	/** Extra TOML appended after [project] (e.g. [project.scripts]). */
	extra?: string;
}

function tomlList(items: string[]): string {
	return items.length === 0 ? '[]' : `[\n${items.map((i) => `\t'${i}',`).join('\n')}\n]`;
}

// Tabs + single quotes in ruff match the owner's convention; W191/E101 fight tab indentation.
function pyproject(o: PyProjectOptions): string {
	return `[project]
name = '{{name}}'
version = '0.1.0'
description = '${o.description}'
readme = 'README.md'
requires-python = '>=3.12'
dependencies = ${tomlList(o.deps)}
${o.extra ? `\n${o.extra}\n` : ''}
[dependency-groups]
dev = ${tomlList(['pytest>=8.3', 'ruff>=0.8', ...(o.devDeps ?? [])])}

[build-system]
requires = ['hatchling']
build-backend = 'hatchling.build'

[tool.hatch.build.targets.wheel]
packages = ['src/${o.pkg}']

[tool.pytest.ini_options]
testpaths = ['tests']
pythonpath = ['src']

[tool.ruff]
line-length = 100
target-version = 'py312'

[tool.ruff.lint]
select = ['E', 'F', 'I', 'UP', 'B']
ignore = ['W191', 'E101']

[tool.ruff.lint.isort]
known-first-party = ['${o.pkg}']

[tool.ruff.format]
indent-style = 'tab'
quote-style = 'single'
`;
}

const DEV_COMMANDS = `## Everyday commands

\`\`\`powershell
uv sync                 # create .venv and install everything (including dev tools)
uv run pytest           # tests
uv run ruff check .     # lint
uv run ruff format .    # format (tabs, single quotes)
\`\`\`
`;

// ─── python-uv ──────────────────────────────────────────────────────────────

const pythonUv: TemplateDef = {
	id: 'python-uv',
	name: 'Python (uv)',
	description: 'A minimal modern Python 3.12 project managed by uv, with ruff and pytest.',
	tags: ['python', 'uv', 'ruff', 'pytest'],
	files: {
		'pyproject.toml': pyproject({
			description: 'A Python project',
			pkg: 'app',
			deps: [],
			extra: "[project.scripts]\n'{{name}}' = 'app.main:main'",
		}),
		'.python-version': PYTHON_VERSION,
		'.gitignore': gitignore(),
		'README.md': `# {{name}}

A minimal Python 3.12 project managed by [uv](https://docs.astral.sh/uv/).

## Layout

\`\`\`
src/app/        the package (a fixed import name, so the project can be renamed freely)
tests/          pytest tests
pyproject.toml  dependencies and ruff/pytest settings
\`\`\`

## Run

\`\`\`powershell
uv run python -m app.main --name Anvil
uv run {{name}} --name Anvil      # same thing, via the console script
\`\`\`

${DEV_COMMANDS}`,
		'src/app/__init__.py': String.raw`"""{{name}}."""

__version__ = '0.1.0'
`,
		'src/app/main.py': String.raw`"""Command-line entry point."""

import argparse


def greet(name: str) -> str:
	"""Return a friendly greeting."""
	return f'Hello, {name}!'


def main(argv: list[str] | None = None) -> int:
	"""Parse arguments and print a greeting. Returns the process exit code."""
	parser = argparse.ArgumentParser(description='{{name}}')
	parser.add_argument('--name', default='world', help='who to greet')
	args = parser.parse_args(argv)
	print(greet(args.name))
	return 0


if __name__ == '__main__':
	raise SystemExit(main())
`,
		'tests/test_main.py': String.raw`import pytest

from app.main import greet, main


def test_greet() -> None:
	assert greet('Anvil') == 'Hello, Anvil!'


def test_main_prints_greeting(capsys: pytest.CaptureFixture[str]) -> None:
	assert main(['--name', 'quant']) == 0
	assert capsys.readouterr().out == 'Hello, quant!\n'
`,
	},
};

// ─── quant-research ─────────────────────────────────────────────────────────

const quantResearch: TemplateDef = {
	id: 'quant-research',
	name: 'Quant research',
	description:
		'Polars data loading, vectorised performance metrics and a look-ahead-free backtest, with # %% notebooks.',
	tags: ['python', 'uv', 'polars', 'numpy', 'backtest', 'notebook'],
	files: {
		'pyproject.toml': pyproject({
			description: 'Quant research workspace',
			pkg: 'research',
			deps: [
				'polars>=1.9',
				'numpy>=2.0',
				'pandas>=2.2',
				'matplotlib>=3.9',
				'ipykernel>=6.29',
			],
		}),
		'.python-version': PYTHON_VERSION,
		'.gitignore': gitignore([
			'# Market data stays local: large and often licensed.',
			'data/*',
			'!data/.gitkeep',
		]),
		'README.md': `# {{name}}

Quant research workspace: load bars with polars, compute metrics with numpy, backtest signals
without look-ahead, and explore in \`# %%\` cells.

## Layout

\`\`\`
data/                   your OHLCV files (CSV or Parquet; git-ignored)
notebooks/explore.py    exploration as # %% cells: run them one by one in Anvil's IPython REPL
src/research/data.py    load_ohlcv, resample, synthetic_ohlcv
src/research/metrics.py returns, Sharpe, Sortino, max drawdown, CAGR, Calmar
src/research/backtest.py vectorised long/flat backtest with costs in bps
tests/                  pytest tests with known answers
\`\`\`

Data files need the columns \`timestamp, open, high, low, close, volume\`. Until you add some,
the notebook falls back to synthetic hourly bars.

## Conventions

- Returns are simple per-bar fractions (0.01 = +1 %). \`periods_per_year\` annualises them:
  252 for daily equities, 365 for daily crypto, 8760 for hourly crypto.
- A signal computed on bar *t*'s close is traded from bar *t + 1*: the backtest shifts
  positions by one bar so no result ever uses information from the future.

${DEV_COMMANDS}`,
		'data/.gitkeep': '',
		'src/research/__init__.py': String.raw`"""Research helpers: data loading, metrics and backtesting."""
`,
		'src/research/data.py': String.raw`"""Loading and resampling OHLCV bars with polars."""

from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import polars as pl

OHLCV_COLUMNS = ['timestamp', 'open', 'high', 'low', 'close', 'volume']


def load_ohlcv(path: str | Path, timestamp_col: str = 'timestamp') -> pl.DataFrame:
	"""Load bars from a .csv or .parquet file, sorted by time, with Float64 price/volume columns."""
	p = Path(path)
	suffix = p.suffix.lower()
	if suffix == '.parquet':
		df = pl.read_parquet(p)
	elif suffix == '.csv':
		df = pl.read_csv(p, try_parse_dates=True)
	else:
		raise ValueError(f'Unsupported file type {p.suffix!r}: expected .csv or .parquet')
	if timestamp_col != 'timestamp':
		df = df.rename({timestamp_col: 'timestamp'})
	missing = [c for c in OHLCV_COLUMNS if c not in df.columns]
	if missing:
		raise ValueError(f'{p.name} is missing columns {missing}')
	if df.schema['timestamp'] == pl.String:
		df = df.with_columns(pl.col('timestamp').str.to_datetime())
	return (
		df.select(OHLCV_COLUMNS)
		.with_columns([pl.col(c).cast(pl.Float64) for c in OHLCV_COLUMNS[1:]])
		.sort('timestamp')
	)


def resample(df: pl.DataFrame, every: str) -> pl.DataFrame:
	"""Aggregate bars to a coarser interval such as '4h', '1d' or '1w' (polars duration syntax).

	Windows are left-closed and labelled by their start, so a bar never contains later data.
	"""
	return (
		df.sort('timestamp')
		.group_by_dynamic('timestamp', every=every, closed='left', label='left')
		.agg(
			pl.col('open').first(),
			pl.col('high').max(),
			pl.col('low').min(),
			pl.col('close').last(),
			pl.col('volume').sum(),
		)
	)


def synthetic_ohlcv(n: int = 24 * 365, seed: int = 7) -> pl.DataFrame:
	"""Random-walk hourly bars, for trying the pipeline before real data is in data/."""
	rng = np.random.default_rng(seed)
	close = 100 * np.exp(np.cumsum(rng.normal(0, 0.01, n)))
	open_ = np.concatenate([[100.0], close[:-1]])
	wick = np.abs(rng.normal(0, 0.004, n)) * close
	start = datetime(2024, 1, 1)
	return pl.DataFrame(
		{
			'timestamp': pl.datetime_range(start, start + timedelta(hours=n - 1), '1h', eager=True),
			'open': open_,
			'high': np.maximum(open_, close) + wick,
			'low': np.minimum(open_, close) - wick,
			'close': close,
			'volume': rng.integers(100, 10_000, n).astype(np.float64),
		}
	)
`,
		'src/research/metrics.py': String.raw`"""Performance metrics on per-bar returns, vectorised with numpy.

Units: returns are simple per-bar fractions (0.01 = +1 %). periods_per_year converts per-bar
figures to annual ones: 252 for daily equity bars, 365 for daily crypto, 24 * 365 for hourly crypto.
"""

import numpy as np
from numpy.typing import ArrayLike, NDArray

FloatArray = NDArray[np.float64]


def _as_array(x: ArrayLike) -> FloatArray:
	return np.asarray(x, dtype=np.float64)


def simple_returns(prices: ArrayLike) -> FloatArray:
	"""p[t] / p[t-1] - 1 for each bar; one element shorter than prices."""
	p = _as_array(prices)
	return p[1:] / p[:-1] - 1.0


def log_returns(prices: ArrayLike) -> FloatArray:
	"""ln(p[t] / p[t-1]) for each bar. Log returns add across time; simple returns compound."""
	return np.diff(np.log(_as_array(prices)))


def equity_curve(returns: ArrayLike, start: float = 1.0) -> FloatArray:
	"""Compounded equity after each bar, starting from start (same length as returns)."""
	return start * np.cumprod(1.0 + _as_array(returns))


def drawdowns(returns: ArrayLike) -> FloatArray:
	"""Drawdown after each bar as a fraction of the running peak: 0 at a new high, negative below.

	The starting capital counts as the first peak, so an immediate loss is a drawdown too.
	"""
	equity = equity_curve(returns)
	peak = np.maximum.accumulate(np.concatenate([[1.0], equity]))[1:]
	return equity / peak - 1.0


def max_drawdown(returns: ArrayLike) -> float:
	"""Worst peak-to-trough loss as a negative fraction, e.g. -0.25 for a 25 % drawdown."""
	r = _as_array(returns)
	return float(drawdowns(r).min()) if r.size else 0.0


def sharpe(returns: ArrayLike, periods_per_year: int = 252, risk_free: float = 0.0) -> float:
	"""Annualised Sharpe ratio. risk_free is an annual rate, spread evenly over the bars."""
	r = _as_array(returns) - risk_free / periods_per_year
	if r.size < 2:
		return float('nan')
	std = r.std(ddof=1)
	if std == 0:
		return float('nan')
	return float(r.mean() / std * np.sqrt(periods_per_year))


def sortino(returns: ArrayLike, periods_per_year: int = 252, target: float = 0.0) -> float:
	"""Annualised Sortino ratio: mean excess over target divided by downside deviation (per bar)."""
	r = _as_array(returns) - target
	if r.size < 2:
		return float('nan')
	downside = np.sqrt(np.mean(np.minimum(r, 0.0) ** 2))
	if downside == 0:
		return float('inf') if r.mean() > 0 else float('nan')
	return float(r.mean() / downside * np.sqrt(periods_per_year))


def cagr(returns: ArrayLike, periods_per_year: int = 252) -> float:
	"""Compound annual growth rate as a fraction per year (0.1 = +10 %/yr)."""
	r = _as_array(returns)
	if r.size == 0:
		return 0.0
	growth = float(np.prod(1.0 + r))
	if growth <= 0:
		return -1.0
	return growth ** (periods_per_year / r.size) - 1.0


def calmar(returns: ArrayLike, periods_per_year: int = 252) -> float:
	"""CAGR divided by the magnitude of the max drawdown (nan when there was no drawdown)."""
	mdd = max_drawdown(returns)
	if mdd == 0:
		return float('nan')
	return cagr(returns, periods_per_year) / abs(mdd)


def summary(returns: ArrayLike, periods_per_year: int = 252) -> dict[str, float]:
	"""Headline metrics in one dict, handy as the last line of a notebook cell."""
	return {
		'cagr': cagr(returns, periods_per_year),
		'sharpe': sharpe(returns, periods_per_year),
		'sortino': sortino(returns, periods_per_year),
		'max_drawdown': max_drawdown(returns),
		'calmar': calmar(returns, periods_per_year),
	}
`,
		'src/research/backtest.py': String.raw`"""Vectorised long/flat backtest with transaction costs and no look-ahead."""

from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike

from research.metrics import FloatArray, simple_returns


@dataclass(frozen=True)
class BacktestResult:
	positions: FloatArray  # position held over each bar (0 or 1), already shifted by one bar
	returns: FloatArray  # net strategy return per bar
	equity: FloatArray  # compounded equity, starting from 1.0
	trades: int  # number of position changes


def backtest(prices: ArrayLike, signal: ArrayLike, cost_bps: float = 5.0) -> BacktestResult:
	"""Backtest a long/flat signal on close prices.

	signal[t] may use everything up to bar t's close, so it can only be acted on from bar t + 1.
	cost_bps is charged per unit of turnover (1 bp = 0.0001 of notional per position change).
	"""
	p = np.asarray(prices, dtype=np.float64)
	s = np.asarray(signal, dtype=np.float64)
	if p.shape != s.shape:
		raise ValueError(f'prices and signal differ in length ({p.size} != {s.size})')
	if p.size < 2:
		raise ValueError('need at least two prices')
	if np.any((s != 0) & (s != 1)):
		raise ValueError('signal must be 0 (flat) or 1 (long)')
	# The shift is the whole point: the position held over bar t was decided at bar t - 1's close.
	positions = np.concatenate([[0.0], s[:-1]])
	bar_returns = np.concatenate([[0.0], simple_returns(p)])
	turnover = np.abs(np.diff(positions, prepend=0.0))
	net = positions * bar_returns - turnover * cost_bps / 10_000
	return BacktestResult(
		positions=positions,
		returns=net,
		equity=np.cumprod(1.0 + net),
		trades=int(np.count_nonzero(turnover)),
	)


def _rolling_mean(x: FloatArray, window: int) -> FloatArray:
	"""Trailing mean; element i averages x[i : i + window], so the output is len(x) - window + 1."""
	c = np.cumsum(np.concatenate([[0.0], x]))
	return (c[window:] - c[:-window]) / window


def sma_crossover_signal(prices: ArrayLike, fast: int = 20, slow: int = 50) -> FloatArray:
	"""1 where the fast SMA is above the slow SMA at a bar's close, else 0 (0 during warm-up)."""
	if not 0 < fast < slow:
		raise ValueError('need 0 < fast < slow')
	p = np.asarray(prices, dtype=np.float64)
	signal = np.zeros_like(p)
	if p.size < slow:
		return signal
	fast_sma = _rolling_mean(p, fast)[slow - fast :]
	slow_sma = _rolling_mean(p, slow)
	signal[slow - 1 :] = (fast_sma > slow_sma).astype(np.float64)
	return signal
`,
		'notebooks/explore.py': String.raw`# %% [markdown]
# # Explore
# Run cells one at a time (Anvil sends each # %% cell to an IPython REPL).
# Drop CSV/Parquet files with timestamp, open, high, low, close, volume into data/.

# %%
from pathlib import Path

import matplotlib.pyplot as plt
import polars as pl

from research.backtest import backtest, sma_crossover_signal
from research.data import load_ohlcv, resample, synthetic_ohlcv
from research.metrics import summary

# The REPL may start in the project root or in notebooks/, so look in both places.
DATA_DIR = next((d for d in (Path('data'), Path('../data')) if d.is_dir()), Path('data'))
files = sorted([*DATA_DIR.glob('*.parquet'), *DATA_DIR.glob('*.csv')])
bars = load_ohlcv(files[0]) if files else synthetic_ohlcv()
print(f'{len(bars)} bars from', files[0].name if files else 'synthetic data')
bars.head()

# %%
daily = resample(bars, '1d')
daily.with_columns(pl.col('close').pct_change().alias('return')).tail()

# %%
prices = daily['close'].to_numpy()
signal = sma_crossover_signal(prices, fast=10, slow=30)
result = backtest(prices, signal, cost_bps=5.0)
print(f'{result.trades} trades')
summary(result.returns, periods_per_year=365)

# %%
dates = daily['timestamp'].to_numpy()
fig, ax = plt.subplots(figsize=(10, 4))
ax.plot(dates, result.equity, label='SMA 10/30')
ax.plot(dates, prices / prices[0], label='buy and hold', alpha=0.6)
ax.set_title('Equity (start = 1.0)')
ax.legend()
plt.show()
`,
		'tests/test_metrics.py': String.raw`import math

import numpy as np
import pytest

from research.metrics import (
	cagr,
	calmar,
	log_returns,
	max_drawdown,
	sharpe,
	simple_returns,
	sortino,
)


def test_simple_and_log_returns() -> None:
	prices = [100.0, 110.0, 99.0]
	np.testing.assert_allclose(simple_returns(prices), [0.1, -0.1])
	np.testing.assert_allclose(log_returns(prices), np.log([1.1, 0.9]))


def test_max_drawdown_of_known_series() -> None:
	# Equity 1.0 -> 1.2 -> 0.9 -> 1.08: the worst fall is 1.2 -> 0.9, i.e. -25 %.
	assert max_drawdown([0.2, -0.25, 0.2]) == pytest.approx(-0.25)


def test_max_drawdown_is_zero_when_only_rising() -> None:
	assert max_drawdown([0.01, 0.02, 0.03]) == 0.0


def test_cagr_of_doubling_over_two_years() -> None:
	returns = np.full(504, 2 ** (1 / 504) - 1)
	assert cagr(returns, periods_per_year=252) == pytest.approx(math.sqrt(2) - 1)


def test_sharpe_scales_with_sqrt_of_periods() -> None:
	returns = np.array([0.01, -0.005, 0.02, 0.0, -0.01])
	per_bar = returns.mean() / returns.std(ddof=1)
	assert sharpe(returns, periods_per_year=252) == pytest.approx(per_bar * math.sqrt(252))


def test_sortino_only_penalises_downside() -> None:
	returns = np.array([0.02, -0.01, 0.03, -0.02])
	downside = math.sqrt((0.01**2 + 0.02**2) / 4)
	assert sortino(returns, periods_per_year=1) == pytest.approx(returns.mean() / downside)


def test_calmar_is_cagr_over_drawdown() -> None:
	returns = [0.2, -0.25, 0.2]
	assert calmar(returns, periods_per_year=3) == pytest.approx(cagr(returns, 3) / 0.25)
`,
		'tests/test_backtest.py': String.raw`import numpy as np
import pytest

from research.backtest import backtest, sma_crossover_signal


def test_positions_are_shifted_one_bar() -> None:
	result = backtest([100.0, 110.0, 121.0, 121.0], [1.0, 1.0, 0.0, 0.0], cost_bps=0.0)
	np.testing.assert_array_equal(result.positions, [0.0, 1.0, 1.0, 0.0])
	np.testing.assert_allclose(result.returns, [0.0, 0.1, 0.1, 0.0])


def test_no_look_ahead_on_a_perfect_foresight_signal() -> None:
	# Long exactly on up bars would be free money with look-ahead; shifted, it earns the next bar.
	prices = np.array([100.0, 101.0, 100.0, 101.0, 100.0])
	up_this_bar = np.concatenate([[0.0], (np.diff(prices) > 0).astype(np.float64)])
	result = backtest(prices, up_this_bar, cost_bps=0.0)
	assert result.equity[-1] < 1.0


def test_costs_are_charged_per_position_change() -> None:
	result = backtest([100.0] * 4, [1.0, 0.0, 1.0, 0.0], cost_bps=10.0)
	assert result.trades == 3
	assert result.equity[-1] == pytest.approx((1 - 0.001) ** 3)


def test_sma_crossover_is_flat_during_warm_up() -> None:
	signal = sma_crossover_signal(np.arange(1.0, 11.0), fast=2, slow=4)
	np.testing.assert_array_equal(signal[:3], [0.0, 0.0, 0.0])
	assert signal[3:].all()
`,
		'tests/test_data.py': String.raw`from datetime import datetime
from pathlib import Path

import polars as pl

from research.data import load_ohlcv, resample


def test_load_csv_and_resample(tmp_path: Path) -> None:
	path = tmp_path / 'bars.csv'
	pl.DataFrame(
		{
			'timestamp': [datetime(2024, 1, 1, hour) for hour in range(4)],
			'open': [1.0, 2.0, 3.0, 4.0],
			'high': [1.5, 2.5, 3.5, 4.5],
			'low': [0.5, 1.5, 2.5, 3.5],
			'close': [2.0, 3.0, 4.0, 5.0],
			'volume': [10, 20, 30, 40],
		}
	).write_csv(path)
	bars = resample(load_ohlcv(path), '2h')
	assert bars['open'].to_list() == [1.0, 3.0]
	assert bars['high'].to_list() == [2.5, 4.5]
	assert bars['low'].to_list() == [0.5, 2.5]
	assert bars['close'].to_list() == [3.0, 5.0]
	assert bars['volume'].to_list() == [30.0, 70.0]
`,
	},
};

// ─── ml-training ────────────────────────────────────────────────────────────

const mlTraining: TemplateDef = {
	id: 'ml-training',
	name: 'ML training',
	description:
		'A PyTorch training project with YAML configs, seeded runs, early stopping and checkpoints.',
	tags: ['python', 'uv', 'pytorch', 'scikit-learn', 'ml'],
	files: {
		'pyproject.toml': pyproject({
			description: 'PyTorch training project',
			pkg: 'trainer',
			deps: ['torch>=2.4', 'numpy>=2.0', 'scikit-learn>=1.5', 'tqdm>=4.66', 'pyyaml>=6.0'],
		}),
		'.python-version': PYTHON_VERSION,
		'.gitignore': gitignore(['runs/', 'data/', '*.pt', '*.ckpt']),
		'README.md': `# {{name}}

PyTorch training project: a small MLP classifier on tabular data, driven by a YAML config.

## Layout

\`\`\`
configs/base.yaml       every knob; each key maps to a dataclass field in src/trainer/config.py
src/trainer/config.py   typed config loading (unknown keys are errors, so typos never go unnoticed)
src/trainer/data.py     CSV or synthetic data, train/val split, scaling fit on train only
src/trainer/model.py    the MLP
src/trainer/train.py    seeding, device selection, train/val loop, early stopping, checkpoints
scripts/evaluate.py     # %% cells: load the newest checkpoint and report validation metrics
runs/                   one folder per run: config.json, history.json, best.pt (git-ignored)
\`\`\`

## Train

\`\`\`powershell
uv run python -m trainer.train --config configs/base.yaml
\`\`\`

With \`data.csv_path: null\` the run uses synthetic data. Point it at a CSV whose columns are
numeric features plus an integer class column named by \`data.target\`.

The device is picked automatically (CUDA, then Apple MPS, then CPU). The default PyPI wheel of
PyTorch on Windows is CPU-only; for CUDA, follow uv's PyTorch guide to add the CUDA index.

${DEV_COMMANDS}`,
		'configs/base.yaml': `# Training configuration. Every key maps to a dataclass field in src/trainer/config.py.
seed: 42

data:
  csv_path: null # CSV with numeric features and an integer target column; null = synthetic data
  target: target
  val_fraction: 0.2
  synthetic_samples: 2000
  synthetic_features: 16
  synthetic_classes: 3

model:
  hidden_sizes: [64, 64]
  dropout: 0.1

train:
  epochs: 50
  batch_size: 64
  lr: 0.001
  weight_decay: 0.0001
  patience: 5 # epochs without validation improvement before stopping
  device: auto # auto | cuda | mps | cpu
  runs_dir: runs
`,
		'src/trainer/__init__.py': String.raw`"""Training package: config, data, model and training loop."""
`,
		'src/trainer/config.py': String.raw`"""Typed training configuration loaded from YAML."""

from dataclasses import dataclass, field, fields
from pathlib import Path
from typing import Any

import yaml


@dataclass
class DataConfig:
	csv_path: str | None = None
	target: str = 'target'
	val_fraction: float = 0.2
	synthetic_samples: int = 2000
	synthetic_features: int = 16
	synthetic_classes: int = 3


@dataclass
class ModelConfig:
	hidden_sizes: list[int] = field(default_factory=lambda: [64, 64])
	dropout: float = 0.1


@dataclass
class TrainConfig:
	epochs: int = 50
	batch_size: int = 64
	lr: float = 0.001
	weight_decay: float = 0.0001
	patience: int = 5
	device: str = 'auto'
	runs_dir: str = 'runs'


@dataclass
class Config:
	seed: int = 42
	data: DataConfig = field(default_factory=DataConfig)
	model: ModelConfig = field(default_factory=ModelConfig)
	train: TrainConfig = field(default_factory=TrainConfig)


def _check_keys(raw: object, allowed: set[str], where: str) -> dict[str, Any]:
	if not isinstance(raw, dict):
		raise ValueError(f'{where} must be a mapping')
	unknown = sorted(set(raw) - allowed)
	if unknown:
		raise ValueError(f'Unknown keys in {where}: {unknown}')
	return raw


def config_from_dict(raw: object, where: str = 'config') -> Config:
	"""Build a Config from plain data. Unknown keys raise, so a typo never falls back silently."""
	top = _check_keys(raw, {'seed', 'data', 'model', 'train'}, where)
	data = _check_keys(top.get('data') or {}, {f.name for f in fields(DataConfig)}, f'{where}.data')
	model = _check_keys(
		top.get('model') or {}, {f.name for f in fields(ModelConfig)}, f'{where}.model'
	)
	train = _check_keys(
		top.get('train') or {}, {f.name for f in fields(TrainConfig)}, f'{where}.train'
	)
	return Config(
		seed=int(top.get('seed', 42)),
		data=DataConfig(**data),
		model=ModelConfig(**model),
		train=TrainConfig(**train),
	)


def load_config(path: str | Path) -> Config:
	"""Load a YAML config file."""
	raw = yaml.safe_load(Path(path).read_text(encoding='utf-8')) or {}
	return config_from_dict(raw, str(path))
`,
		'src/trainer/data.py': String.raw`"""Tabular data: a CSV with a target column, or synthetic data when no CSV is configured."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from numpy.typing import NDArray
from sklearn.datasets import make_classification
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

from trainer.config import Config


@dataclass
class Loaders:
	train: DataLoader[tuple[torch.Tensor, ...]]
	val: DataLoader[tuple[torch.Tensor, ...]]
	n_features: int
	n_classes: int


def load_arrays(cfg: Config) -> tuple[NDArray[np.float32], NDArray[np.int64]]:
	"""Features as float32 and class labels as int64."""
	d = cfg.data
	if d.csv_path is None:
		x, y = make_classification(
			n_samples=d.synthetic_samples,
			n_features=d.synthetic_features,
			n_informative=max(2, d.synthetic_features // 2),
			n_redundant=0,
			n_classes=d.synthetic_classes,
			random_state=cfg.seed,
		)
		return x.astype(np.float32), y.astype(np.int64)
	path = Path(d.csv_path)
	header = path.read_text(encoding='utf-8').splitlines()[0].split(',')
	if d.target not in header:
		raise ValueError(f'{path}: no column named {d.target!r} (columns: {header})')
	table = np.loadtxt(path, delimiter=',', skiprows=1, dtype=np.float64, ndmin=2)
	target = header.index(d.target)
	return np.delete(table, target, axis=1).astype(np.float32), table[:, target].astype(np.int64)


def make_loaders(cfg: Config) -> Loaders:
	"""Seeded train/val split. The scaler is fit on train only so validation never leaks into it."""
	x, y = load_arrays(cfg)
	x_train, x_val, y_train, y_val = train_test_split(
		x, y, test_size=cfg.data.val_fraction, random_state=cfg.seed, stratify=y
	)
	scaler = StandardScaler().fit(x_train)

	def dataset(features: NDArray[np.float32], labels: NDArray[np.int64]) -> TensorDataset:
		scaled = scaler.transform(features).astype(np.float32)
		return TensorDataset(torch.from_numpy(scaled), torch.from_numpy(labels))

	generator = torch.Generator().manual_seed(cfg.seed)
	batch = cfg.train.batch_size
	return Loaders(
		train=DataLoader(dataset(x_train, y_train), batch, shuffle=True, generator=generator),
		val=DataLoader(dataset(x_val, y_val), batch),
		n_features=x.shape[1],
		n_classes=int(y.max()) + 1,
	)
`,
		'src/trainer/model.py': String.raw`"""A small multilayer perceptron."""

import torch
from torch import nn


class MLP(nn.Module):
	"""Linear -> ReLU -> Dropout blocks, then a linear head producing class logits."""

	def __init__(
		self, in_features: int, hidden_sizes: list[int], out_features: int, dropout: float = 0.0
	) -> None:
		super().__init__()
		layers: list[nn.Module] = []
		width = in_features
		for hidden in hidden_sizes:
			layers += [nn.Linear(width, hidden), nn.ReLU(), nn.Dropout(dropout)]
			width = hidden
		layers.append(nn.Linear(width, out_features))
		self.net = nn.Sequential(*layers)

	def forward(self, x: torch.Tensor) -> torch.Tensor:
		return self.net(x)
`,
		'src/trainer/train.py': String.raw`"""Train the MLP:  uv run python -m trainer.train --config configs/base.yaml"""

import argparse
import json
import random
import time
from dataclasses import asdict
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from trainer.config import Config, load_config
from trainer.data import make_loaders
from trainer.model import MLP


def seed_everything(seed: int) -> None:
	"""Seed every RNG in play so the same config reproduces the same run."""
	random.seed(seed)
	np.random.seed(seed)
	torch.manual_seed(seed)
	torch.cuda.manual_seed_all(seed)


def select_device(preference: str = 'auto') -> torch.device:
	"""CUDA, then Apple MPS, then CPU, unless a specific device is requested."""
	if preference != 'auto':
		return torch.device(preference)
	if torch.cuda.is_available():
		return torch.device('cuda')
	if torch.backends.mps.is_available():
		return torch.device('mps')
	return torch.device('cpu')


def run_epoch(
	model: nn.Module,
	loader: DataLoader[tuple[torch.Tensor, ...]],
	loss_fn: nn.Module,
	device: torch.device,
	optimizer: torch.optim.Optimizer | None = None,
) -> tuple[float, float]:
	"""One pass over loader, training when an optimizer is given. Returns (mean loss, accuracy)."""
	training = optimizer is not None
	model.train(training)
	total_loss, correct, seen = 0.0, 0, 0
	with torch.set_grad_enabled(training):
		for x, y in loader:
			x, y = x.to(device), y.to(device)
			logits = model(x)
			loss = loss_fn(logits, y)
			if optimizer is not None:
				optimizer.zero_grad()
				loss.backward()
				optimizer.step()
			total_loss += loss.item() * len(y)
			correct += int((logits.argmax(dim=1) == y).sum().item())
			seen += len(y)
	return total_loss / seen, correct / seen


def train(cfg: Config) -> Path:
	"""Train with early stopping on validation loss. Returns the run directory."""
	seed_everything(cfg.seed)
	device = select_device(cfg.train.device)
	loaders = make_loaders(cfg)
	model = MLP(
		loaders.n_features, cfg.model.hidden_sizes, loaders.n_classes, cfg.model.dropout
	).to(device)
	optimizer = torch.optim.AdamW(
		model.parameters(), lr=cfg.train.lr, weight_decay=cfg.train.weight_decay
	)
	loss_fn = nn.CrossEntropyLoss()

	run_dir = Path(cfg.train.runs_dir) / time.strftime('%Y%m%d-%H%M%S')
	run_dir.mkdir(parents=True, exist_ok=True)
	(run_dir / 'config.json').write_text(json.dumps(asdict(cfg), indent=2), encoding='utf-8')
	print(f'Training on {device}; run folder {run_dir}')

	best_loss, stale = float('inf'), 0
	history: list[dict[str, float]] = []
	progress = tqdm(range(1, cfg.train.epochs + 1), desc='epochs')
	for epoch in progress:
		train_loss, train_acc = run_epoch(model, loaders.train, loss_fn, device, optimizer)
		val_loss, val_acc = run_epoch(model, loaders.val, loss_fn, device)
		history.append(
			{
				'epoch': epoch,
				'train_loss': train_loss,
				'train_acc': train_acc,
				'val_loss': val_loss,
				'val_acc': val_acc,
			}
		)
		progress.set_postfix(val_loss=f'{val_loss:.4f}', val_acc=f'{val_acc:.3f}')
		if val_loss < best_loss:
			best_loss, stale = val_loss, 0
			checkpoint = {
				'model': model.state_dict(),
				'config': asdict(cfg),
				'n_features': loaders.n_features,
				'n_classes': loaders.n_classes,
				'epoch': epoch,
			}
			torch.save(checkpoint, run_dir / 'best.pt')
		else:
			stale += 1
			if stale >= cfg.train.patience:
				progress.write(f'Early stop at epoch {epoch}: no improvement for {stale} epochs')
				break

	(run_dir / 'history.json').write_text(json.dumps(history, indent=2), encoding='utf-8')
	print(f'Best val loss {best_loss:.4f}; checkpoint {run_dir / "best.pt"}')
	return run_dir


def main() -> None:
	parser = argparse.ArgumentParser(description='Train the {{name}} model')
	parser.add_argument('--config', default='configs/base.yaml', help='YAML config file')
	args = parser.parse_args()
	train(load_config(args.config))


if __name__ == '__main__':
	main()
`,
		'scripts/evaluate.py': String.raw`# %% [markdown]
# # Evaluate the newest checkpoint
# Run from the project root. Rebuilds the same seeded validation split used in training.

# %%
from pathlib import Path

import torch
from sklearn.metrics import classification_report, confusion_matrix

from trainer.config import config_from_dict
from trainer.data import make_loaders
from trainer.model import MLP
from trainer.train import select_device

checkpoints = sorted(Path('runs').glob('*/best.pt'))
if not checkpoints:
	raise SystemExit('No checkpoints in runs/. Train first: uv run python -m trainer.train')
path = checkpoints[-1]
checkpoint = torch.load(path, map_location='cpu', weights_only=True)
cfg = config_from_dict(checkpoint['config'], str(path))
print(f'Evaluating {path} (epoch {checkpoint["epoch"]})')

# %%
device = select_device(cfg.train.device)
model = MLP(
	checkpoint['n_features'], cfg.model.hidden_sizes, checkpoint['n_classes'], cfg.model.dropout
)
model.load_state_dict(checkpoint['model'])
model.to(device).eval()

preds: list[torch.Tensor] = []
labels: list[torch.Tensor] = []
with torch.no_grad():
	for x, y in make_loaders(cfg).val:
		preds.append(model(x.to(device)).argmax(dim=1).cpu())
		labels.append(y)
y_pred = torch.cat(preds).numpy()
y_true = torch.cat(labels).numpy()

# %%
print(classification_report(y_true, y_pred, digits=3))
print(confusion_matrix(y_true, y_pred))
`,
		'tests/test_config.py': String.raw`from pathlib import Path

import pytest

from trainer.config import Config, load_config

BASE = Path(__file__).resolve().parents[1] / 'configs' / 'base.yaml'


def test_base_config_loads() -> None:
	cfg = load_config(BASE)
	assert isinstance(cfg, Config)
	assert cfg.train.epochs > 0
	assert cfg.model.hidden_sizes == [64, 64]
	assert cfg.data.csv_path is None


def test_unknown_key_is_rejected(tmp_path: Path) -> None:
	path = tmp_path / 'typo.yaml'
	path.write_text('train:\n  epocs: 3\n', encoding='utf-8')
	with pytest.raises(ValueError, match='epocs'):
		load_config(path)
`,
		'tests/test_model.py': String.raw`import torch

from trainer.model import MLP
from trainer.train import select_device


def test_forward_shape() -> None:
	model = MLP(in_features=16, hidden_sizes=[32, 8], out_features=3, dropout=0.1)
	assert model(torch.randn(5, 16)).shape == (5, 3)


def test_select_device_honours_explicit_choice() -> None:
	assert select_device('cpu').type == 'cpu'
`,
	},
};

// ─── trading-bot ────────────────────────────────────────────────────────────

const tradingBot: TemplateDef = {
	id: 'trading-bot',
	name: 'Trading bot (paper)',
	description:
		'An async ccxt bot skeleton that paper-trades by default, with SMA signals and risk limits.',
	tags: ['python', 'uv', 'ccxt', 'asyncio', 'trading', 'paper'],
	files: {
		'pyproject.toml': pyproject({
			description: 'Paper-first async trading bot',
			pkg: 'bot',
			deps: ['ccxt>=4.4', 'python-dotenv>=1.0'],
		}),
		'.python-version': PYTHON_VERSION,
		'.gitignore': gitignore(['.env.*', '!.env.example', 'logs/']),
		'.env.example': `# Copy to .env and fill in locally. .env is git-ignored: never commit real keys.
# Keys are only needed for live trading; paper mode uses public market data.
EXCHANGE_API_KEY=
EXCHANGE_API_SECRET=
# Live orders need BOTH paper = false in config.toml AND this set to yes.
ALLOW_LIVE_TRADING=no
`,
		'config.toml': `# Bot settings. Secrets never go here: they come from environment variables (.env).

[exchange]
id = 'binance'        # any ccxt exchange id
symbol = 'BTC/USDT'
timeframe = '1h'
poll_seconds = 60

[trading]
paper = true          # simulated fills; going live also needs ALLOW_LIVE_TRADING=yes in the env
starting_cash = 10000.0

[strategy]
fast = 20
slow = 50

[risk]
risk_per_trade = 0.01   # fraction of equity lost if the stop is hit
stop_loss_pct = 0.02    # stop distance below entry, as a fraction of price
max_position_pct = 0.25 # cap on position value as a fraction of equity
daily_loss_limit = 0.03 # no new entries after losing this fraction of the day's starting equity
`,
		'README.md': `# {{name}}

An async trading bot skeleton on [ccxt](https://docs.ccxt.com/). **It paper-trades by default**:
orders are simulated locally against live public prices and nothing is sent to the exchange.

## Layout

\`\`\`
config.toml          exchange, symbol, timeframe, strategy and risk settings (no secrets)
.env.example         the environment variables the bot reads; copy to .env (git-ignored)
src/bot/config.py    settings loading, credentials from the environment, the live-trading gate
src/bot/strategy.py  SMA crossover on closed candles only
src/bot/risk.py      fixed-fractional sizing, max position, daily loss limit
src/bot/broker.py    PaperBroker (simulated fills) and LiveBroker (refuses unless enabled)
src/bot/main.py      the polling loop
\`\`\`

## Run (paper)

\`\`\`powershell
uv run python -m bot.main
\`\`\`

## Going live (think twice)

Live orders need two independent switches, so one slip cannot enable them:
\`paper = false\` in config.toml **and** \`ALLOW_LIVE_TRADING=yes\` in the environment, plus
API keys in .env. Use keys without withdrawal permission, and paper-trade a strategy first.
Stops are checked on candle closes, so real losses can exceed the configured risk.

${DEV_COMMANDS}`,
		'src/bot/__init__.py': String.raw`"""Paper-first async trading bot."""
`,
		'src/bot/config.py': String.raw`"""Settings from config.toml. Secrets come only from the environment (.env, never committed)."""

import os
import tomllib
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class ExchangeSettings:
	id: str
	symbol: str
	timeframe: str
	poll_seconds: int


@dataclass(frozen=True)
class TradingSettings:
	paper: bool
	starting_cash: float


@dataclass(frozen=True)
class StrategySettings:
	fast: int
	slow: int


@dataclass(frozen=True)
class RiskSettings:
	risk_per_trade: float
	stop_loss_pct: float
	max_position_pct: float
	daily_loss_limit: float


@dataclass(frozen=True)
class Settings:
	exchange: ExchangeSettings
	trading: TradingSettings
	strategy: StrategySettings
	risk: RiskSettings


@dataclass(frozen=True, repr=False)
class Credentials:
	api_key: str
	api_secret: str

	def __repr__(self) -> str:
		# Keeps keys out of logs and tracebacks.
		return 'Credentials(api_key=***, api_secret=***)'


def load_settings(path: str | Path = 'config.toml') -> Settings:
	with open(path, 'rb') as f:
		raw = tomllib.load(f)
	return Settings(
		exchange=ExchangeSettings(**raw['exchange']),
		trading=TradingSettings(**raw['trading']),
		strategy=StrategySettings(**raw['strategy']),
		risk=RiskSettings(**raw['risk']),
	)


def load_credentials() -> Credentials | None:
	"""API keys from the environment, or None when unset (public market data needs none)."""
	load_dotenv()
	key = os.getenv('EXCHANGE_API_KEY', '')
	secret = os.getenv('EXCHANGE_API_SECRET', '')
	return Credentials(key, secret) if key and secret else None


def live_trading_allowed(settings: Settings) -> bool:
	"""Two independent switches: paper = false in config.toml AND ALLOW_LIVE_TRADING=yes in env."""
	load_dotenv()
	return not settings.trading.paper and os.getenv('ALLOW_LIVE_TRADING', '').lower() == 'yes'
`,
		'src/bot/strategy.py': String.raw`"""SMA crossover evaluated on closed candles only."""

import time
from collections.abc import Sequence
from typing import Literal

Signal = Literal['long', 'flat']
# A ccxt OHLCV row: [timestamp_ms, open, high, low, close, volume].
Candle = Sequence[float]


def closed_candles(
	candles: Sequence[Candle], timeframe_ms: int, now_ms: int | None = None
) -> list[Candle]:
	"""Drop the still-forming candle: its close can still change, so acting on it repaints."""
	now = int(time.time() * 1000) if now_ms is None else now_ms
	return [c for c in candles if c[0] + timeframe_ms <= now]


def sma(values: Sequence[float], window: int) -> float:
	"""Mean of the last window values."""
	if len(values) < window:
		raise ValueError(f'need {window} values, got {len(values)}')
	return sum(values[-window:]) / window


def sma_crossover(closes: Sequence[float], fast: int, slow: int) -> Signal | None:
	"""'long' while the fast SMA is above the slow one, else 'flat'; None until enough history."""
	if not 0 < fast < slow:
		raise ValueError('need 0 < fast < slow')
	if len(closes) < slow:
		return None
	return 'long' if sma(closes, fast) > sma(closes, slow) else 'flat'
`,
		'src/bot/risk.py': String.raw`"""Position sizing and loss limits. Money amounts are in quote currency (e.g. USDT)."""

from dataclasses import dataclass
from datetime import UTC, date, datetime


def position_size(
	equity: float,
	price: float,
	risk_per_trade: float,
	stop_loss_pct: float,
	max_position_pct: float,
) -> float:
	"""Base-currency amount such that hitting the stop loses at most risk_per_trade of equity.

	Fixed fractional: (equity * risk_per_trade) / (price * stop_loss_pct), then capped so the
	position's value never exceeds max_position_pct of equity.
	"""
	if not 0 < stop_loss_pct < 1:
		raise ValueError('stop_loss_pct must be between 0 and 1')
	if equity <= 0 or price <= 0:
		return 0.0
	by_risk = equity * risk_per_trade / (price * stop_loss_pct)
	by_cap = equity * max_position_pct / price
	return max(0.0, min(by_risk, by_cap))


@dataclass
class DailyLossGuard:
	"""Blocks new entries once equity is daily_loss_limit below the day's first reading (UTC)."""

	daily_loss_limit: float
	day: date | None = None
	start_equity: float = 0.0

	def allows_entry(self, equity: float, now: datetime | None = None) -> bool:
		today = (now or datetime.now(UTC)).date()
		if today != self.day:
			self.day, self.start_equity = today, equity
		return equity > self.start_equity * (1 - self.daily_loss_limit)
`,
		'src/bot/broker.py': String.raw`"""Order execution. PaperBroker simulates fills; LiveBroker refuses to start unless enabled."""

from dataclasses import dataclass, field
from typing import Literal

import ccxt.async_support as ccxt

from bot.config import Settings, live_trading_allowed

Side = Literal['buy', 'sell']


@dataclass(frozen=True)
class Fill:
	side: Side
	amount: float
	price: float
	fee: float


@dataclass
class PaperBroker:
	"""Long/flat simulator: market orders fill at the given price plus slippage, minus a fee."""

	cash: float
	fee_rate: float = 0.001
	slippage_bps: float = 2.0
	position: float = 0.0
	fills: list[Fill] = field(default_factory=list)

	async def balance(self, price: float) -> tuple[float, float]:
		"""(position in base currency, equity in quote currency) marked at price."""
		return self.position, self.cash + self.position * price

	async def market_order(self, side: Side, amount: float, price: float) -> Fill:
		if amount <= 0:
			raise ValueError('amount must be positive')
		slip = price * self.slippage_bps / 10_000
		fill_price = price + slip if side == 'buy' else price - slip
		notional = amount * fill_price
		fee = notional * self.fee_rate
		if side == 'buy':
			if notional + fee > self.cash:
				raise ValueError(f'Paper cash {self.cash:.2f} < order cost {notional + fee:.2f}')
			self.cash -= notional + fee
			self.position += amount
		else:
			if amount > self.position * (1 + 1e-9):
				raise ValueError('Long/flat only: cannot sell more than the open position')
			self.cash += notional - fee
			self.position = max(0.0, self.position - amount)
		fill = Fill(side, amount, fill_price, fee)
		self.fills.append(fill)
		return fill


class LiveBroker:
	"""Real market orders via ccxt, gated by config AND environment (see live_trading_allowed)."""

	def __init__(self, exchange: ccxt.Exchange, settings: Settings) -> None:
		# Checked here as well as in main so no code path can build a live broker by accident.
		if not live_trading_allowed(settings):
			raise RuntimeError(
				'Live trading is disabled: it needs paper = false in config.toml '
				'AND ALLOW_LIVE_TRADING=yes in the environment.'
			)
		self._exchange = exchange
		self._symbol = settings.exchange.symbol
		base, quote = self._symbol.split('/')
		self._base, self._quote = base, quote.split(':')[0]

	async def balance(self, price: float) -> tuple[float, float]:
		totals = (await self._exchange.fetch_balance())['total']
		position = float(totals.get(self._base) or 0.0)
		return position, float(totals.get(self._quote) or 0.0) + position * price

	async def market_order(self, side: Side, amount: float, price: float) -> Fill:
		order = await self._exchange.create_order(self._symbol, 'market', side, amount)
		fee = order.get('fee') or {}
		return Fill(
			side=side,
			amount=float(order.get('filled') or amount),
			price=float(order.get('average') or price),
			fee=float(fee.get('cost') or 0.0),
		)
`,
		'src/bot/main.py': String.raw`"""Polling loop: closed candles -> signal -> risk checks -> broker.

Run with:  uv run python -m bot.main
"""

import asyncio
import logging
import sys
from dataclasses import dataclass

import ccxt.async_support as ccxt

from bot.broker import LiveBroker, PaperBroker
from bot.config import Settings, live_trading_allowed, load_credentials, load_settings
from bot.risk import DailyLossGuard, position_size
from bot.strategy import closed_candles, sma_crossover

log = logging.getLogger('bot')


@dataclass
class BotState:
	entry_price: float | None = None
	# Set when a stop fires; blocks re-entry until the signal turns flat, otherwise the next
	# poll sees the same 'long' candle and buys straight back in.
	stopped_out: bool = False


def make_exchange(settings: Settings, live: bool) -> ccxt.Exchange:
	"""A keyless public-data client unless trading live, so paper mode never sends credentials."""
	exchange_id = settings.exchange.id
	if exchange_id not in ccxt.exchanges:
		raise ValueError(f'Unknown ccxt exchange {exchange_id!r}')
	options: dict[str, object] = {'enableRateLimit': True}
	if live:
		credentials = load_credentials()
		if credentials is None:
			raise RuntimeError('Live trading needs EXCHANGE_API_KEY and EXCHANGE_API_SECRET')
		options |= {'apiKey': credentials.api_key, 'secret': credentials.api_secret}
	exchange: ccxt.Exchange = getattr(ccxt, exchange_id)(options)
	return exchange


async def step(
	exchange: ccxt.Exchange,
	broker: PaperBroker | LiveBroker,
	settings: Settings,
	guard: DailyLossGuard,
	state: BotState,
) -> None:
	"""One iteration, acting only on the newest closed candle."""
	ex, strat, risk = settings.exchange, settings.strategy, settings.risk
	timeframe_ms = exchange.parse_timeframe(ex.timeframe) * 1000
	candles = await exchange.fetch_ohlcv(ex.symbol, ex.timeframe, limit=strat.slow + 5)
	closed = closed_candles(candles, timeframe_ms, exchange.milliseconds())
	signal = sma_crossover([c[4] for c in closed], strat.fast, strat.slow)
	if signal is None:
		log.info('Waiting for %d closed candles (have %d)', strat.slow, len(closed))
		return
	price = closed[-1][4]
	position, equity = await broker.balance(price)
	can_enter = guard.allows_entry(equity)
	log.info('%s close=%.2f signal=%s position=%.6f', ex.symbol, price, signal, position)

	stop_price = state.entry_price * (1 - risk.stop_loss_pct) if state.entry_price else None
	stopped = stop_price is not None and price <= stop_price
	if signal == 'flat':
		state.stopped_out = False
	if position > 0 and (signal == 'flat' or stopped):
		fill = await broker.market_order('sell', position, price)
		state.entry_price = None
		state.stopped_out = stopped and signal != 'flat'
		reason = 'Stop hit' if stopped else 'Exit'
		log.info('%s: sold %.6f at %.2f', reason, fill.amount, fill.price)
	elif position <= 0 and signal == 'long':
		if state.stopped_out:
			log.info('Stopped out: waiting for a flat signal before re-entering')
			return
		if not can_enter:
			log.warning('Daily loss limit reached: no new entries until tomorrow (UTC)')
			return
		amount = position_size(
			equity, price, risk.risk_per_trade, risk.stop_loss_pct, risk.max_position_pct
		)
		if amount > 0:
			fill = await broker.market_order('buy', amount, price)
			state.entry_price = fill.price
			log.info('Bought %.6f at %.2f (fee %.4f)', fill.amount, fill.price, fill.fee)


async def run(settings: Settings) -> None:
	live = live_trading_allowed(settings)
	exchange = make_exchange(settings, live)
	broker = (
		LiveBroker(exchange, settings) if live else PaperBroker(cash=settings.trading.starting_cash)
	)
	if live:
		log.warning('LIVE TRADING ENABLED on %s', settings.exchange.id)
	else:
		log.info('Paper trading %s on %s', settings.exchange.symbol, settings.exchange.id)
	guard = DailyLossGuard(settings.risk.daily_loss_limit)
	state = BotState()
	try:
		while True:
			try:
				await step(exchange, broker, settings, guard, state)
			except ccxt.NetworkError as err:
				# Transient exchange hiccups should not kill the bot; the next poll retries.
				log.warning('Network error, retrying next poll: %s', err)
			await asyncio.sleep(settings.exchange.poll_seconds)
	finally:
		await exchange.close()


def main() -> None:
	logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
	if sys.platform == 'win32':
		# aiodns (used by ccxt through aiohttp) cannot run on Windows' default Proactor loop.
		asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
	try:
		asyncio.run(run(load_settings()))
	except KeyboardInterrupt:
		log.info('Stopped')


if __name__ == '__main__':
	main()
`,
		'tests/test_risk.py': String.raw`from datetime import UTC, datetime, timedelta

import pytest

from bot.risk import DailyLossGuard, position_size


def test_size_is_fixed_fractional_risk() -> None:
	# 1 % of 10k = 100 at risk; a 2 % stop on a 50k price risks 1k per coin -> 0.1 coin.
	amount = position_size(10_000, 50_000, 0.01, 0.02, max_position_pct=1.0)
	assert amount == pytest.approx(0.1)


def test_size_is_capped_by_max_position() -> None:
	# The uncapped 0.1 coin is worth 5k; a 25 % cap allows 2.5k, i.e. 0.05 coin.
	amount = position_size(10_000, 50_000, 0.01, 0.02, max_position_pct=0.25)
	assert amount == pytest.approx(0.05)


def test_no_equity_means_no_trade() -> None:
	assert position_size(0, 50_000, 0.01, 0.02, 0.25) == 0.0


def test_daily_loss_guard_blocks_then_resets_next_day() -> None:
	guard = DailyLossGuard(daily_loss_limit=0.03)
	morning = datetime(2024, 1, 1, 9, tzinfo=UTC)
	assert guard.allows_entry(10_000, morning)
	assert guard.allows_entry(9_800, morning)
	assert not guard.allows_entry(9_690, morning)
	assert guard.allows_entry(9_690, morning + timedelta(days=1))
`,
		'tests/test_strategy.py': String.raw`from bot.strategy import closed_candles, sma_crossover

HOUR_MS = 3_600_000


def test_long_when_fast_above_slow() -> None:
	assert sma_crossover([1, 2, 3, 4, 5, 6], fast=2, slow=4) == 'long'


def test_flat_when_falling() -> None:
	assert sma_crossover([6, 5, 4, 3, 2, 1], fast=2, slow=4) == 'flat'


def test_no_signal_without_enough_history() -> None:
	assert sma_crossover([1, 2, 3], fast=2, slow=4) is None


def test_forming_candle_is_dropped() -> None:
	candles = [[t * HOUR_MS, 1.0, 1.0, 1.0, 1.0, 0.0] for t in range(3)]
	closed = closed_candles(candles, HOUR_MS, now_ms=2 * HOUR_MS + 60_000)
	assert [c[0] for c in closed] == [0, HOUR_MS]
`,
		'tests/test_broker.py': String.raw`import asyncio
from dataclasses import replace
from pathlib import Path
from typing import cast

import ccxt.async_support as ccxt
import pytest

from bot.broker import LiveBroker, PaperBroker
from bot.config import Settings, live_trading_allowed, load_settings


@pytest.fixture
def settings() -> Settings:
	return load_settings(Path(__file__).resolve().parents[1] / 'config.toml')


def test_paper_round_trip_charges_fees() -> None:
	broker = PaperBroker(cash=1_000.0, fee_rate=0.001, slippage_bps=0.0)
	asyncio.run(broker.market_order('buy', 1.0, 100.0))
	position, equity = asyncio.run(broker.balance(100.0))
	assert position == 1.0
	assert equity == pytest.approx(1_000.0 - 0.1)
	asyncio.run(broker.market_order('sell', 1.0, 110.0))
	assert broker.cash == pytest.approx(1_000.0 - 100.0 - 0.1 + 110.0 - 0.11)


def test_paper_broker_cannot_overspend() -> None:
	with pytest.raises(ValueError):
		asyncio.run(PaperBroker(cash=10.0).market_order('buy', 1.0, 100.0))


def test_default_config_is_paper(settings: Settings) -> None:
	assert settings.trading.paper is True
	assert not live_trading_allowed(settings)
	with pytest.raises(RuntimeError, match='disabled'):
		LiveBroker(cast(ccxt.Exchange, object()), settings)


def test_live_needs_the_env_switch_too(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
	live_config = replace(settings, trading=replace(settings.trading, paper=False))
	monkeypatch.setenv('ALLOW_LIVE_TRADING', 'no')
	assert not live_trading_allowed(live_config)
	monkeypatch.setenv('ALLOW_LIVE_TRADING', 'yes')
	assert live_trading_allowed(live_config)
`,
	},
};

// ─── data-api ───────────────────────────────────────────────────────────────

const dataApi: TemplateDef = {
	id: 'data-api',
	name: 'Data API (FastAPI + DuckDB)',
	description:
		'A FastAPI service that answers parameterised, read-only DuckDB queries over Parquet files.',
	tags: ['python', 'uv', 'fastapi', 'duckdb', 'parquet', 'api'],
	files: {
		'pyproject.toml': pyproject({
			description: 'FastAPI + DuckDB data service',
			pkg: 'api',
			deps: ['fastapi>=0.115', 'uvicorn[standard]>=0.32', 'duckdb>=1.1', 'pydantic>=2.9'],
			devDeps: ['httpx>=0.27'],
		}),
		'.python-version': PYTHON_VERSION,
		'.gitignore': gitignore(['data/*', '!data/.gitkeep']),
		'README.md': `# {{name}}

A small FastAPI service that serves Parquet files in \`data/\` through DuckDB.

## Layout

\`\`\`
data/               Parquet files; each file name (without .parquet) is a dataset (git-ignored)
src/api/main.py     FastAPI app: GET /health, POST /query
src/api/models.py   pydantic request/response models
src/api/db.py       query building: columns checked against the schema, values bound as parameters
tests/test_api.py   TestClient tests against a temporary Parquet file
\`\`\`

## Run

\`\`\`powershell
uv run uvicorn api.main:app --reload     # http://127.0.0.1:8000/docs
\`\`\`

Set \`DATA_DIR\` to serve Parquet files from another folder.

## Query

\`\`\`json
POST /query
{
  "dataset": "prices",
  "columns": ["day", "close"],
  "filters": [{ "column": "symbol", "op": "=", "value": "BTC" }],
  "order_by": "day",
  "descending": true,
  "limit": 100
}
\`\`\`

Requests never become SQL text: dataset names are pattern-checked, columns must exist in the
file, operators come from a fixed list and every value is a bound parameter. Only SELECTs built
by the service run, so the API is read-only.

${DEV_COMMANDS}`,
		'data/.gitkeep': '',
		'src/api/__init__.py': String.raw`"""Read-only Parquet query service."""
`,
		'src/api/models.py': String.raw`"""Request and response models."""

from typing import Any, Literal, Self

from pydantic import BaseModel, Field, model_validator

Scalar = str | int | float | bool
# Fixed list: the operator is the only request value that is placed into SQL text.
Op = Literal['=', '!=', '<', '<=', '>', '>=', 'in']


class Filter(BaseModel):
	column: str
	op: Op = '='
	value: Scalar | list[Scalar]

	@model_validator(mode='after')
	def _value_matches_op(self) -> Self:
		if self.op == 'in':
			if not isinstance(self.value, list) or not self.value:
				raise ValueError("op 'in' needs a non-empty list value")
		elif isinstance(self.value, list):
			raise ValueError(f'op {self.op!r} needs a single value')
		return self


class QueryRequest(BaseModel):
	dataset: str = Field(
		pattern=r'^[A-Za-z0-9_-]{1,64}$', description='Parquet file in data/, without .parquet'
	)
	columns: list[str] | None = Field(default=None, description='Columns to return; all if omitted')
	filters: list[Filter] = Field(default_factory=list)
	order_by: str | None = None
	descending: bool = False
	limit: int = Field(default=100, ge=1, le=10_000)


class QueryResponse(BaseModel):
	columns: list[str]
	rows: list[list[Any]]
	row_count: int


class Health(BaseModel):
	status: Literal['ok']
	datasets: list[str]
`,
		'src/api/db.py': String.raw`"""Read-only query building over Parquet files.

Identifiers are checked against the file's schema and every value is a bound parameter, so data
from a request never becomes SQL text.
"""

from pathlib import Path
from typing import Any

import duckdb

from api.models import QueryRequest


class DatasetNotFoundError(LookupError):
	"""There is no data/<name>.parquet for the requested dataset."""


class InvalidQueryError(ValueError):
	"""The request references a column the dataset does not have."""


def list_datasets(data_dir: Path) -> list[str]:
	return sorted(p.stem for p in data_dir.glob('*.parquet'))


def _ident(name: str) -> str:
	return '"' + name.replace('"', '""') + '"'


def _source(data_dir: Path, dataset: str) -> str:
	path = data_dir / f'{dataset}.parquet'
	if not path.is_file():
		raise DatasetNotFoundError(dataset)
	# Safe to inline: the name is pattern-validated and the file must exist inside data_dir.
	literal = path.resolve().as_posix().replace("'", "''")
	return f"read_parquet('{literal}')"


def run_query(req: QueryRequest, data_dir: Path) -> tuple[list[str], list[list[Any]]]:
	"""Run the request as a single SELECT and return (column names, rows)."""
	source = _source(data_dir, req.dataset)
	with duckdb.connect(':memory:') as con:
		schema = [row[0] for row in con.execute(f'DESCRIBE SELECT * FROM {source}').fetchall()]
		wanted = req.columns or schema
		referenced = [*wanted, *(f.column for f in req.filters)]
		if req.order_by:
			referenced.append(req.order_by)
		unknown = sorted(set(referenced) - set(schema))
		if unknown:
			raise InvalidQueryError(f'Unknown column(s) {unknown} in dataset {req.dataset!r}')

		clauses: list[str] = []
		params: list[Any] = []
		for f in req.filters:
			if isinstance(f.value, list):
				marks = ', '.join('?' for _ in f.value)
				clauses.append(f'{_ident(f.column)} IN ({marks})')
				params.extend(f.value)
			else:
				clauses.append(f'{_ident(f.column)} {f.op} ?')
				params.append(f.value)

		sql = f'SELECT {", ".join(_ident(c) for c in wanted)} FROM {source}'
		if clauses:
			sql += ' WHERE ' + ' AND '.join(clauses)
		if req.order_by:
			sql += f' ORDER BY {_ident(req.order_by)} {"DESC" if req.descending else "ASC"}'
		sql += ' LIMIT ?'
		params.append(req.limit)

		cursor = con.execute(sql, params)
		columns = [d[0] for d in cursor.description or []]
		return columns, [list(row) for row in cursor.fetchall()]
`,
		'src/api/main.py': String.raw`"""FastAPI app. Run with:  uv run uvicorn api.main:app --reload"""

import os
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException

from api.db import DatasetNotFoundError, InvalidQueryError, list_datasets, run_query
from api.models import Health, QueryRequest, QueryResponse

app = FastAPI(title='{{name}}', version='0.1.0')


def get_data_dir() -> Path:
	"""Parquet folder; DATA_DIR overrides it (tests swap it via dependency_overrides)."""
	return Path(os.getenv('DATA_DIR', 'data'))


DataDir = Annotated[Path, Depends(get_data_dir)]


@app.get('/health')
async def health(data_dir: DataDir) -> Health:
	return Health(status='ok', datasets=list_datasets(data_dir))


@app.post('/query')
def query(req: QueryRequest, data_dir: DataDir) -> QueryResponse:
	"""Sync on purpose: FastAPI runs it in a thread pool, so a slow scan never blocks the loop."""
	try:
		columns, rows = run_query(req, data_dir)
	except DatasetNotFoundError as err:
		raise HTTPException(status_code=404, detail=f'Unknown dataset {req.dataset!r}') from err
	except InvalidQueryError as err:
		raise HTTPException(status_code=400, detail=str(err)) from err
	return QueryResponse(columns=columns, rows=rows, row_count=len(rows))
`,
		'tests/test_api.py': String.raw`from collections.abc import Iterator
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

from api.main import app, get_data_dir


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
	target = (tmp_path / 'prices.parquet').as_posix()
	duckdb.execute(
		'COPY (SELECT symbol, day, close::DOUBLE AS close FROM (VALUES '
		"('BTC', 1, 100.0), ('BTC', 2, 101.5), ('ETH', 1, 10.0)) AS t(symbol, day, close)) "
		f"TO '{target}' (FORMAT parquet)"
	)
	app.dependency_overrides[get_data_dir] = lambda: tmp_path
	with TestClient(app) as test_client:
		yield test_client
	app.dependency_overrides.clear()


def test_health_lists_datasets(client: TestClient) -> None:
	res = client.get('/health')
	assert res.status_code == 200
	assert res.json() == {'status': 'ok', 'datasets': ['prices']}


def test_query_filters_and_orders(client: TestClient) -> None:
	res = client.post(
		'/query',
		json={
			'dataset': 'prices',
			'columns': ['day', 'close'],
			'filters': [{'column': 'symbol', 'op': '=', 'value': 'BTC'}],
			'order_by': 'day',
			'descending': True,
		},
	)
	assert res.status_code == 200
	body = res.json()
	assert body['columns'] == ['day', 'close']
	assert body['rows'] == [[2, 101.5], [1, 100.0]]


def test_in_filter(client: TestClient) -> None:
	payload = {'dataset': 'prices', 'filters': [{'column': 'symbol', 'op': 'in', 'value': ['ETH']}]}
	res = client.post('/query', json=payload)
	assert res.json()['row_count'] == 1


def test_injection_attempt_is_just_a_value(client: TestClient) -> None:
	payload = {'dataset': 'prices', 'filters': [{'column': 'symbol', 'value': "BTC' OR '1'='1"}]}
	res = client.post('/query', json=payload)
	assert res.status_code == 200
	assert res.json()['row_count'] == 0


def test_unknown_column_is_rejected(client: TestClient) -> None:
	res = client.post('/query', json={'dataset': 'prices', 'columns': ['close; DROP TABLE t']})
	assert res.status_code == 400


def test_unknown_dataset_is_404(client: TestClient) -> None:
	assert client.post('/query', json={'dataset': 'missing'}).status_code == 404


def test_path_traversal_is_rejected(client: TestClient) -> None:
	assert client.post('/query', json={'dataset': '../secrets'}).status_code == 422
`,
	},
};

export const TEMPLATES: readonly TemplateDef[] = [
	pythonUv,
	quantResearch,
	mlTraining,
	tradingBot,
	dataApi,
];
