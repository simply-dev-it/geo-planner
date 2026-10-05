#!/usr/bin/env python3
"""Check repository Markdown local paths and GitHub-style heading fragments offline."""

from functools import lru_cache
import html
from pathlib import Path
import re
import subprocess
import sys
import unicodedata
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = r'(<[^>\n]+>|(?:\\.|[^\s()]+|\([^()\n]*\))+)'
INLINE = re.compile(r'\[[^\]\n]*\]\(\s*' + DESTINATION + r'(?:\s+["\'][^\n]*?["\'])?\s*\)')
DEFINITION = re.compile(r'^ {0,3}\[([^]\n]+)\]:\s*' + DESTINATION, re.M)
REFERENCE = re.compile(r'\[([^]\n]+)\]\[([^]\n]*)\]')


def prose(source: str) -> str:
    """Mask fenced code and HTML comments while preserving diagnostic line numbers."""
    lines = []
    fence = None
    for line in source.splitlines(keepends=True):
        marker = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if fence is None and marker:
            fence = marker[1]
            lines.append('\n' if line.endswith('\n') else '')
        elif fence is not None:
            if re.match(r'^ {0,3}' + re.escape(fence[0]) + '{' + str(len(fence)) + r',}\s*$', line):
                fence = None
            lines.append('\n' if line.endswith('\n') else '')
        else:
            lines.append(line)
    return re.sub(r'<!--.*?-->', lambda m: '\n' * m[0].count('\n'), ''.join(lines), flags=re.S)


def reference_key(label: str) -> str:
    return ' '.join(label.split()).casefold()


def destinations(source: str):
    text = re.sub(r'(`+).*?\1', lambda m: '\n' * m[0].count('\n'), prose(source), flags=re.S)
    definitions = {reference_key(m[1]): m[2] for m in DEFINITION.finditer(text)}
    for match in INLINE.finditer(text):
        yield text.count('\n', 0, match.start()) + 1, match[1], None
    for match in REFERENCE.finditer(text):
        key = reference_key(match[2] or match[1])
        yield text.count('\n', 0, match.start()) + 1, definitions.get(key), key
    # Shortcut references are links only when a definition exists.
    mask = lambda match: '\n' * match[0].count('\n')
    remaining = INLINE.sub(mask, REFERENCE.sub(mask, DEFINITION.sub(mask, text)))
    for match in re.finditer(r'\[([^]\n]+)\]', remaining):
        key = reference_key(match[1])
        if key in definitions:
            yield remaining.count('\n', 0, match.start()) + 1, definitions[key], key


def heading_ids(source: str) -> set[str]:
    text = prose(source)
    anchors = set(re.findall(r'\b(?:id|name)=["\']([^"\']+)["\']', text))
    matches = re.finditer(
        r'^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$|^([^\n]+)\n {0,3}(?:=+|-+)[ \t]*$',
        text, re.M,
    )
    headings = [match[1] or match[2] for match in matches]
    for heading in headings:
        heading = re.sub(r'\[([^]]+)\]\([^)]*\)', r'\1', heading)
        heading = html.unescape(re.sub(r'<[^>]*>', '', heading)).lower()
        slug = ''.join(c for c in heading if c in ' -_' or unicodedata.category(c)[0] in 'LNM').replace(' ', '-')
        candidate = slug
        suffix = 0
        while candidate in anchors:
            suffix += 1
            candidate = f'{slug}-{suffix}'
        anchors.add(candidate)
    return anchors


def check_documents(paths: list[Path], root: Path) -> list[str]:
    @lru_cache(maxsize=None)
    def anchors(path):
        return heading_ids(path.read_text(encoding='utf-8'))

    errors = []
    for path in paths:
        for line, destination, reference in destinations(path.read_text(encoding='utf-8')):
            context = f'{path.relative_to(root)}:{line}'
            if destination is None:
                errors.append(f'{context}: undefined reference [{reference}]')
                continue
            destination = html.unescape(destination.strip('<>'))
            destination = re.sub(r'\\([\\() ])', r'\1', destination)
            try:
                parsed = urlsplit(destination)
            except ValueError as error:
                errors.append(f'{context}: invalid link {destination}: {error}')
                continue
            if parsed.scheme or parsed.netloc:
                continue
            target = (root / unquote(parsed.path).lstrip('/') if parsed.path.startswith('/')
                      else path.parent / unquote(parsed.path)) if parsed.path else path
            target = target.resolve()
            if not target.exists():
                errors.append(f'{context}: missing local target {destination}')
            elif parsed.fragment and target.suffix.lower() == '.md':
                fragment = unquote(parsed.fragment)
                if fragment not in anchors(target):
                    errors.append(f'{context}: missing heading fragment {destination}')
    return errors


def main() -> int:
    result = subprocess.run(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
        cwd=ROOT, check=True, capture_output=True,
    )
    paths = sorted({ROOT / name.decode('utf-8') for name in result.stdout.split(b'\0') if name})
    # A locally deleted tracked document has no outgoing links to inspect.
    paths = [path for path in paths if path.is_file()]
    errors = check_documents(paths, ROOT)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Local Markdown links are valid ({len(paths)} documents).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
