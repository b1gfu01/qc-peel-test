"""Phân tích SPC peel strength màng PET12/PE60.

- Biểu đồ X-bar R theo nhóm mẫu (mỗi ca = 1 subgroup, n = 5)
- Năng lực quá trình một phía (chỉ có LSL)
- So sánh trung bình 3 ca
- Xuất báo cáo HTML tiếng Việt

Chạy: python peel_analysis.py [đường_dẫn_csv]
"""
import base64
import html
import io
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

LSL = 3.5
UNIT = "N/15mm"
# Hằng số biểu đồ kiểm soát cho n = 5
A2, D3, D4, D2 = 0.577, 0.0, 2.114, 2.326
CPK_TARGET = 1.33
SAMPLE_COLS = [f"Mau_{i}" for i in range(1, 6)]
SHIFT_COLORS = {"Ca 1": "#2a6fdb", "Ca 2": "#e08a1e", "Ca 3": "#c23b5a"}

BASE = Path(__file__).resolve().parent
OUT_DIR = BASE / "output"
REPORT = BASE / "bao_cao_peel_strength.html"


# ---------------------------------------------------------------- dữ liệu
def load_data(path):
    df = pd.read_csv(path, encoding="utf-8-sig")
    df["Ngay"] = pd.to_datetime(df["Ngay"])
    df = df.sort_values(["Ngay", "Ca"]).reset_index(drop=True)
    df["Nhom"] = np.arange(1, len(df) + 1)
    df["Xbar"] = df[SAMPLE_COLS].mean(axis=1)
    df["R"] = df[SAMPLE_COLS].max(axis=1) - df[SAMPLE_COLS].min(axis=1)
    long = df.melt(id_vars=["Ngay", "Ca", "Nhom"], value_vars=SAMPLE_COLS,
                   var_name="Mau", value_name="Peel")
    return df, long


# ---------------------------------------------------------------- X-bar R
def xbar_r_limits(df):
    xbb, rbar = df["Xbar"].mean(), df["R"].mean()
    return {
        "xbb": xbb, "rbar": rbar,
        "ucl_x": xbb + A2 * rbar, "lcl_x": xbb - A2 * rbar,
        "ucl_r": D4 * rbar, "lcl_r": D3 * rbar,
    }


def run_rule(values, center, length=8):
    """Western Electric rule 2: >= `length` điểm liên tiếp cùng một phía CL.
    Trả về danh sách (vị trí bắt đầu, vị trí kết thúc, phía) theo chỉ số 0."""
    side = np.sign(np.asarray(values) - center)
    runs, start = [], 0
    for i in range(1, len(side) + 1):
        if i == len(side) or side[i] != side[start]:
            if side[start] != 0 and i - start >= length:
                runs.append((start, i - 1, "trên" if side[start] > 0 else "dưới"))
            start = i
    return runs


def signals(df, lim):
    out = []
    for _, r in df.iterrows():
        label = f"Nhóm {r.Nhom} ({r.Ngay:%d/%m}, {r.Ca})"
        if r.Xbar > lim["ucl_x"] or r.Xbar < lim["lcl_x"]:
            out.append(f"{label}: X̄ = {r.Xbar:.3f} nằm ngoài giới hạn kiểm soát X̄.")
        if r.R > lim["ucl_r"] or r.R < lim["lcl_r"]:
            out.append(f"{label}: R = {r.R:.2f} vượt UCL<sub>R</sub>.")
    for s, e, side in run_rule(df["Xbar"].values, lim["xbb"]):
        out.append(f"Nhóm {s + 1}–{e + 1}: {e - s + 1} điểm X̄ liên tiếp {side} đường tâm "
                   f"(quy tắc Western Electric số 2).")
    return out


def plot_xbar_r(df, lim):
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7.5), sharex=True,
                                   gridspec_kw={"hspace": 0.12})
    x = df["Nhom"].values
    for ax, col, cl, ucl, lcl, title in [
        (ax1, "Xbar", lim["xbb"], lim["ucl_x"], lim["lcl_x"], "Biểu đồ X̄ (trung bình nhóm)"),
        (ax2, "R", lim["rbar"], lim["ucl_r"], lim["lcl_r"], "Biểu đồ R (khoảng biến thiên nhóm)"),
    ]:
        y = df[col].values
        ax.plot(x, y, color="#888", lw=1, zorder=1)
        for ca, color in SHIFT_COLORS.items():
            m = (df["Ca"] == ca).values
            ax.scatter(x[m], y[m], color=color, s=36, zorder=3, label=ca)
        out = (y > ucl) | (y < lcl)
        ax.scatter(x[out], y[out], s=150, facecolors="none", edgecolors="red", lw=1.8, zorder=4,
                   label="Ngoài giới hạn" if out.any() else None)
        ax.axhline(cl, color="#222", lw=1.2)
        for v in (ucl, lcl):
            ax.axhline(v, color="red", ls="--", lw=1)
        for v, name in ((ucl, "UCL"), (cl, "CL"), (lcl, "LCL")):
            ax.annotate(f"{name} = {v:.3f}", (1.01, v), xycoords=("axes fraction", "data"),
                        va="center", fontsize=8.5, annotation_clip=False)
        ax.set_title(title, loc="left", fontsize=11)
        ax.grid(alpha=0.25)
    ax1.axhline(LSL, color="#7a1fa2", ls=":", lw=1.6)
    ax1.annotate(f"LSL = {LSL}", (x[0], LSL), xytext=(0, 4), textcoords="offset points",
                 color="#7a1fa2", fontsize=8.5)
    ax1.set_ylabel(f"X̄ ({UNIT})")
    ax2.set_ylabel(f"R ({UNIT})")
    ax2.set_xlabel("Nhóm mẫu (theo thứ tự ngày → ca)")
    ax2.set_xticks(x)
    ax2.set_xticklabels([f"{d:%d/%m}\n{c[-1]}" if c == "Ca 1" else c[-1]
                         for d, c in zip(df["Ngay"], df["Ca"])], fontsize=7.5)
    ax1.legend(ncol=4, fontsize=8.5, loc="lower right", bbox_to_anchor=(1, 1.0), frameon=False)
    fig.subplots_adjust(right=0.88)
    return fig


# ---------------------------------------------------------------- năng lực
def capability(values, sigma_within):
    v = np.asarray(values, dtype=float)
    mu, s = v.mean(), v.std(ddof=1)
    return {
        "n": len(v), "mean": mu, "sigma_w": sigma_within, "sigma_o": s,
        "cpk": (mu - LSL) / (3 * sigma_within),
        "ppk": (mu - LSL) / (3 * s),
        "obs_pct": (v < LSL).mean() * 100,
        "obs_n": int((v < LSL).sum()),
        "exp_pct": stats.norm.cdf((LSL - mu) / s) * 100,
    }


def plot_histogram(long, cap):
    fig, ax = plt.subplots(figsize=(9, 4.5))
    v = long["Peel"].values
    ax.hist(v, bins=16, color="#9fb7d9", edgecolor="white", density=True)
    xs = np.linspace(min(v.min(), LSL) - 0.3, v.max() + 0.3, 300)
    ax.plot(xs, stats.norm.pdf(xs, cap["mean"], cap["sigma_o"]), color="#2a6fdb", lw=2,
            label="Phân phối chuẩn (σ tổng)")
    ax.plot(xs, stats.norm.pdf(xs, cap["mean"], cap["sigma_w"]), color="#2a6fdb", lw=1.2,
            ls="--", label="Phân phối chuẩn (σ trong nhóm)")
    ax.axvline(LSL, color="#7a1fa2", lw=2, ls=":", label=f"LSL = {LSL}")
    ax.axvline(cap["mean"], color="#222", lw=1, label=f"Trung bình = {cap['mean']:.3f}")
    ax.set_xlabel(f"Peel strength ({UNIT})")
    ax.set_ylabel("Mật độ")
    ax.set_title("Phân bố peel strength – toàn bộ 150 mẫu", loc="left", fontsize=11)
    ax.legend(fontsize=8.5)
    ax.grid(alpha=0.25)
    return fig


# ---------------------------------------------------------------- so sánh ca
def compare_shifts(df, long):
    shifts = sorted(long["Ca"].unique())
    groups = [long.loc[long["Ca"] == c, "Peel"].values for c in shifts]
    xbar_groups = [df.loc[df["Ca"] == c, "Xbar"].values for c in shifts]
    tukey = stats.tukey_hsd(*groups)
    pairs = []
    for i in range(len(shifts)):
        for j in range(i + 1, len(shifts)):
            ci = tukey.confidence_interval()
            pairs.append({
                "pair": f"{shifts[i]} – {shifts[j]}",
                "diff": groups[i].mean() - groups[j].mean(),
                "lo": ci.low[i, j], "hi": ci.high[i, j],
                "p": tukey.pvalue[i, j],
            })
    return {
        "shifts": shifts, "groups": groups,
        "levene": stats.levene(*groups),
        "anova": stats.f_oneway(*groups),
        "kruskal": stats.kruskal(*groups),
        "anova_xbar": stats.f_oneway(*xbar_groups),
        "tukey": pairs,
    }


def plot_boxplot(cmp):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    bp = ax.boxplot(cmp["groups"], patch_artist=True, widths=0.5,
                    medianprops={"color": "#222"})
    ax.set_xticks(range(1, len(cmp["shifts"]) + 1), cmp["shifts"])
    rng = np.random.default_rng(0)
    for k, (ca, g) in enumerate(zip(cmp["shifts"], cmp["groups"]), start=1):
        bp["boxes"][k - 1].set(facecolor=SHIFT_COLORS[ca], alpha=0.25)
        ax.scatter(k + rng.uniform(-0.12, 0.12, len(g)), g, s=14, color=SHIFT_COLORS[ca], zorder=3)
        ax.scatter(k, g.mean(), marker="D", s=50, color="#222", zorder=4)
        ax.annotate(f"{g.mean():.3f}", (k + 0.28, g.mean()), va="center", fontsize=9)
    ax.axhline(LSL, color="#7a1fa2", ls=":", lw=1.6, label=f"LSL = {LSL}")
    ax.set_ylabel(f"Peel strength ({UNIT})")
    ax.set_title("So sánh peel strength theo ca (◆ = trung bình)", loc="left", fontsize=11)
    ax.legend(fontsize=8.5, loc="upper right")
    ax.grid(alpha=0.25, axis="y")
    return fig


# ---------------------------------------------------------------- nhận xét
def judge(cpk):
    if cpk >= CPK_TARGET:
        return "đạt"
    if cpk >= 1.0:
        return "chưa đạt (biên)"
    return "không đạt"


def make_comments(df, lim, sig, cap_all, cap_shift, cmp):
    c = []
    n_out_x = int(((df.Xbar > lim["ucl_x"]) | (df.Xbar < lim["lcl_x"])).sum())
    n_out_r = int((df.R > lim["ucl_r"]).sum())
    if sig:
        n_runs = len(sig) - n_out_x - n_out_r
        txt = (f"<b>Quá trình chưa ổn định thống kê:</b> có {n_out_x} nhóm X̄ ngoài giới hạn, "
               f"{n_out_r} nhóm R vượt UCL<sub>R</sub>")
        txt += f" và {n_runs} chuỗi chạy dài (xem mục 2). " if n_runs else " (xem mục 2). "
        if n_out_r == 0:
            txt += ("Biểu đồ R ổn định → độ phân tán trong nhóm đồng đều; biến động chủ yếu "
                    "nằm ở <i>mức trung bình giữa các nhóm/ca</i>.")
        c.append(txt)
    else:
        c.append("Quá trình ổn định thống kê: không có điểm ngoài giới hạn hay chuỗi bất thường.")
    c.append(f"<b>Năng lực:</b> Cpk = {cap_all['cpk']:.2f}, Ppk = {cap_all['ppk']:.2f} — "
             f"{judge(cap_all['cpk'])} so với mục tiêu ≥ {CPK_TARGET}. Thực tế "
             f"{cap_all['obs_n']}/{cap_all['n']} mẫu ({cap_all['obs_pct']:.1f}%) dưới LSL; "
             f"ước tính theo phân phối chuẩn ≈ {cap_all['exp_pct']:.1f}%. "
             "Vì quá trình chưa ổn định, Cpk chỉ mang tính tham khảo — Ppk phản ánh sát thực tế hơn.")
    worst = min(cap_shift, key=lambda k: cap_shift[k]["ppk"])
    best = max(cap_shift, key=lambda k: cap_shift[k]["ppk"])
    c.append(f"<b>Theo ca:</b> {best} tốt nhất (Ppk = {cap_shift[best]['ppk']:.2f}); "
             f"{worst} kém nhất (Ppk = {cap_shift[worst]['ppk']:.2f}, "
             f"{cap_shift[worst]['obs_n']} mẫu dưới LSL).")
    p = cmp["anova"].pvalue
    sig_pairs = [t for t in cmp["tukey"] if t["p"] < 0.05]
    if p < 0.05:
        txt = ", ".join(f"{t['pair']} (chênh {t['diff']:+.3f}, p = {t['p']:.4f})" for t in sig_pairs)
        c.append(f"<b>So sánh ca:</b> trung bình 3 ca khác nhau có ý nghĩa thống kê "
                 f"(ANOVA p = {p:.2e}; kiểm chứng trên X̄ nhóm p = {cmp['anova_xbar'].pvalue:.2e}). "
                 f"Các cặp khác biệt (Tukey, α = 0.05): {txt}.")
    else:
        c.append(f"<b>So sánh ca:</b> chưa thấy khác biệt có ý nghĩa giữa các ca (ANOVA p = {p:.3f}).")
    c.append(f"<b>Khuyến nghị:</b> ưu tiên điều tra {worst} — so sánh thông số máy ghép "
             "(nhiệt độ/áp lực nip, lượng keo phủ, tỷ lệ pha keo, tốc độ), lô keo/màng sử dụng, "
             "người vận hành, thời gian & nhiệt độ ủ trước khi test, và thao tác test (tốc độ kéo, "
             "chuẩn bị mẫu). Sau khi khắc phục nguyên nhân đặc biệt, thu thập lại dữ liệu ≥ 25 nhóm "
             f"để tính lại giới hạn kiểm soát và Cpk. Mục tiêu nâng Cpk ≥ {CPK_TARGET}, tức trung bình "
             f"≥ {LSL + 3 * CPK_TARGET * cap_all['sigma_w']:.2f} {UNIT} với độ biến thiên hiện tại.")
    return c


# ---------------------------------------------------------------- HTML
def fig_to_b64(fig, name):
    OUT_DIR.mkdir(exist_ok=True)
    fig.savefig(OUT_DIR / f"{name}.png", dpi=130, bbox_inches="tight")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def table(headers, rows):
    th = "".join(f"<th>{h}</th>" for h in headers)
    tr = "".join("<tr>" + "".join(f"<td>{v}</td>" for v in r) + "</tr>" for r in rows)
    return f'<div class="tw"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'


CSS = """
:root{--bg:#fafafa;--fg:#1d1d1f;--muted:#666;--card:#fff;--line:#e3e3e6;--accent:#2a6fdb;--warn:#c23b5a}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ececec;--muted:#9a9a9f;--card:#1e1e21;--line:#333;--accent:#6ea0ff;--warn:#ff7a95}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.2rem;margin:36px 0 10px;border-bottom:2px solid var(--accent);padding-bottom:4px}
.sub{color:var(--muted);margin:0 0 20px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.kpi .v{font-size:1.5rem;font-weight:700}.kpi .l{color:var(--muted);font-size:.85rem}
.kpi.bad .v{color:var(--warn)}
.tw{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:var(--card);margin:8px 0;font-size:.92rem}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:right}th{background:var(--line)}
td:first-child,th:first-child{text-align:left}
img{max-width:100%;height:auto;background:#fff;border-radius:8px;border:1px solid var(--line);margin:8px 0}
.note{color:var(--muted);font-size:.88rem}
ul.cm li{margin-bottom:8px}
.box{background:var(--card);border-left:4px solid var(--accent);padding:12px 16px;border-radius:6px}
"""


def build_html(df, long, lim, sig, cap_all, cap_shift, cmp, imgs, comments):
    def f(x, d=3):
        return f"{x:.{d}f}"

    desc_rows = []
    for ca, g in zip(cmp["shifts"], cmp["groups"]):
        desc_rows.append([ca, len(g), f(g.mean()), f(g.std(ddof=1)), f(g.min(), 2), f(g.max(), 2),
                          int((g < LSL).sum())])
    cap_rows = [["Toàn bộ", cap_all["n"], f(cap_all["mean"]), f(cap_all["sigma_w"]),
                 f(cap_all["sigma_o"]), "N/A", f(cap_all["cpk"], 2), f(cap_all["ppk"], 2),
                 f"{cap_all['obs_pct']:.1f}%", f"{cap_all['exp_pct']:.2f}%", judge(cap_all["cpk"])]]
    for ca, cp in cap_shift.items():
        cap_rows.append([ca, cp["n"], f(cp["mean"]), f(cp["sigma_w"]), f(cp["sigma_o"]), "N/A",
                         f(cp["cpk"], 2), f(cp["ppk"], 2), f"{cp['obs_pct']:.1f}%",
                         f"{cp['exp_pct']:.2f}%", judge(cp["cpk"])])
    sub_rows = [[r.Nhom, f"{r.Ngay:%d/%m/%Y}", r.Ca,
                 " · ".join(f"{v:.2f}" for v in r[SAMPLE_COLS]), f(r.Xbar), f(r.R, 2)]
                for _, r in df.iterrows()]
    tukey_rows = [[t["pair"], f"{t['diff']:+.3f}", f"[{t['lo']:+.3f}; {t['hi']:+.3f}]",
                   f"{t['p']:.4f}", "Có" if t["p"] < 0.05 else "Không"] for t in cmp["tukey"]]
    sw = stats.shapiro(long["Peel"])
    sig_html = "".join(f"<li>{s}</li>" for s in sig) or "<li>Không có tín hiệu bất thường.</li>"
    period = f"{df.Ngay.min():%d/%m/%Y} – {df.Ngay.max():%d/%m/%Y}"
    kpi_bad = "bad" if cap_all["cpk"] < CPK_TARGET else ""
    structure = html.escape(", ".join(df["Cau_truc"].unique()))

    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Báo cáo Peel Strength</title><style>{CSS}</style></head>
<body><main>
<h1>Báo cáo SPC – Peel strength màng {structure}</h1>
<p class="sub">Giai đoạn {period} · {df.Ngay.nunique()} ngày × {df.Ca.nunique()} ca × 5 mẫu
 · LSL = {LSL} {UNIT} (không có USL)</p>

<div class="kpis">
 <div class="kpi"><div class="v">{f(cap_all['mean'])}</div><div class="l">Trung bình ({UNIT})</div></div>
 <div class="kpi {kpi_bad}"><div class="v">{f(cap_all['cpk'], 2)}</div><div class="l">Cpk (σ trong nhóm)</div></div>
 <div class="kpi {kpi_bad}"><div class="v">{f(cap_all['ppk'], 2)}</div><div class="l">Ppk (σ tổng)</div></div>
 <div class="kpi {'bad' if cap_all['obs_n'] else ''}"><div class="v">{cap_all['obs_n']}/{cap_all['n']}</div><div class="l">Mẫu dưới LSL</div></div>
 <div class="kpi {'bad' if sig else ''}"><div class="v">{len(sig)}</div><div class="l">Tín hiệu SPC</div></div>
</div>

<h2>1. Cấu trúc dữ liệu</h2>
<p>File <code>peel_test_mau.csv</code> gồm {len(df)} dòng, mỗi dòng là một <b>nhóm mẫu</b> (1 ca trong 1 ngày)
với các cột <code>Ngay</code>, <code>Ca</code>, <code>Cau_truc</code>, <code>Mau_1…Mau_5</code>.
Tổng {len(long)} giá trị, không có dữ liệu thiếu. Khoảng giá trị: {long.Peel.min():.2f} – {long.Peel.max():.2f} {UNIT}.</p>
<details><summary>Xem bảng dữ liệu theo nhóm</summary>
{table(["Nhóm", "Ngày", "Ca", "5 mẫu", "X̄", "R"], sub_rows)}</details>

<h2>2. Biểu đồ kiểm soát X̄ – R</h2>
<img src="data:image/png;base64,{imgs['xbar_r']}" alt="Biểu đồ X-bar R">
{table(["Biểu đồ", "CL", "UCL", "LCL"], [
    ["X̄", f(lim['xbb']), f(lim['ucl_x']), f(lim['lcl_x'])],
    ["R", f(lim['rbar']), f(lim['ucl_r']), f(lim['lcl_r'])]])}
<p class="note">n = 5: A2 = {A2}, D3 = {D3}, D4 = {D4}, d2 = {D2}. Mỗi nhóm = 5 mẫu của một ca.</p>
<p><b>Tín hiệu bất thường:</b></p><ul>{sig_html}</ul>

<h2>3. Năng lực quá trình (LSL = {LSL})</h2>
<img src="data:image/png;base64,{imgs['hist']}" alt="Histogram">
{table(["Phạm vi", "n", "TB", "σ trong nhóm", "σ tổng", "Cp", "Cpk", "Ppk", "% < LSL thực tế",
        "% < LSL ước tính", f"Đánh giá (≥ {CPK_TARGET})"], cap_rows)}
<p class="note"><b>Cp = N/A:</b> Cp = (USL − LSL)/6σ cần đủ hai giới hạn; với tiêu chuẩn một phía
chỉ tính được Cpk = Cpl = (μ − LSL)/3σ. σ trong nhóm = R̄/d2 (Cpk, ngắn hạn); σ tổng = độ lệch chuẩn
toàn bộ mẫu (Ppk, dài hạn). Cpk theo ca dùng R̄ của chính ca đó.
Kiểm định chuẩn Shapiro-Wilk toàn bộ dữ liệu: W = {sw.statistic:.3f}, p = {sw.pvalue:.3f}
({'phù hợp' if sw.pvalue >= 0.05 else 'lệch'} phân phối chuẩn ở α = 0.05).</p>

<h2>4. So sánh trung bình 3 ca</h2>
<img src="data:image/png;base64,{imgs['box']}" alt="Boxplot theo ca">
{table(["Ca", "n", "TB", "Độ lệch chuẩn", "Min", "Max", "Số mẫu < LSL"], desc_rows)}
{table(["Kiểm định", "Thống kê", "p-value", "Ý nghĩa"], [
    ["Levene (đồng nhất phương sai)", f(cmp['levene'].statistic), f"{cmp['levene'].pvalue:.4f}",
     "Phương sai tương đương" if cmp['levene'].pvalue >= 0.05 else "Phương sai khác nhau"],
    ["ANOVA một yếu tố (150 mẫu)", f(cmp['anova'].statistic, 2), f"{cmp['anova'].pvalue:.2e}",
     "Khác biệt có ý nghĩa" if cmp['anova'].pvalue < 0.05 else "Không khác biệt"],
    ["ANOVA trên X̄ nhóm (10/ca)", f(cmp['anova_xbar'].statistic, 2), f"{cmp['anova_xbar'].pvalue:.2e}",
     "Khác biệt có ý nghĩa" if cmp['anova_xbar'].pvalue < 0.05 else "Không khác biệt"],
    ["Kruskal-Wallis (phi tham số)", f(cmp['kruskal'].statistic, 2), f"{cmp['kruskal'].pvalue:.2e}",
     "Khác biệt có ý nghĩa" if cmp['kruskal'].pvalue < 0.05 else "Không khác biệt"]])}
<p><b>So sánh cặp – Tukey HSD (khoảng tin cậy 95%):</b></p>
{table(["Cặp ca", "Chênh lệch TB", "KTC 95%", "p-value", "Khác biệt?"], tukey_rows)}
<p class="note">5 mẫu trong cùng một ca/ngày không hoàn toàn độc lập, nên ANOVA trên X̄ nhóm được đưa
vào để kiểm chứng kết luận.</p>

<h2>5. Nhận xét &amp; khuyến nghị</h2>
<div class="box"><ul class="cm">{''.join(f'<li>{x}</li>' for x in comments)}</ul></div>
<p class="note">Báo cáo được tạo tự động bởi <code>peel_analysis.py</code>.</p>
</main></body></html>"""


def main():
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "peel_test_mau.csv"
    df, long = load_data(csv_path)
    lim = xbar_r_limits(df)
    sig = signals(df, lim)

    cap_all = capability(long["Peel"], lim["rbar"] / D2)
    cap_shift = {ca: capability(long.loc[long.Ca == ca, "Peel"],
                                df.loc[df.Ca == ca, "R"].mean() / D2)
                 for ca in sorted(df.Ca.unique())}
    cmp = compare_shifts(df, long)

    imgs = {
        "xbar_r": fig_to_b64(plot_xbar_r(df, lim), "xbar_r_chart"),
        "hist": fig_to_b64(plot_histogram(long, cap_all), "histogram_capability"),
        "box": fig_to_b64(plot_boxplot(cmp), "boxplot_ca"),
    }
    comments = make_comments(df, lim, sig, cap_all, cap_shift, cmp)
    REPORT.write_text(build_html(df, long, lim, sig, cap_all, cap_shift, cmp, imgs, comments),
                      encoding="utf-8")

    print(f"X̿ = {lim['xbb']:.3f}  R̄ = {lim['rbar']:.3f}  "
          f"UCLx = {lim['ucl_x']:.3f}  LCLx = {lim['lcl_x']:.3f}  UCLr = {lim['ucl_r']:.3f}")
    print(f"Cpk = {cap_all['cpk']:.2f}  Ppk = {cap_all['ppk']:.2f}  "
          f"< LSL: {cap_all['obs_n']}/{cap_all['n']}")
    for ca, cp in cap_shift.items():
        print(f"  {ca}: TB = {cp['mean']:.3f}  Cpk = {cp['cpk']:.2f}  Ppk = {cp['ppk']:.2f}")
    print(f"ANOVA p = {cmp['anova'].pvalue:.2e}")
    print("Tín hiệu:", *sig, sep="\n  ")
    print(f"Đã ghi báo cáo: {REPORT}")


if __name__ == "__main__":
    main()
