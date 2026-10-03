"""解析铁路电子客票发票XBRL实例为字典并打印。

使用方式:
  python script/test.py <车票文件路径>

支持的文件类型: .ofd / .pdf / 已解包的OFD目录 / rai_issuer_*.xml

未提供路径时,会尝试解析 private/ 下的默认车票;
若该目录为空(例如刚克隆的仓库),则打印用法提示退出。
private/ 目录包含个人真实票据,已被 .gitignore 忽略。
"""

from __future__ import annotations

import sys
import json
import pathlib
import decimal
from typing import Any, Dict, Optional

from lxml import etree
import tempfile
import shutil
import os
import zipfile

NAMESPACES = {
	"rai": "http://xbrl.mof.gov.cn/taxonomy/2021-11-30/rai",
	"xsi": "http://www.w3.org/2001/XMLSchema-instance",
}


def _local_name(tag: str) -> str:
	"""提取XML元素本地名。"""
	return tag.split("}")[-1] if "}" in tag else tag


def _parse_numeric(el: etree._Element) -> Any:
	text = (el.text or "").strip()
	if text == "":
		return None
	try:
		value = decimal.Decimal(text)
	except decimal.InvalidOperation:
		value = text
	data: Dict[str, Any] = {"value": value}
	unit = el.attrib.get("unitRef")
	if unit:
		data["unit"] = unit
	decimals = el.attrib.get("decimals")
	if decimals is not None:
		try:
			data["decimals"] = int(decimals)
		except ValueError:
			data["decimals"] = decimals
	return data


def parse_rai_invoice(path: pathlib.Path) -> Dict[str, Any]:
	"""解析给定rai铁路电子客票XBRL实例XML文件为字典。"""
	tree = etree.parse(str(path))
	root = tree.getroot()
	out: Dict[str, Any] = {}

	# 遍历直接子元素，只抓取 rai 命名空间下的业务字段
	for el in root:
		if not isinstance(el.tag, str):
			continue
		ns_rai_prefix = "{" + NAMESPACES["rai"] + "}"
		if not el.tag.startswith(ns_rai_prefix):
			continue
		name = _local_name(el.tag)
		# 处理 xsi:nil
		nil_attr = "{" + NAMESPACES["xsi"] + "}nil"
		if el.attrib.get(nil_attr) == "true":
			out[name] = None
			continue
		# 判断是否为数值（依据 unitRef / decimals 属性）
		if "unitRef" in el.attrib or "decimals" in el.attrib:
			out[name] = _parse_numeric(el)
		else:
			value = el.text.strip() if el.text else None
			out[name] = value
	return out


def _find_rai_xml_in_ofd_dir(ofd_dir: pathlib.Path) -> Optional[pathlib.Path]:
	"""在已解包的OFD目录中查找第一个以`rai_issuer_`开头的附件XML。"""
	attach_xml = ofd_dir / "Doc_0" / "Attachs" / "Attachments.xml"
	if not attach_xml.exists():
		return None
	doc = etree.parse(str(attach_xml))
	root = doc.getroot()
	# 兼容无命名空间或简单结构，寻找文件名节点
	candidates: list[str] = []
	for el in root.iter():
		tag = _local_name(el.tag) if isinstance(el.tag, str) else ""
		if tag.lower() in {"filename", "file", "path"}:
			text = (el.text or "").strip()
			if text:
				candidates.append(text)
	# 回退：直接扫描 Attachs 目录
	attachs_dir = ofd_dir / "Doc_0" / "Attachs"
	if attachs_dir.exists():
		for p in sorted(attachs_dir.iterdir()):
			if p.is_file():
				candidates.append(p.name)
	for name in candidates:
		base = os.path.basename(name)
		if base.startswith("rai_issuer_") and base.endswith(".xml"):
			candidate_path = attachs_dir / base if not os.path.isabs(name) else pathlib.Path(name)
			if candidate_path.exists():
				return candidate_path
	return None


def _extract_rai_xml_from_pdf(pdf_path: pathlib.Path) -> Optional[pathlib.Path]:
	"""从PDF的嵌入附件中提取第一个以`rai_issuer_`开头的XML到临时文件。"""
	import importlib.util, importlib
	spec = importlib.util.find_spec("PyPDF2")
	if spec is None:
		print("缺少PyPDF2，无法解析PDF附件。请安装PyPDF2。", file=sys.stderr)
		return None
	PyPDF2 = importlib.import_module("PyPDF2")
	reader = PyPDF2.PdfReader(str(pdf_path))

	def iter_embedded_files_from_names_dict(names_dict) -> list[tuple[str, Any]]:
		results = []
		if not names_dict:
			return results
		# /Names 直接列表
		if names_dict.get("/Names"):
			arr = names_dict.get("/Names")
			for i in range(0, len(arr), 2):
				try:
					nm = str(arr[i])
					spec_obj = arr[i + 1]
					results.append((nm, spec_obj))
				except Exception:
					continue
		# /Kids 子树
		if names_dict.get("/Kids"):
			for kid in names_dict.get("/Kids"):
				try:
					kid_dict = kid.get_object()
				except Exception:
					kid_dict = None
				results.extend(iter_embedded_files_from_names_dict(kid_dict))
		return results

	def extract_bytes_from_filespec(filespec) -> tuple[Optional[str], Optional[bytes]]:
		try:
			fs = filespec.get_object()
		except Exception:
			fs = filespec
		name = None
		try:
			# 优先使用 /UF （Unicode 文件名）
			name = fs.get("/UF") or fs.get("/F")
			if isinstance(name, bytes):
				name = name.decode("utf-8", errors="ignore")
			else:
				name = str(name)
		except Exception:
			name = None
		data = None
		try:
			ef = fs.get("/EF")
			stream = None
			if ef:
				stream = ef.get("/F") or ef.get("/UF")
			if stream is not None:
				data = stream.get_data()
		except Exception:
			data = None
		return name, data

	# 1) 从 /Root/Names/EmbeddedFiles 遍历所有附件
	try:
		names = reader.trailer["/Root"].get("/Names")
		embedded_dict = names.get("/EmbeddedFiles") if names else None
		pairs = iter_embedded_files_from_names_dict(embedded_dict)
		for nm, spec_obj in pairs:
			spec_name, spec_bytes = extract_bytes_from_filespec(spec_obj)
			candidate_name = spec_name or nm
			if candidate_name and candidate_name.startswith("rai_issuer_") and candidate_name.endswith(".xml") and spec_bytes:
				tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="rai_xml_"))
				out_path = tmpdir / candidate_name
				with open(out_path, "wb") as f:
					f.write(spec_bytes)
				return out_path
	except Exception:
		pass

	# 2) 尝试从页面注释中的文件附件 (/Annot with /Subtype /FileAttachment)
	try:
		for page in reader.pages:
			annots = page.get("/Annots") or []
			for annot in annots:
				try:
					ad = annot.get_object()
				except Exception:
					continue
				if ad.get("/Subtype") == "/FileAttachment":
					fs = ad.get("/FS")
					if fs is None:
						continue
					spec_name, spec_bytes = extract_bytes_from_filespec(fs)
					if spec_name and spec_name.startswith("rai_issuer_") and spec_name.endswith(".xml") and spec_bytes:
						tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="rai_xml_"))
						out_path = tmpdir / spec_name
						with open(out_path, "wb") as f:
							f.write(spec_bytes)
						return out_path
	except Exception:
		pass

	# 3) 某些PDF使用 /AF (Associated Files)，尝试读取
	try:
		af_arr = reader.trailer["/Root"].get("/AF") or []
		for fs in af_arr:
			spec_name, spec_bytes = extract_bytes_from_filespec(fs)
			if spec_name and spec_name.startswith("rai_issuer_") and spec_name.endswith(".xml") and spec_bytes:
				tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="rai_xml_"))
				out_path = tmpdir / spec_name
				with open(out_path, "wb") as f:
					f.write(spec_bytes)
				return out_path
	except Exception:
		pass
	return None


def resolve_xml_input(input_path: pathlib.Path) -> Optional[pathlib.Path]:
	"""根据输入路径自动识别并获取XML路径。

	- 若输入为PDF：提取附件中首个以`rai_issuer_`开头的XML。
	- 若输入为OFD已解包目录：查找 `Doc_0/Attachs` 中的首个以`rai_issuer_`开头的XML。
	- 若输入直接是XML文件：直接返回。
	"""
	if input_path.is_file():
		if input_path.suffix.lower() == ".pdf":
			return _extract_rai_xml_from_pdf(input_path)
		if input_path.suffix.lower() == ".xml":
			return input_path
		# 若是 .ofd 单文件：视为Zip包，解压到临时目录后继续
		if input_path.suffix.lower() == ".ofd":
			tmpdir = pathlib.Path(tempfile.mkdtemp(prefix="ofd_unpack_"))
			try:
				with zipfile.ZipFile(str(input_path), "r") as zf:
					zf.extractall(str(tmpdir))
			except zipfile.BadZipFile:
				print("OFD文件不是有效的Zip包，无法解压。", file=sys.stderr)
				return None
			# 解包目录可能含有顶层单一目录，做一次展开
			entries = list(tmpdir.iterdir())
			if len(entries) == 1 and entries[0].is_dir():
				ofd_root = entries[0]
			else:
				ofd_root = tmpdir
			return _find_rai_xml_in_ofd_dir(ofd_root)
	# 目录：尝试当作OFD已解包目录
	if input_path.is_dir():
		# 简单校验：目录下存在 OFD.xml 或 Doc_0
		if (input_path / "OFD.xml").exists() or (input_path / "Doc_0").exists():
			found = _find_rai_xml_in_ofd_dir(input_path)
			if found:
				return found
	# 兼容：若用户传到具体的 Attach 目录
	if input_path.name.lower() == "attachs" and input_path.is_dir():
		for p in sorted(input_path.iterdir()):
			if p.is_file() and p.name.startswith("rai_issuer_") and p.suffix.lower() == ".xml":
				return p
	return None


def _process_single_input(candidate_path: pathlib.Path) -> Optional[Dict[str, Any]]:
	xml_path = resolve_xml_input(candidate_path)
	if xml_path is None:
		print(f"未找到目标XML: {candidate_path}", file=sys.stderr)
		return None
	data = parse_rai_invoice(xml_path)
	return data


def main(argv: list[str]) -> None:
	if len(argv) > 1:
		candidate_path = pathlib.Path(argv[1])
	else:
		# 无参数时自动取 private/ 下任意一张车票；该目录已被 .gitignore
		# 忽略，全新克隆的仓库里不存在，此时给出用法提示而非报错。
		# 路径基于仓库根目录解析，因此从任意工作目录调用都能正确定位。
		repo_root = pathlib.Path(__file__).resolve().parent.parent
		private_dir = repo_root / "private"
		tickets = sorted(
			p for ext in ("*.ofd", "*.pdf")
			for p in private_dir.glob(ext)
		)
		if not tickets:
			print("用法: python script/test.py <车票文件路径>", file=sys.stderr)
			print("支持 .ofd / .pdf / 已解包OFD目录 / rai_issuer_*.xml", file=sys.stderr)
			print("把自己的车票放入 private/ 目录后可直接无参运行。", file=sys.stderr)
			sys.exit(1)
		candidate_path = tickets[0]
	if not candidate_path.exists():
		print(f"路径不存在: {candidate_path}", file=sys.stderr)
		sys.exit(1)
	# 若为普通目录（非OFD结构），逐一尝试处理目录内的文件/子目录
	is_ofd_like = (candidate_path / "OFD.xml").exists() or (candidate_path / "Doc_0").exists()
	if candidate_path.is_dir() and not is_ofd_like:
		results: Dict[str, Any] = {}
		for entry in sorted(candidate_path.iterdir()):
			data = _process_single_input(entry)
			if data is not None:
				results[str(entry.name)] = data
		if not results:
			print("目录中未成功解析任何票据附件。", file=sys.stderr)
			sys.exit(2)
		print(json.dumps(results, ensure_ascii=False, indent=2, default=str))
		return
	# 单文件、OFD目录或XML路径
	data = _process_single_input(candidate_path)
	if data is None:
		sys.exit(2)
	print(json.dumps(data, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":  # pragma: no cover
	main(sys.argv)


