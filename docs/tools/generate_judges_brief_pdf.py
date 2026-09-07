#!/usr/bin/env python3
"""Generate the branded Kuapa Dwaso competition judges' brief.

The source of truth is docs/product/judges-brief.md. This dedicated generator
supports the richer editorial features used by that document: front matter,
internal links, PDF bookmarks, tables, field photographs, quotations, numbered
and bulleted lists, and the established Kuapa Dwaso cover treatment.

Usage:
    python docs/tools/generate_judges_brief_pdf.py
    python docs/tools/generate_judges_brief_pdf.py input.md output.pdf
"""

from __future__ import annotations

import argparse
import html
import os
import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "docs" / "product" / "judges-brief.md"
DEFAULT_OUTPUT = REPO_ROOT / "output" / "pdf" / "kuapa-dwaso-judges-brief.pdf"
DEFAULT_COVER_IMAGE = REPO_ROOT / "docs" / "blog-drafts" / "images" / "5.png"
DEFAULT_LOGO = REPO_ROOT / "docs" / "kuapa_dwaso_logo.png"

PAGE_WIDTH, PAGE_HEIGHT = letter
CONTENT_LEFT = 54
CONTENT_RIGHT = 54
CONTENT_TOP = 62
CONTENT_BOTTOM = 58
CONTENT_WIDTH = PAGE_WIDTH - CONTENT_LEFT - CONTENT_RIGHT

INK = colors.HexColor("#0F1F14")
FIELD = colors.HexColor("#2D8A4E")
FIELD_LIGHT = colors.HexColor("#38A85C")
GOLD = colors.HexColor("#D4A843")
SURFACE = colors.HexColor("#F5F7F0")
SURFACE_STRONG = colors.HexColor("#E7EFE4")
LINE = colors.HexColor("#DDE3D5")
GRAY_700 = colors.HexColor("#3A4048")
GRAY_500 = colors.HexColor("#6B7280")
WHITE = colors.white


@dataclass(frozen=True)
class Metadata:
    title: str
    subtitle: str
    document_type: str
    status: str
    date: str
    project: str
    location: str


@dataclass(frozen=True)
class Block:
    kind: str
    value: object
    level: int = 0


class BookmarkAnchor(Flowable):
    def __init__(
        self,
        bookmark_key: str,
        bookmark_title: str,
        bookmark_level: int,
    ) -> None:
        super().__init__()
        self.bookmark_key = bookmark_key
        self.bookmark_title = bookmark_title
        self.bookmark_level = bookmark_level
        self.width = 0
        self.height = 0

    def wrap(self, available_width: float, available_height: float) -> tuple[float, float]:
        return 0, 0

    def draw(self) -> None:
        return


class KuapaDocTemplate(BaseDocTemplate):
    """Add named destinations and sidebar outline entries for headings."""

    def afterFlowable(self, flowable: Flowable) -> None:  # noqa: N802
        if not isinstance(flowable, BookmarkAnchor):
            return
        self.canv.bookmarkPage(flowable.bookmark_key)
        self.canv.addOutlineEntry(
            flowable.bookmark_title,
            flowable.bookmark_key,
            level=flowable.bookmark_level,
            closed=flowable.bookmark_level > 0,
        )


def register_fonts() -> None:
    windows_fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = {
        "KD-Body": windows_fonts / "segoeui.ttf",
        "KD-Semibold": windows_fonts / "seguisb.ttf",
        "KD-Bold": windows_fonts / "segoeuib.ttf",
        "KD-Italic": windows_fonts / "segoeuii.ttf",
    }
    fallbacks = {
        "KD-Body": "Helvetica",
        "KD-Semibold": "Helvetica-Bold",
        "KD-Bold": "Helvetica-Bold",
        "KD-Italic": "Helvetica-Oblique",
    }
    for name, path in candidates.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
        else:
            pdfmetrics.registerFont(pdfmetrics.Font(name, fallbacks[name], "WinAnsiEncoding"))
    pdfmetrics.registerFontFamily(
        "KD-Body",
        normal="KD-Body",
        bold="KD-Bold",
        italic="KD-Italic",
        boldItalic="KD-Bold",
    )


def normalize_text(value: str) -> str:
    replacements = {
        "\u00a0": " ",
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u2192": "->",
        "\u2026": "...",
        "\u00f7": "/",
        "₵": "",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value.strip()


def slugify(value: str) -> str:
    value = value.replace("₵", "")
    value = normalize_text(value).lower()
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s-]+", "-", value).strip("-")
    return value or "section"


def inline_markup(value: str) -> str:
    escaped = html.escape(normalize_text(value), quote=False)

    def link_replacement(match: re.Match[str]) -> str:
        label, href = match.group(1), match.group(2)
        if href.startswith("#"):
            target = f"#{slugify(href[1:])}"
        else:
            target = href
        return f'<link href="{html.escape(target, quote=True)}" color="#2D8A4E"><u>{label}</u></link>'

    escaped = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link_replacement, escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", escaped)
    escaped = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', escaped)
    return escaped


def parse_front_matter(lines: list[str]) -> tuple[Metadata, int]:
    values: dict[str, str] = {}
    cursor = 0
    if lines and lines[0].strip() == "---":
        cursor = 1
        while cursor < len(lines) and lines[cursor].strip() != "---":
            line = lines[cursor]
            if ":" in line:
                key, value = line.split(":", 1)
                values[key.strip()] = value.strip().strip('"')
            cursor += 1
        cursor += 1
    return (
        Metadata(
            title=values.get("title", "Kuapa Dwaso: Demand Before Movement"),
            subtitle=values.get("subtitle", "Field evidence, operating model and 90-day pilot"),
            document_type=values.get("documentType", "Competition judges' explanatory brief"),
            status=values.get("status", "Draft for team review"),
            date=values.get("date", "12 August 2026"),
            project=values.get("project", "Kuapa Dwaso"),
            location=values.get("location", "Western Region, Ghana"),
        ),
        cursor,
    )


def parse_markdown(source: str) -> tuple[Metadata, list[Block]]:
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    metadata, cursor = parse_front_matter(lines)

    # The cover replaces the repeated title block in the Markdown. Begin with
    # the audience-facing note that follows it.
    for index in range(cursor, len(lines)):
        if lines[index].strip().lower() == "## a note to the judges":
            cursor = index
            break

    blocks: list[Block] = []
    paragraph: list[str] = []
    quote: list[str] = []
    list_items: list[str] = []
    list_kind = ""

    def flush_paragraph() -> None:
        if paragraph:
            blocks.append(Block("paragraph", " ".join(item.strip() for item in paragraph)))
            paragraph.clear()

    def flush_quote() -> None:
        if quote:
            blocks.append(Block("quote", list(quote)))
            quote.clear()

    def flush_list() -> None:
        nonlocal list_kind
        if list_items:
            blocks.append(Block(list_kind, list(list_items)))
            list_items.clear()
            list_kind = ""

    while cursor < len(lines):
        raw = lines[cursor]
        stripped = raw.strip()

        image_match = re.match(r"^!\[([^]]*)\]\(([^)]+)\)$", stripped)
        if image_match:
            flush_paragraph()
            flush_quote()
            flush_list()
            blocks.append(Block("image", (image_match.group(1), image_match.group(2))))
            cursor += 1
            continue

        if stripped == "---":
            flush_paragraph()
            flush_quote()
            flush_list()
            blocks.append(Block("rule", ""))
            cursor += 1
            continue

        heading_match = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if heading_match:
            flush_paragraph()
            flush_quote()
            flush_list()
            blocks.append(Block("heading", heading_match.group(2), len(heading_match.group(1))))
            cursor += 1
            continue

        if stripped.startswith("|") and cursor + 1 < len(lines):
            separator = lines[cursor + 1].strip()
            if separator.startswith("|") and re.fullmatch(r"[|:\-\s]+", separator):
                flush_paragraph()
                flush_quote()
                flush_list()
                table_lines = [stripped]
                cursor += 2
                while cursor < len(lines) and lines[cursor].strip().startswith("|"):
                    table_lines.append(lines[cursor].strip())
                    cursor += 1
                rows = [
                    [cell.strip() for cell in row.strip("|").split("|")]
                    for row in table_lines
                ]
                blocks.append(Block("table", rows))
                continue

        if stripped.startswith(">"):
            flush_paragraph()
            flush_list()
            quote.append(stripped[1:].strip())
            cursor += 1
            continue
        flush_quote()

        unordered = re.match(r"^[-*]\s+(.+)$", stripped)
        ordered = re.match(r"^\d+\.\s+(.+)$", stripped)
        if unordered or ordered:
            flush_paragraph()
            next_kind = "ordered" if ordered else "list"
            if list_kind and list_kind != next_kind:
                flush_list()
            list_kind = next_kind
            list_items.append((ordered or unordered).group(1))
            cursor += 1
            continue
        flush_list()

        if not stripped:
            flush_paragraph()
            cursor += 1
            continue

        paragraph.append(stripped)
        cursor += 1

    flush_paragraph()
    flush_quote()
    flush_list()
    return metadata, blocks


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            fontName="KD-Bold",
            fontSize=32,
            leading=35,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
        "cover_subtitle": ParagraphStyle(
            "CoverSubtitle",
            fontName="KD-Semibold",
            fontSize=10.5,
            leading=14,
            textColor=GOLD,
            alignment=TA_CENTER,
            tracking=1.5,
        ),
        "cover_meta": ParagraphStyle(
            "CoverMeta",
            fontName="KD-Semibold",
            fontSize=9.8,
            leading=14,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=sample["Heading1"],
            fontName="KD-Bold",
            fontSize=20,
            leading=24,
            textColor=INK,
            spaceAfter=0,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=sample["Heading2"],
            fontName="KD-Bold",
            fontSize=14.5,
            leading=18,
            textColor=FIELD,
            spaceBefore=8,
            spaceAfter=6,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=sample["Heading3"],
            fontName="KD-Bold",
            fontSize=12,
            leading=15,
            textColor=INK,
            spaceBefore=6,
            spaceAfter=4,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=sample["BodyText"],
            fontName="KD-Body",
            fontSize=10.6,
            leading=15.4,
            textColor=GRAY_700,
            spaceAfter=7,
            allowWidows=0,
            allowOrphans=0,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            fontName="KD-Body",
            fontSize=10.3,
            leading=14.8,
            textColor=GRAY_700,
        ),
        "table": ParagraphStyle(
            "TableBody",
            fontName="KD-Body",
            fontSize=8.7,
            leading=11.7,
            textColor=GRAY_700,
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            fontName="KD-Bold",
            fontSize=8.8,
            leading=11.7,
            textColor=WHITE,
        ),
        "quote": ParagraphStyle(
            "Quote",
            fontName="KD-Italic",
            fontSize=11.2,
            leading=16.5,
            textColor=INK,
        ),
        "caption": ParagraphStyle(
            "Caption",
            fontName="KD-Italic",
            fontSize=8.4,
            leading=11.3,
            textColor=GRAY_500,
            alignment=TA_CENTER,
            spaceAfter=7,
        ),
    }


def cover_background(canv: canvas.Canvas, image_path: Path) -> None:
    with PILImage.open(image_path) as image:
        image_width, image_height = image.size
    scale = max(PAGE_WIDTH / image_width, PAGE_HEIGHT / image_height)
    draw_width = image_width * scale
    draw_height = image_height * scale
    canv.drawImage(
        str(image_path),
        (PAGE_WIDTH - draw_width) / 2,
        (PAGE_HEIGHT - draw_height) / 2,
        width=draw_width,
        height=draw_height,
        mask="auto",
    )
    canv.setFillColor(INK)
    canv.setFillAlpha(0.87)
    canv.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
    canv.setFillAlpha(1)


def draw_cover(canv: canvas.Canvas, doc: BaseDocTemplate, metadata: Metadata) -> None:
    canv.saveState()
    canv.setTitle(metadata.title)
    canv.setAuthor("Kuapa Dwaso")
    canv.setSubject("Kuapa Dwaso operating model, field evidence and 90-day competition pilot")
    cover_background(canv, DEFAULT_COVER_IMAGE)
    styles = build_styles()

    if DEFAULT_LOGO.exists():
        canv.drawImage(
            str(DEFAULT_LOGO),
            PAGE_WIDTH / 2 - 38,
            565,
            width=76,
            height=76,
            preserveAspectRatio=True,
            mask="auto",
            anchor="c",
        )

    title = Paragraph("KUAPA DWASO", styles["cover_title"])
    title.wrapOn(canv, 500, 48)
    title.drawOn(canv, 56, 488)

    promise = Paragraph("DEMAND BEFORE MOVEMENT", styles["cover_subtitle"])
    promise.wrapOn(canv, 500, 25)
    promise.drawOn(canv, 56, 455)

    explainer = Paragraph(
        "FIELD EVIDENCE, OPERATING MODEL &amp; 90-DAY PILOT",
        ParagraphStyle(
            "CoverExplainer",
            parent=styles["cover_meta"],
            fontSize=11.5,
            leading=15,
            textColor=colors.HexColor("#DDE3D5"),
        ),
    )
    explainer.wrapOn(canv, 450, 36)
    explainer.drawOn(canv, 81, 408)

    canv.setStrokeColor(GOLD)
    canv.setLineWidth(2.4)
    canv.line(72, 128, PAGE_WIDTH - 72, 128)

    meta = Paragraph(
        "Prepared for the GDSS-PSInno AgriTech Innovation Challenge judges<br/>"
        f'<font color="#DDE3D5">{html.escape(metadata.date)} · {html.escape(metadata.location)}</font><br/>'
        '<font color="#38A85C">info@kuapadwaso.com</font>',
        styles["cover_meta"],
    )
    meta.wrapOn(canv, 450, 52)
    meta.drawOn(canv, 81, 75)

    canv.setFont("KD-Semibold", 8)
    canv.setFillColor(FIELD_LIGHT)
    canv.drawCentredString(PAGE_WIDTH / 2, 42, "KUAPADWASO.COM")
    canv.restoreState()


def draw_content_chrome(canv: canvas.Canvas, doc: BaseDocTemplate) -> None:
    canv.saveState()
    canv.setStrokeColor(LINE)
    canv.setLineWidth(0.5)
    canv.line(CONTENT_LEFT, PAGE_HEIGHT - 37, PAGE_WIDTH - CONTENT_RIGHT, PAGE_HEIGHT - 37)
    canv.line(CONTENT_LEFT, 38, PAGE_WIDTH - CONTENT_RIGHT, 38)
    canv.setFont("KD-Bold", 7.3)
    canv.setFillColor(INK)
    canv.drawString(CONTENT_LEFT, PAGE_HEIGHT - 28, "KUAPA DWASO")
    canv.setFont("KD-Body", 7)
    canv.setFillColor(GRAY_500)
    canv.drawRightString(PAGE_WIDTH - CONTENT_RIGHT, PAGE_HEIGHT - 28, "DEMAND BEFORE MOVEMENT")
    canv.setFont("KD-Bold", 7.3)
    canv.setFillColor(FIELD)
    canv.drawString(CONTENT_LEFT, 26, "KuapaDwaso")
    canv.setFont("KD-Body", 7)
    canv.setFillColor(GRAY_500)
    canv.drawRightString(PAGE_WIDTH - CONTENT_RIGHT, 26, f"Page {doc.page - 1:02d}")
    canv.restoreState()


def heading_flowable(
    text: str,
    level: int,
    styles: dict[str, ParagraphStyle],
    outline_level: int,
) -> list[Flowable]:
    key = slugify(text)
    anchor = BookmarkAnchor(key, normalize_text(text), outline_level)
    heading = Paragraph(
        inline_markup(text),
        styles["h1"] if level == 1 else styles["h2"] if level == 2 else styles["h3"],
    )
    if level == 1:
        number_match = re.match(r"^(\d+)\.\s+(.+)$", text)
        if number_match:
            number, title = number_match.groups()
            number_style = ParagraphStyle(
                f"Number{number}",
                fontName="KD-Bold",
                fontSize=11,
                leading=15,
                textColor=GOLD,
                alignment=TA_CENTER,
            )
            title_heading = Paragraph(inline_markup(title), styles["h1"])
            row = Table(
                [[Paragraph(f"{int(number):02d}", number_style), title_heading]],
                colWidths=[36, CONTENT_WIDTH - 36],
            )
            row.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (0, 0), INK),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (0, 0), 0),
                        ("RIGHTPADDING", (0, 0), (0, 0), 0),
                        ("TOPPADDING", (0, 0), (0, 0), 8),
                        ("BOTTOMPADDING", (0, 0), (0, 0), 8),
                        ("LEFTPADDING", (1, 0), (1, 0), 12),
                        ("RIGHTPADDING", (1, 0), (1, 0), 0),
                        ("TOPPADDING", (1, 0), (1, 0), 5),
                        ("BOTTOMPADDING", (1, 0), (1, 0), 5),
                    ]
                )
            )
            return [anchor, KeepTogether([Spacer(1, 11), row, Spacer(1, 7)])]
        return [
            anchor,
            KeepTogether(
                [Spacer(1, 12), heading, HRFlowable(width="100%", thickness=1.3, color=GOLD), Spacer(1, 7)]
            ),
        ]
    return [anchor, KeepTogether([Spacer(1, 6), heading, Spacer(1, 3)])]


def list_table(items: list[str], ordered: bool, styles: dict[str, ParagraphStyle]) -> Table:
    rows = []
    for index, item in enumerate(items, 1):
        marker = f"{index}." if ordered else "-"
        marker_color = GOLD if ordered else FIELD
        marker_style = ParagraphStyle(
            f"Marker{index}{ordered}",
            fontName="KD-Bold",
            fontSize=9.8,
            leading=14.8,
            textColor=marker_color,
            alignment=TA_CENTER,
        )
        rows.append([Paragraph(marker, marker_style), Paragraph(inline_markup(item), styles["bullet"])])
    table = Table(rows, colWidths=[20, CONTENT_WIDTH - 20])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 4),
                ("RIGHTPADDING", (1, 0), (1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    table.spaceAfter = 6
    return table


def quote_panel(lines: list[str], styles: dict[str, ParagraphStyle]) -> Table:
    cleaned = [inline_markup(line) for line in lines if line]
    value = "<br/>".join(cleaned)
    table = Table([[Paragraph(value, styles["quote"])]], colWidths=[CONTENT_WIDTH])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE_STRONG),
                ("LINELEFT", (0, 0), (0, -1), 4, GOLD),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    table.spaceBefore = 2
    table.spaceAfter = 9
    return table


def table_widths(rows: list[list[str]]) -> list[float]:
    columns = max(len(row) for row in rows)
    if columns == 2:
        return [CONTENT_WIDTH * 0.31, CONTENT_WIDTH * 0.69]
    if columns == 3:
        return [CONTENT_WIDTH * 0.29, CONTENT_WIDTH * 0.18, CONTENT_WIDTH * 0.53]
    if columns == 4:
        return [CONTENT_WIDTH * 0.31, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.13, CONTENT_WIDTH * 0.42]
    return [CONTENT_WIDTH / columns] * columns


def markdown_table(rows: list[list[str]], styles: dict[str, ParagraphStyle]) -> LongTable:
    columns = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (columns - len(row)) for row in rows]
    data: list[list[Paragraph]] = []
    for row_index, row in enumerate(normalized_rows):
        style = styles["table_header"] if row_index == 0 else styles["table"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])
    table = LongTable(data, colWidths=table_widths(normalized_rows), repeatRows=1, splitByRow=1)
    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    for row_index in range(1, len(data)):
        if row_index % 2 == 0:
            table_style.append(("BACKGROUND", (0, row_index), (-1, row_index), SURFACE))
    table.setStyle(TableStyle(table_style))
    table.spaceBefore = 3
    table.spaceAfter = 9
    return table


def image_flowables(
    alt: str,
    source: str,
    input_path: Path,
    styles: dict[str, ParagraphStyle],
) -> list[Flowable]:
    image_path = (input_path.parent / source).resolve()
    if not image_path.exists():
        raise FileNotFoundError(f"Referenced image does not exist: {image_path}")
    with PILImage.open(image_path) as image:
        width, height = image.size
    scale = min(CONTENT_WIDTH / width, 300 / height)
    rendered = Image(str(image_path), width=width * scale, height=height * scale)
    rendered.hAlign = "CENTER"
    return [
        Spacer(1, 4),
        rendered,
        Spacer(1, 4),
        Paragraph(html.escape(normalize_text(alt)), styles["caption"]),
    ]


def build_story(
    metadata: Metadata,
    blocks: list[Block],
    input_path: Path,
    styles: dict[str, ParagraphStyle],
) -> list[Flowable]:
    story: list[Flowable] = [PageBreak()]
    has_parent_outline = False
    for block in blocks:
        if block.kind == "heading":
            level = block.level
            text = str(block.value)
            if text.strip().lower() == "table of contents":
                story.append(PageBreak())
            if level == 1:
                has_parent_outline = True
                outline_level = 0
            else:
                outline_level = 1 if has_parent_outline else 0
            story.extend(heading_flowable(text, level, styles, outline_level))
        elif block.kind == "paragraph":
            story.append(Paragraph(inline_markup(str(block.value)), styles["body"]))
        elif block.kind == "list":
            story.append(list_table(block.value, False, styles))  # type: ignore[arg-type]
        elif block.kind == "ordered":
            story.append(list_table(block.value, True, styles))  # type: ignore[arg-type]
        elif block.kind == "quote":
            story.append(quote_panel(block.value, styles))  # type: ignore[arg-type]
        elif block.kind == "table":
            story.append(markdown_table(block.value, styles))  # type: ignore[arg-type]
        elif block.kind == "image":
            alt, source = block.value  # type: ignore[misc]
            story.extend(image_flowables(alt, source, input_path, styles))
        elif block.kind == "rule":
            story.extend([Spacer(1, 6), HRFlowable(width="100%", thickness=0.7, color=LINE), Spacer(1, 6)])
    return story


def generate_pdf(input_path: Path, output_path: Path) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Markdown source not found: {input_path}")
    if not DEFAULT_COVER_IMAGE.exists():
        raise FileNotFoundError(f"Cover image not found: {DEFAULT_COVER_IMAGE}")

    register_fonts()
    metadata, blocks = parse_markdown(input_path.read_text(encoding="utf-8"))
    styles = build_styles()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    frame = Frame(
        CONTENT_LEFT,
        CONTENT_BOTTOM,
        CONTENT_WIDTH,
        PAGE_HEIGHT - CONTENT_TOP - CONTENT_BOTTOM,
        leftPadding=0,
        rightPadding=0,
        topPadding=0,
        bottomPadding=0,
        id="content",
    )
    doc = KuapaDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=CONTENT_LEFT,
        rightMargin=CONTENT_RIGHT,
        topMargin=CONTENT_TOP,
        bottomMargin=CONTENT_BOTTOM,
        title=metadata.title,
        author="Kuapa Dwaso",
        subject="Kuapa Dwaso operating model, field evidence and 90-day competition pilot",
    )
    doc.addPageTemplates(
        [
            PageTemplate(
                id="cover",
                frames=[frame],
                onPage=lambda current_canvas, current_doc: draw_cover(current_canvas, current_doc, metadata),
                autoNextPageTemplate="content",
            ),
            PageTemplate(id="content", frames=[frame], onPage=draw_content_chrome),
        ]
    )
    story = build_story(metadata, blocks, input_path, styles)
    doc.build(story)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("output", nargs="?", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    input_file = arguments.input if arguments.input.is_absolute() else REPO_ROOT / arguments.input
    output_file = arguments.output if arguments.output.is_absolute() else REPO_ROOT / arguments.output
    generate_pdf(input_file.resolve(), output_file.resolve())
    print(f"Generated {output_file.resolve()}")
