#!/usr/bin/env python3
"""Generate a branded Kuapa Dwaso PDF from a constrained Markdown document.

The generator intentionally supports the Markdown features used by the product
decision notes in this repository: headings, paragraphs, bold text, links,
unordered lists, and fenced code/text blocks.

Usage:
    python docs/tools/generate_branded_pdf.py
    python docs/tools/generate_branded_pdf.py path/to/input.md output/file.pdf
"""

from __future__ import annotations

import argparse
import html
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "docs" / "product" / "2026-07-27-judges-feedback-product-recommendations.md"
DEFAULT_OUTPUT = REPO_ROOT / "output" / "pdf" / "kuapa-dwaso-judges-feedback-recommendations.pdf"
DEFAULT_COVER_IMAGE = REPO_ROOT / "apps" / "admin" / "public" / "auth-bg.png"

PAGE_WIDTH, PAGE_HEIGHT = letter
CONTENT_LEFT = 54
CONTENT_RIGHT = 54
CONTENT_TOP = 70
CONTENT_BOTTOM = 64
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
class DocumentMetadata:
    title: str
    author: str
    date: str
    status: str


@dataclass(frozen=True)
class MarkdownBlock:
    kind: str
    value: str | list[str]
    level: int = 0


class PageNumberCanvas(canvas.Canvas):
    """Save page states so content pages can display Page X of Y."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, object]] = []

    def showPage(self):  # noqa: N802 - ReportLab API
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            page_number = self._pageNumber
            if page_number > 1:
                self.setFont("KD-Body", 7.5)
                self.setFillColor(GRAY_500)
                label = f"Page {page_number - 1} of {total_pages - 1}"
                self.drawRightString(PAGE_WIDTH - CONTENT_RIGHT, 29, label)
            super().showPage()
        super().save()


class AccentRule(Flowable):
    def __init__(self, width: float = CONTENT_WIDTH, height: float = 2):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(GOLD)
        self.canv.roundRect(0, 0, self.width, self.height, 1, stroke=0, fill=1)


class BulletDot(Flowable):
    """A font-independent list marker."""

    def __init__(self, line_height: float):
        super().__init__()
        self.width = 10
        self.height = line_height

    def wrap(self, available_width: float, available_height: float) -> tuple[float, float]:
        return self.width, self.height

    def draw(self):
        self.canv.setFillColor(FIELD)
        self.canv.circle(self.width / 2, self.height - 7, 1.35, stroke=0, fill=1)


def register_fonts() -> None:
    """Register Segoe UI when available, with built-in-font fallbacks."""

    windows_fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    candidates = {
        "KD-Body": windows_fonts / "segoeui.ttf",
        "KD-Body-Semibold": windows_fonts / "seguisb.ttf",
        "KD-Body-Bold": windows_fonts / "segoeuib.ttf",
        "KD-Body-Italic": windows_fonts / "segoeuii.ttf",
    }
    fallbacks = {
        "KD-Body": "Helvetica",
        "KD-Body-Semibold": "Helvetica-Bold",
        "KD-Body-Bold": "Helvetica-Bold",
        "KD-Body-Italic": "Helvetica-Oblique",
    }

    for name, path in candidates.items():
        if path.exists():
            pdfmetrics.registerFont(TTFont(name, str(path)))
        else:
            pdfmetrics.registerFont(pdfmetrics.Font(name, fallbacks[name], "WinAnsiEncoding"))

    pdfmetrics.registerFontFamily(
        "KD-Body",
        normal="KD-Body",
        bold="KD-Body-Bold",
        italic="KD-Body-Italic",
        boldItalic="KD-Body-Bold",
    )


def normalize_text(value: str) -> str:
    """Normalize typography that can render inconsistently in generated PDFs."""

    replacements = {
        "\u00a0": " ",
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2212": "-",
        "\u2192": "->",
        "\u2022": "*",
        "â†’": "->",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value.strip()


def inline_markup(value: str) -> str:
    """Convert the small inline Markdown subset into ReportLab paragraph XML."""

    value = html.escape(normalize_text(value), quote=False)
    value = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        lambda match: (
            f'<link href="{match.group(2)}" color="#2D8A4E">'
            f"<u>{match.group(1)}</u></link>"
        ),
        value,
    )
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', value)
    return value


def parse_markdown(source: str) -> tuple[DocumentMetadata, list[MarkdownBlock]]:
    lines = source.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    title = normalize_text(lines[0].removeprefix("#").strip()) if lines else "Kuapa Dwaso"

    cursor = 1
    while cursor < len(lines) and not lines[cursor].strip():
        cursor += 1

    author = "Kevin Amisom Nchorbuno"
    if cursor < len(lines) and lines[cursor].strip().startswith("**"):
        author = normalize_text(lines[cursor].strip().strip("*"))
        cursor += 1

    while cursor < len(lines) and not lines[cursor].strip():
        cursor += 1
    date = normalize_text(lines[cursor]) if cursor < len(lines) else ""
    cursor += 1

    while cursor < len(lines) and not lines[cursor].strip():
        cursor += 1
    status = normalize_text(lines[cursor]) if cursor < len(lines) else ""
    cursor += 1

    blocks: list[MarkdownBlock] = []
    paragraph_lines: list[str] = []
    list_items: list[str] = []
    code_lines: list[str] = []
    in_code = False

    def flush_paragraph() -> None:
        if paragraph_lines:
            blocks.append(MarkdownBlock("paragraph", " ".join(line.strip() for line in paragraph_lines)))
            paragraph_lines.clear()

    def flush_list() -> None:
        if list_items:
            blocks.append(MarkdownBlock("list", list(list_items)))
            list_items.clear()

    for raw_line in lines[cursor:]:
        stripped = raw_line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            flush_list()
            if in_code:
                blocks.append(MarkdownBlock("code", "\n".join(code_lines)))
                code_lines.clear()
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_lines.append(normalize_text(raw_line))
            continue

        heading_match = re.match(r"^(#{2,4})\s+(.+)$", stripped)
        if heading_match:
            flush_paragraph()
            flush_list()
            blocks.append(
                MarkdownBlock(
                    "heading",
                    normalize_text(heading_match.group(2)),
                    level=len(heading_match.group(1)),
                )
            )
            continue

        if re.match(r"^[-*]\s+", stripped):
            flush_paragraph()
            list_items.append(re.sub(r"^[-*]\s+", "", stripped))
            continue

        if not stripped:
            flush_paragraph()
            flush_list()
            continue

        paragraph_lines.append(stripped)

    flush_paragraph()
    flush_list()
    if code_lines:
        blocks.append(MarkdownBlock("code", "\n".join(code_lines)))

    return DocumentMetadata(title, author, date, status), blocks


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "KDTitle",
            parent=sample["Title"],
            fontName="KD-Body-Bold",
            fontSize=25,
            leading=29,
            textColor=FIELD,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "deck": ParagraphStyle(
            "KDDeck",
            fontName="KD-Body",
            fontSize=11.2,
            leading=16,
            textColor=GRAY_700,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "KDBody",
            fontName="KD-Body",
            fontSize=10.1,
            leading=14.7,
            textColor=GRAY_700,
            spaceAfter=9,
            allowWidows=0,
            allowOrphans=0,
        ),
        "body_small": ParagraphStyle(
            "KDBodySmall",
            fontName="KD-Body",
            fontSize=8.7,
            leading=12.2,
            textColor=GRAY_700,
            spaceAfter=5,
        ),
        "h2": ParagraphStyle(
            "KDH2",
            fontName="KD-Body-Bold",
            fontSize=15,
            leading=18,
            textColor=INK,
            spaceAfter=0,
        ),
        "h2_opening": ParagraphStyle(
            "KDH2Opening",
            fontName="KD-Body-Bold",
            fontSize=15,
            leading=18,
            textColor=FIELD,
            spaceAfter=0,
        ),
        "h3": ParagraphStyle(
            "KDH3",
            fontName="KD-Body-Bold",
            fontSize=11.6,
            leading=14,
            textColor=FIELD,
            spaceBefore=4,
            spaceAfter=5,
            keepWithNext=True,
        ),
        "meta_label": ParagraphStyle(
            "KDMetaLabel",
            fontName="KD-Body-Bold",
            fontSize=7.5,
            leading=9,
            textColor=FIELD,
            spaceAfter=2,
        ),
        "meta_value": ParagraphStyle(
            "KDMetaValue",
            fontName="KD-Body-Semibold",
            fontSize=9.2,
            leading=11,
            textColor=INK,
        ),
        "bullet": ParagraphStyle(
            "KDBullet",
            fontName="KD-Body",
            fontSize=9.8,
            leading=14,
            textColor=GRAY_700,
            leftIndent=2,
            firstLineIndent=0,
            spaceAfter=2,
        ),
        "code": ParagraphStyle(
            "KDCode",
            fontName="Courier",
            fontSize=8.8,
            leading=13.2,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "cover_title": ParagraphStyle(
            "KDCoverTitle",
            fontName="KD-Body-Bold",
            fontSize=31,
            leading=35,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
        "cover_subtitle": ParagraphStyle(
            "KDCoverSubtitle",
            fontName="KD-Body-Semibold",
            fontSize=10.5,
            leading=14,
            tracking=2,
            textColor=GOLD,
            alignment=TA_CENTER,
        ),
        "cover_author": ParagraphStyle(
            "KDCoverAuthor",
            fontName="KD-Body-Semibold",
            fontSize=10.5,
            leading=14,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
    }


def draw_cover(canv: canvas.Canvas, doc: BaseDocTemplate, metadata: DocumentMetadata) -> None:
    canv.saveState()
    canv.setTitle(metadata.title)
    canv.setAuthor(metadata.author)
    canv.setSubject("Kuapa Dwaso judges' feedback and recommended next steps")

    with Image.open(DEFAULT_COVER_IMAGE) as image:
        image_width, image_height = image.size
    scale = max(PAGE_WIDTH / image_width, PAGE_HEIGHT / image_height)
    draw_width = image_width * scale
    draw_height = image_height * scale
    x = (PAGE_WIDTH - draw_width) / 2
    y = (PAGE_HEIGHT - draw_height) / 2

    path = canv.beginPath()
    path.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    canv.clipPath(path, stroke=0, fill=0)
    canv.drawImage(
        str(DEFAULT_COVER_IMAGE),
        x,
        y,
        width=draw_width,
        height=draw_height,
        mask="auto",
    )
    canv.setFillColor(INK)
    canv.setFillAlpha(0.88)
    canv.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, stroke=0, fill=1)
    canv.setFillAlpha(1)

    # Kuapa Dwaso dot mark.
    logo_x = PAGE_WIDTH / 2
    logo_y = 586
    dots = [
        (-37, 18, 4.5, 0.52),
        (-40, -2, 4.5, 0.66),
        (-37, -22, 4.5, 0.8),
        (-17, 8, 6, 0.86),
        (-17, -12, 6, 0.92),
        (10, -2, 16, 1),
    ]
    for dx, dy, radius, alpha in dots:
        canv.setFillColor(FIELD)
        canv.setFillAlpha(alpha)
        canv.circle(logo_x + dx, logo_y + dy, radius, stroke=0, fill=1)
    canv.setFillAlpha(1)

    styles = build_styles()
    title = Paragraph("NOTES ON THE JUDGES'<br/>FEEDBACK", styles["cover_title"])
    title.wrapOn(canv, 470, 90)
    title.drawOn(canv, (PAGE_WIDTH - 470) / 2, 446)

    subtitle = Paragraph("RECOMMENDED NEXT STEPS", styles["cover_subtitle"])
    subtitle.wrapOn(canv, 470, 28)
    subtitle.drawOn(canv, (PAGE_WIDTH - 470) / 2, 412)

    canv.setStrokeColor(GOLD)
    canv.setLineWidth(2.4)
    canv.line(72, 129, PAGE_WIDTH - 72, 129)

    author = Paragraph(
        f"{html.escape(metadata.author)}<br/>"
        f'<font color="#DDE3D5">{html.escape(metadata.date)}</font>',
        styles["cover_author"],
    )
    author.wrapOn(canv, 360, 48)
    author.drawOn(canv, (PAGE_WIDTH - 360) / 2, 78)

    canv.setFont("KD-Body-Semibold", 8)
    canv.setFillColor(FIELD_LIGHT)
    canv.drawCentredString(PAGE_WIDTH / 2, 48, "KUAPADWASO.COM")
    canv.restoreState()


def draw_content_chrome(canv: canvas.Canvas, doc: BaseDocTemplate) -> None:
    canv.saveState()
    canv.setStrokeColor(LINE)
    canv.setLineWidth(0.55)
    canv.line(CONTENT_LEFT, PAGE_HEIGHT - 39, PAGE_WIDTH - CONTENT_RIGHT, PAGE_HEIGHT - 39)
    canv.line(CONTENT_LEFT, 39, PAGE_WIDTH - CONTENT_RIGHT, 39)

    canv.setFont("KD-Body-Bold", 7.5)
    canv.setFillColor(INK)
    canv.drawString(CONTENT_LEFT, PAGE_HEIGHT - 30, "KUAPA DWASO")
    canv.setFont("KD-Body", 7.2)
    canv.setFillColor(GRAY_500)
    canv.drawRightString(
        PAGE_WIDTH - CONTENT_RIGHT,
        PAGE_HEIGHT - 30,
        "JUDGES' FEEDBACK & RECOMMENDED NEXT STEPS",
    )
    canv.setFont("KD-Body-Bold", 7.5)
    canv.setFillColor(FIELD)
    canv.drawString(CONTENT_LEFT, 29, "KuapaDwaso")
    canv.restoreState()


def section_heading(text: str, styles: dict[str, ParagraphStyle]) -> Flowable:
    numbered = re.match(r"^(\d+)\.\s+(.+)$", text)
    if not numbered:
        table = Table(
            [[Paragraph(inline_markup(text), styles["h2_opening"])]],
            colWidths=[CONTENT_WIDTH],
        )
        table.setStyle(
            TableStyle(
                [
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("LINEBELOW", (0, 0), (-1, -1), 1.3, GOLD),
                ]
            )
        )
        return KeepTogether([Spacer(1, 10), table, Spacer(1, 8)])

    number, title = numbered.groups()
    number_cell = Paragraph(
        f'<font color="#D4A843"><b>{int(number):02d}</b></font>',
        ParagraphStyle(
            f"KDSectionNumber{number}",
            fontName="KD-Body-Bold",
            fontSize=10.5,
            leading=15,
            alignment=TA_CENTER,
        ),
    )
    title_cell = Paragraph(inline_markup(title), styles["h2"])
    table = Table([[number_cell, title_cell]], colWidths=[34, CONTENT_WIDTH - 34])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), INK),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 0),
                ("TOPPADDING", (0, 0), (0, 0), 7),
                ("BOTTOMPADDING", (0, 0), (0, 0), 7),
                ("LEFTPADDING", (1, 0), (1, 0), 12),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (1, 0), (1, 0), 4),
                ("BOTTOMPADDING", (1, 0), (1, 0), 4),
            ]
        )
    )
    return KeepTogether([Spacer(1, 13), table, Spacer(1, 8)])


def metadata_panel(metadata: DocumentMetadata, styles: dict[str, ParagraphStyle]) -> Table:
    data = [
        [
            Paragraph("AUTHOR", styles["meta_label"]),
            Paragraph("DATE", styles["meta_label"]),
            Paragraph("DOCUMENT STATUS", styles["meta_label"]),
        ],
        [
            Paragraph(html.escape(metadata.author), styles["meta_value"]),
            Paragraph(html.escape(metadata.date), styles["meta_value"]),
            Paragraph(html.escape(metadata.status), styles["meta_value"]),
        ],
    ]
    table = Table(data, colWidths=[154, 96, CONTENT_WIDTH - 250])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LINEBEFORE", (1, 0), (1, -1), 0.5, LINE),
                ("LINEBEFORE", (2, 0), (2, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 1),
                ("TOPPADDING", (0, 1), (-1, 1), 1),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
            ]
        )
    )
    return table


def code_panel(value: str, styles: dict[str, ParagraphStyle]) -> Table:
    normalized = normalize_text(value)
    lines = [line for line in normalized.splitlines() if line.strip()]
    content = "<br/>".join(html.escape(line) for line in lines)
    table = Table([[Paragraph(content, styles["code"])]], colWidths=[CONTENT_WIDTH])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
                ("LINELEFT", (0, 0), (0, -1), 4, FIELD),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 15),
                ("RIGHTPADDING", (0, 0), (-1, -1), 15),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    return table


def bullet_list(items: Iterable[str], styles: dict[str, ParagraphStyle], compact: bool = False) -> Table:
    style = styles["body_small"] if compact else styles["bullet"]
    rows = [
        [
            BulletDot(style.leading),
            Paragraph(inline_markup(item), style),
        ]
        for item in items
    ]
    table = Table(rows, colWidths=[14, CONTENT_WIDTH - 14], repeatRows=0)
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 4),
                ("RIGHTPADDING", (1, 0), (1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    table.spaceBefore = 2
    table.spaceAfter = 8
    return table


def build_story(
    metadata: DocumentMetadata,
    blocks: list[MarkdownBlock],
    styles: dict[str, ParagraphStyle],
) -> list[Flowable]:
    story: list[Flowable] = [PageBreak()]
    story.extend(
        [
            Paragraph(inline_markup(metadata.title), styles["title"]),
            AccentRule(),
            Spacer(1, 15),
            metadata_panel(metadata, styles),
            Spacer(1, 15),
        ]
    )

    current_heading = ""
    for block in blocks:
        if block.kind == "heading":
            current_heading = str(block.value)
            if block.level == 2:
                story.append(section_heading(current_heading, styles))
            else:
                story.append(Paragraph(inline_markup(current_heading), styles["h3"]))
            continue

        if block.kind == "paragraph":
            story.append(Paragraph(inline_markup(str(block.value)), styles["body"]))
            continue

        if block.kind == "list":
            compact = current_heading.lower().startswith("references")
            story.append(bullet_list(block.value, styles, compact=compact))  # type: ignore[arg-type]
            continue

        if block.kind == "code":
            story.extend([Spacer(1, 2), code_panel(str(block.value), styles), Spacer(1, 8)])

    return story


def generate_pdf(input_path: Path, output_path: Path) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Markdown input not found: {input_path}")
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
    doc = BaseDocTemplate(
        str(output_path),
        pagesize=letter,
        leftMargin=CONTENT_LEFT,
        rightMargin=CONTENT_RIGHT,
        topMargin=CONTENT_TOP,
        bottomMargin=CONTENT_BOTTOM,
        title=metadata.title,
        author=metadata.author,
        subject="Kuapa Dwaso judges' feedback and recommended next steps",
    )
    doc.addPageTemplates(
        [
            PageTemplate(
                id="cover",
                frames=[frame],
                onPage=lambda canv, current_doc: draw_cover(canv, current_doc, metadata),
                autoNextPageTemplate="content",
            ),
            PageTemplate(id="content", frames=[frame], onPage=draw_content_chrome),
        ]
    )

    story = build_story(metadata, blocks, styles)
    doc.build(story, canvasmaker=PageNumberCanvas)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Markdown input (default: {DEFAULT_INPUT.relative_to(REPO_ROOT)})",
    )
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"PDF output (default: {DEFAULT_OUTPUT.relative_to(REPO_ROOT)})",
    )
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    input_file = arguments.input if arguments.input.is_absolute() else REPO_ROOT / arguments.input
    output_file = arguments.output if arguments.output.is_absolute() else REPO_ROOT / arguments.output
    generate_pdf(input_file.resolve(), output_file.resolve())
    print(f"Generated {output_file.resolve()}")
