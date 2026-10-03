#!/usr/bin/env python3
"""仓库隐私信息检查工具。

在推送公开仓库前扫描整个仓库,按严重程度分级报告个人敏感信息。

设计原则
--------
1. **分级而非一刀切**: 检出不等于泄露。工具给出 BLOCKER / WARNING /
   INFO 三档,由人判断误报;仓库不必零告警才算干净。
2. **不硬编码真实数据**: 脚本不写入任何真实姓名或证件号,否则
   自身即成泄露源。全部依赖通用模式 + 身份证 MOD 11-2 校验位。
3. **鲁棒优先**: 单项检查失败不应中断整体;二进制、超大文件、
   编码异常、git 不可用等情况均降级处理而非崩溃。

退出码
------
  0 = 无 BLOCKER（可能有 WARNING）
  1 = 存在 BLOCKER
  2 = 无法执行检查（不在 Git 仓库中 / git 不可用）
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import pathlib
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Iterator, Optional

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

# ── 扫描参数 ────────────────────────────────────────────────────
MAX_TEXT_BYTES = 5 * 1024 * 1024   # 超过此大小视为非文本,跳过
GIT_TIMEOUT = 60                    # 单次 git 调用超时(秒)
BINARY_SNIFF = 8192                 # 二进制嗅探窗口

SKIP_DIRS = {
    ".git", ".venv", "venv", "node_modules", "dist", "dist-ssr",
    "__pycache__", ".idea", ".vscode", ".pytest_cache", ".mypy_cache",
}

# 按文件名跳过的文件（多为系统元数据，扫了只会产生噪声）
SKIP_FILES = {".DS_Store", "Thumbs.db", "desktop.ini"}

# 允许出现敏感字段的公开资料目录
# 财政部《电子凭证会计数据标准》及其官方实例文档,本就公开发布且已脱敏
PUBLIC_DIRS = ("reference/",)

# 已知无害的合成数据(代码注释/文档示例)
ALLOWLIST: list[tuple[str, str]] = [
    (
        r"123456200401011234",
        "ticketImageGenerator.ts 中脱敏函数的格式示例,123456 为虚构区划码",
    ),
    (
        r"12345678901234567890",
        "SVG_IMPLEMENTATION_SUMMARY.md 占位符对照表中的合成票号,连号易辨识",
    ),
]

# 只对这些后缀尝试文本扫描;其余靠二进制嗅探兜底
TEXT_SUFFIXES = {
    "", ".ts", ".tsx", ".vue", ".js", ".jsx", ".mjs", ".cjs", ".md",
    ".json", ".py", ".css", ".scss", ".less", ".html", ".xml", ".svg",
    ".yaml", ".yml", ".toml", ".txt", ".xsd", ".gitignore", ".env.example",
}


class Severity(IntEnum):
    """检出严重程度。数值越大越严重。"""
    INFO = 1     # 已豁免或可忽略,仅作提示
    WARNING = 2  # 疑似敏感,需人工确认
    BLOCKER = 3  # 确认敏感,推送前必须处理


SEVERITY_LABEL = {
    Severity.BLOCKER: "BLOCKER",
    Severity.WARNING: "WARNING",
    Severity.INFO: "INFO",
}

SEVERITY_ICON = {
    Severity.BLOCKER: "🔴",
    Severity.WARNING: "🟡",
    Severity.INFO: "⚪",
}


# ── 身份证 MOD 11-2 校验 ────────────────────────────────────────
_ID_WEIGHTS = (7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2)
_ID_CHECK_CHARS = "10X98765432"


def is_valid_cn_id(value: str) -> bool:
    """校验 18 位中国大陆身份证号的 MOD 11-2 校验位。

    通过校验位验证可把误报压到极低——任意 18 位数字几乎不可能恰好
    校验位正确,因此这是区分"真实证件号"与"合成示例"的最强信号。
    """
    if len(value) != 18 or not value[:17].isdigit():
        return False
    if not (value[17].isdigit() or value[17] in "Xx"):
        return False
    total = sum(int(value[i]) * _ID_WEIGHTS[i] for i in range(17))
    return _ID_CHECK_CHARS[total % 11] == value[17].upper()


# ── 检测规则 ────────────────────────────────────────────────────
@dataclass
class Rule:
    name: str
    pattern: re.Pattern
    reason: str
    severity: Severity
    # 需通过身份证校验位二次确认；不通过则降级为 INFO
    require_id_checksum: bool = False


RULES: list[Rule] = [
    Rule(
        name="完整身份证号",
        pattern=re.compile(r"(?<![0-9A-Za-z])[1-9]\d{5}(?:19|20)\d{2}"
                           r"(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])"
                           r"\d{3}[\dXx](?![0-9A-Za-z])"),
        reason="完整身份证号,凭此可查实名信息",
        severity=Severity.BLOCKER,
        require_id_checksum=True,
    ),
    Rule(
        name="部分脱敏身份证号",
        pattern=re.compile(r"(?<![0-9A-Za-z])\d{6,10}\*{2,8}\d{4}(?![0-9A-Za-z])"),
        reason="部分脱敏的身份证号,首尾数字仍足以定位到个人",
        severity=Severity.WARNING,
    ),
    Rule(
        name="长数字票据号",
        # 铁路电子客票号实测 25 位,发票号码 20 位,统一覆盖 20~25
        pattern=re.compile(r"(?<!\d)\d{20,25}(?!\d)"),
        reason="电子客票号/发票号码,配合姓名可核验乘车记录",
        severity=Severity.WARNING,
    ),
    Rule(
        name="铁路票据身份字段",
        pattern=re.compile(
            r"<(?:rai:)?(?:IdNumber|Name|NameOfPurchaser|"
            r"AddressPhoneNumberOfPurchaser|"
            r"DepositBankAndAccountNumberOfPurchaser)[^>]*>[^<]+<"
        ),
        reason="电子客票 XML 中的个人身份字段",
        severity=Severity.BLOCKER,
    ),
    Rule(
        name="中国大陆手机号",
        pattern=re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
        reason="手机号",
        severity=Severity.BLOCKER,
    ),
    Rule(
        name="疑似真实区划码的证件示例",
        # 身份证前 2 位是省级行政区划代码。真实区划码即使拼在合成示例里，
        # 也会泄露籍贯与出生年——这类串常因日期或校验位无效而被降级为
        # INFO 从而隐身，因此单列一条 WARNING 级规则兜底。
        # 此处刻意不校验日期与校验位：正是要覆盖日期不合法的情况。
        pattern=re.compile(
            r"(?<![0-9A-Za-z])"
            r"(?:1[1-5]|2[1-3]|3[1-7]|4[1-6]|5[0-4]|6[1-5]|7[1]|8[12])"
            r"[0-9]{4}(?:19|20)[0-9]{2}[0-9]{4}[0-9]{3}[0-9Xx]"
            r"(?![0-9A-Za-z])"
        ),
        reason="示例串带真实省级区划码,可推出籍贯与出生年份",
        severity=Severity.WARNING,
    ),
    Rule(
        name="统一社会信用代码",
        # USCC 排除 I/O/S/V/Z 四个易混淆字符,借此避免误匹配哈希值
        pattern=re.compile(r"(?<![0-9A-Z])[0-9A-HJ-NP-RT-UW-Y]{18}(?![0-9A-Z])"),
        reason="购买方统一社会信用代码,可关联到具体单位",
        severity=Severity.INFO,
    ),
]


@dataclass
class Finding:
    severity: Severity
    location: str
    line_no: int
    rule_name: str
    reason: str
    snippet: str


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str
    degraded: bool = False


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)
    exempt: list[tuple[str, str]] = field(default_factory=list)
    checks: list[CheckResult] = field(default_factory=list)

    def count(self, severity: Severity) -> int:
        return sum(1 for f in self.findings if f.severity is severity)

    @property
    def has_blocker(self) -> bool:
        return self.count(Severity.BLOCKER) > 0

    @property
    def has_warning(self) -> bool:
        return self.count(Severity.WARNING) > 0


# ── 安全读取 ────────────────────────────────────────────────────
def looks_binary(path: pathlib.Path) -> bool:
    """通过嗅探 NUL 字节判断是否为二进制,比只看后缀可靠。"""
    try:
        with path.open("rb") as fh:
            return b"\x00" in fh.read(BINARY_SNIFF)
    except OSError:
        return True


def read_text_safe(path: pathlib.Path) -> Optional[str]:
    """读取文本内容,失败或非文本时返回 None。不抛异常。"""
    try:
        if path.stat().st_size > MAX_TEXT_BYTES:
            return None
    except OSError:
        return None
    if looks_binary(path):
        return None
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def run_git(args: list[str], repo: pathlib.Path) -> Optional[str]:
    """执行 git 命令,失败或超时返回 None 而非抛出。"""
    try:
        proc = subprocess.run(
            ["git", *args], cwd=repo, capture_output=True,
            text=True, errors="replace", timeout=GIT_TIMEOUT,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


# ── 扫描核心 ────────────────────────────────────────────────────
ALLOW_RES = [(re.compile(p), why) for p, why in ALLOWLIST]


def is_allowlisted(text: str) -> Optional[str]:
    for regex, why in ALLOW_RES:
        if regex.search(text):
            return why
    return None


def in_public_dir(path: str) -> bool:
    norm = path.replace("\\", "/")
    return any(norm.startswith(p) or f"/{p}" in norm for p in PUBLIC_DIRS)


def scan_text(text: str, location: str) -> Iterator[Finding]:
    """扫描文本,产出命中项。

    跨规则做重叠抑制——同一段字符已被高置信度规则命中时,不再被
    低置信度规则重复报告,避免同一处风险出现多条记录。
    """
    for line_no, line in enumerate(text.splitlines(), start=1):
        why = is_allowlisted(line)
        if why:
            yield Finding(Severity.INFO, location, line_no, "已豁免", why, line.strip()[:90])
            continue
        claimed: list[tuple[int, int]] = []

        # 按严重程度降序扫描：高危规则先占位,避免被低危规则的重叠
        # 匹配压制（例如 rai:IdNumber 行应报"铁路身份字段"而非"部分脱敏"）
        for rule in sorted(RULES, key=lambda r: r.severity, reverse=True):
            for match in rule.pattern.finditer(line):
                span = match.span()
                if any(span[0] < end and start < span[1] for start, end in claimed):
                    continue  # 与已报告的命中重叠
                value = match.group(0)
                severity = rule.severity
                if rule.require_id_checksum and not is_valid_cn_id(value):
                    severity = Severity.INFO  # 校验位不符 → 多半是合成数据
                if in_public_dir(location):
                    severity = Severity.INFO  # 财政部公开文档
                snippet = line.strip()
                if len(snippet) > 90:
                    snippet = snippet[:90] + "…"
                if severity > Severity.INFO:
                    # 仅"需处理"的命中才占位。若高危规则因校验位/公开目录
                    # 降级为 INFO 后仍占位，会把后续真正要报告的风险压制掉。
                    claimed.append(span)
                yield Finding(severity, location, line_no, rule.name, rule.reason, snippet)


def should_skip_path(path: pathlib.Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


# ── 各项检查（各自独立，单项失败不影响其他）────────────────────
def check_gitignore(report: Report) -> None:
    name = ".gitignore 规则"
    gitignore = REPO_ROOT / ".gitignore"
    if not gitignore.exists():
        report.checks.append(CheckResult(name, False, "文件不存在"))
        return
    try:
        text = gitignore.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        report.checks.append(CheckResult(name, False, f"读取失败: {exc}", degraded=True))
        return
    missing = [r for r in ("/private/", "/design/") if r not in text]
    ok = not missing
    detail = "私人目录规则齐备" if ok else f"缺少规则: {missing}"
    report.checks.append(CheckResult(name, ok, detail))


def check_tracked_paths(report: Report) -> None:
    name = "已跟踪文件路径"
    out = run_git(["ls-files"], REPO_ROOT)
    if out is None:
        report.checks.append(CheckResult(name, False, "无法执行 git ls-files", degraded=True))
        return
    tracked = [line for line in out.splitlines() if line]
    # private/ 与 design/ 已被整体排除，其中任何文件都不应被跟踪
    leaked = [p for p in tracked
              if p.startswith(("private/", "design/", "example/"))]
    numbered = [p for p in tracked
                if re.search(r"(?<!\d)\d{16,}(?!\d)", pathlib.Path(p).name)]
    ok = not leaked and not numbered
    parts = []
    if leaked:
        parts.append(f"私人路径被跟踪: {leaked[:3]}")
    if numbered:
        parts.append(f"文件名含长数字串: {numbered[:3]}")
    detail = f"无私人路径被跟踪（共 {len(tracked)} 个）" if ok else "  ".join(parts)
    report.checks.append(CheckResult(name, ok, detail))
    if numbered and not leaked:
        report.findings.append(Finding(
            Severity.WARNING, "<仓库文件名>", 0, "文件名含长数字串",
            "文件名直接携带发票号/票号,建议改为无意义名称",
            "; ".join(numbered[:5]),
        ))


def check_history(report: Report) -> None:
    name = "Git 历史内容"
    out = run_git(["rev-list", "--objects", "--all"], REPO_ROOT)
    if out is None:
        report.checks.append(CheckResult(name, False, "无法执行 git rev-list", degraded=True))
        return

    entries: list[tuple[str, str]] = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split(" ", 1)   # 路径本身可能含空格,只切一次
        entries.append((parts[0], parts[1] if len(parts) > 1 else ""))

    scanned = skipped = failed = 0
    start = len(report.findings)
    for obj, name_path in entries:
        if not name_path or should_skip_path(pathlib.Path(name_path)):
            continue
        if pathlib.Path(name_path).suffix.lower() not in TEXT_SUFFIXES:
            skipped += 1
            continue
        cat = run_git(["cat-file", "-p", obj], REPO_ROOT)
        if cat is None:
            failed += 1
            continue
        scanned += 1
        report.findings.extend(scan_text(cat, name_path))

    new = [f for f in report.findings[start:] if f.severity > Severity.INFO]
    detail = f"已扫描 {scanned} 个文本对象（跳过二进制 {skipped}）"
    if failed:
        detail += f"，{failed} 个对象读取失败"
    report.checks.append(CheckResult(name, not new, detail, degraded=bool(failed)))


def check_worktree(report: Report) -> None:
    name = "工作区文本文件"
    scanned = unreadable = 0
    start = len(report.findings)
    try:
        iterator = REPO_ROOT.rglob("*")
    except OSError as exc:
        report.checks.append(CheckResult(name, False, f"遍历失败: {exc}", degraded=True))
        return

    for path in iterator:
        try:
            if not path.is_file():
                continue
            rel = path.relative_to(REPO_ROOT)
        except (OSError, ValueError):
            unreadable += 1
            continue
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if rel.name in SKIP_FILES:
            continue
        if rel.parts and rel.parts[0] in ("private", "design"):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        text = read_text_safe(path)
        if text is None:
            unreadable += 1
            continue
        scanned += 1
        report.findings.extend(scan_text(text, str(rel)))

    new = [f for f in report.findings[start:] if f.severity > Severity.INFO]
    detail = f"已扫描 {scanned} 个文件"
    if unreadable:
        detail += f"，{unreadable} 个非文本/不可读已跳过"
    report.checks.append(CheckResult(name, not new, detail, degraded=bool(unreadable)))


CHECKS = (
    ("配置", check_gitignore),
    ("配置", check_tracked_paths),
    ("历史", check_history),
    ("工作区", check_worktree),
)


# ── 报告输出 ────────────────────────────────────────────────────
def print_report(report: Report, strict: bool) -> None:
    print("=" * 64)
    print("  仓库隐私信息检查")
    print("=" * 64)

    print("\n【配置检查】")
    for chk in report.checks:
        mark = "✅" if chk.ok else ("⚠️ " if chk.degraded else "❌")
        suffix = "（降级）" if chk.degraded else ""
        print(f"  {mark} {chk.name}{suffix}")
        print(f"     {chk.detail}")

    actionable = [f for f in report.findings if f.severity >= Severity.WARNING]
    exempt = [f for f in report.findings if f.severity is Severity.INFO]

    if not actionable:
        print("\n【内容扫描】")
        print("  ✅ 未发现需处理的风险")
    else:
        print(f"\n【检出】需处理 {len(actionable)} 处，已豁免/提示 {len(exempt)} 处\n")
        for severity in (Severity.BLOCKER, Severity.WARNING):
            items = [f for f in actionable if f.severity is severity]
            if not items:
                continue
            print(f"  {SEVERITY_ICON[severity]} {SEVERITY_LABEL[severity]} — {len(items)} 处")
            for rule_name in dict.fromkeys(f.rule_name for f in items):
                same = [f for f in items if f.rule_name == rule_name]
                print(f"\n    ▸ {rule_name} — {same[0].reason}")
                for f in same[:6]:
                    print(f"      {f.location}:{f.line_no}")
                    print(f"        {f.snippet}")
                if len(same) > 6:
                    print(f"      … 另有 {len(same) - 6} 处")
            print()

    if exempt:
        print(f"  ⚪ INFO（{len(exempt)} 处，已豁免或可忽略）")
        seen: set[str] = set()
        for f in exempt:
            if f.reason in seen:
                continue
            seen.add(f.reason)
            print(f"      · {f.reason}")
        print()

    print("\n" + "-" * 64)
    if report.has_blocker:
        print("  ❌ 存在 BLOCKER：推送公开仓库前必须处理")
    elif report.has_warning and strict:
        print("  ❌ 严格模式：存在 WARNING，判定为不通过")
    elif report.has_warning:
        print("  🟡 无 BLOCKER，但有 WARNING 需人工确认")
        print("     （确认无误可忽略；--strict 可将 WARNING 也判为不通过）")
    else:
        print("  ✅ 检查通过：仓库可安全公开")
    print("-" * 64)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="扫描仓库中的个人敏感信息，按严重程度分级报告"
    )
    parser.add_argument("--strict", action="store_true",
                        help="将 WARNING 也视为不通过")
    args = parser.parse_args()

    if not (REPO_ROOT / ".git").exists():
        print("未在 Git 仓库中运行，无法检查历史", file=sys.stderr)
        return 2
    if run_git(["rev-parse", "--git-dir"], REPO_ROOT) is None:
        print("git 不可用，无法执行检查", file=sys.stderr)
        return 2

    report = Report()
    for _, func in CHECKS:
        try:
            func(report)
        except Exception as exc:  # noqa: BLE001 — 单项失败不应中断整体
            report.checks.append(CheckResult(
                getattr(func, "__name__", "未知检查"), False,
                f"检查异常: {type(exc).__name__}: {exc}", degraded=True,
            ))

    print_report(report, args.strict)
    if report.has_blocker or (args.strict and report.has_warning):
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
