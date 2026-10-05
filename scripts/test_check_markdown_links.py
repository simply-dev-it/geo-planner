"""Regression checks for offline Markdown reference validation."""

from contextlib import redirect_stderr, redirect_stdout
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import check_markdown_links as checker


class MarkdownLinkTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='geo-planner-links-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def write(self, name, source):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding='utf-8')
        return path

    def errors(self, source):
        path = self.write('docs/source.md', source)
        return checker.check_documents([path], self.root)

    def test_local_paths_titles_images_and_url_encoding(self):
        self.write('with space.md', '# Target')
        self.write('image(1).png', '')
        self.assertEqual(self.errors(
            '[a](../with%20space.md "title")\n'
            '[b](<../with space.md>)\n![image](../image(1).png)\n'
            '[root](/with%20space.md)\n'
        ), [])

    def test_missing_file_and_requirement_heading_include_source_line(self):
        self.write('requirements.md', '## ACQUIRE-001 — Retrieve evidence\n')
        errors = self.errors(
            '[renamed](../old-name.md)\n[moved](../requirements.md#acquire-002--retrieve-evidence)'
        )
        self.assertEqual(len(errors), 2)
        self.assertIn('docs/source.md:1: missing local target', errors[0])
        self.assertIn('docs/source.md:2: missing heading fragment', errors[1])
        self.assertEqual(self.errors('[ok](../requirements.md#acquire-001--retrieve-evidence)'), [])

    def test_same_document_duplicate_headings_and_explicit_anchors(self):
        self.assertEqual(self.errors(
            '# Zażółć `test`\n# Repeat\n# Repeat\n<a id="custom"></a>\n'
            '[self](#zażółć-test) [duplicate](#repeat-1) [explicit](#custom)'
        ), [])
        self.assertEqual(len(self.errors('# Heading\n[bad](#missing)')), 1)

    def test_setext_and_atx_headings_share_duplicate_sequence(self):
        self.assertEqual(self.errors(
            'Repeat\n======\n# Repeat\n[second](#repeat-1)'
        ), [])

    def test_reference_diagnostics_preserve_lines_after_other_links(self):
        errors = self.errors('[web](https://example.invalid)\n\n[text][undefined]')
        self.assertIn('docs/source.md:3:', errors[0])

    def test_reference_full_collapsed_shortcut_and_undefined(self):
        self.write('target.md', '# Target')
        self.assertEqual(self.errors(
            '[full][ID] [id][] [id]\n\n[id]: ../target.md#target "title"'
        ), [])
        self.assertIn('undefined reference [missing]', self.errors('[text][missing]')[0])
        self.assertIn('missing local target', self.errors('[id]\n[id]: ../missing.md')[0])

    def test_code_examples_comments_and_external_urls_are_not_checked(self):
        self.assertEqual(self.errors(
            '```markdown\n[example](missing.md)\n```\n'
            '~~~\n[example][missing]\n~~~\n'
            '`[inline](missing.md)`\n<!-- [comment](missing.md) -->\n'
            '[web](https://example.invalid/path#missing) [mail](mailto:test@example.invalid)\n'
            '[cdn](//example.invalid/file)'
        ), [])

    def test_new_files_checked_ignored_files_skipped_and_cli_fails(self):
        subprocess.run(['git', 'init', '--quiet', str(self.root)], check=True)
        self.write('.gitignore', 'ignored.md\n')
        self.write('ignored.md', '[ignored](missing.md)')
        self.write('README.md', '# Valid')
        with patch.object(checker, 'ROOT', self.root), redirect_stdout(io.StringIO()):
            self.assertEqual(checker.main(), 0)
            self.write('new.md', '[broken](missing.md)')
            with redirect_stderr(io.StringIO()) as errors:
                self.assertEqual(checker.main(), 1)
            self.assertIn('new.md:1: missing local target', errors.getvalue())


if __name__ == '__main__':
    unittest.main()
