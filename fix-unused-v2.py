#!/usr/bin/env python3
"""Phase 6.1 — Smart fix for ESLint no-unused-vars warnings.

For each warning:
- Imports (`import { foo }`) → remove from import or prefix with _
- Function declarations (`function foo`) → rename to _foo (and update all callers)
- Variable declarations (`const foo =`, `let foo =`) → prefix with _foo
- Destructures (`const { foo, bar } = ...`) → prefix each name with _
- Function args → prefix with _
- Catch params (`catch (err)`) → leave as-is (already allowed)

Approach: read each file, find warnings, apply minimal change.
"""

import json
import re
import subprocess
import sys
import os

def get_warnings():
    result = subprocess.run(
        ["npx", "eslint", "src/", "--format=json"],
        capture_output=True, text=True, cwd="/workspace/projects/InvestmentLineNotify",
        timeout=60
    )
    return json.loads(result.stdout)

def apply_fix(filepath, line_no, col, var_name, message):
    """Apply minimal fix for one warning."""
    with open(filepath, 'r') as f:
        lines = f.readlines()

    idx = line_no - 1
    if idx >= len(lines):
        return False, "line out of range"

    line = lines[idx]
    original = line

    # Strategy 1: If line starts with `import`, remove the named import
    if re.match(r'\s*import\b', line):
        # Match patterns like:
        #   import { foo, bar } from "..."
        #   import { foo as bar } from "..."
        #   import foo from "..."
        # We want to remove `foo` from the import
        # Strategy: rename `foo` to `_foo` in import line (keep import for tree-shaking)
        # Or remove `foo, ` from the list

        # For named imports, find the variable name and remove from the list
        # Simpler: prefix with underscore in the import to keep API consistency
        new_line = re.sub(r'(\{\s*)([^}]*?)\b' + re.escape(var_name) + r'\b([^}]*?\})',
                          lambda m: _remove_from_import(m, var_name),
                          line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, "removed from import"

        # Couldn't remove - try rename to _
        new_line = re.sub(r'\b' + re.escape(var_name) + r'\b', '_' + var_name, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, "renamed import"

        return False, f"could not fix import line: {line.strip()}"

    # Strategy 2: destructure pattern like `const { foo, bar } = ...`
    if re.search(r'=\s*\{', line) or '{' in line.split('=', 1)[0] if '=' in line else '{' in line:
        # Find destructure and prefix var_name
        # Match `const {` or `let {` or `var {`
        # or inside destructure: `, foo ` or `{ foo,` or `{ foo }`
        patterns = [
            # `, foo` or ` foo,` (inside destructure)
            (r'(\{[^}]*?,)\s*\b' + re.escape(var_name) + r'\b', r'\1 _' + var_name),
            # `{ foo` (first in destructure)
            (r'(\{)\s*\b' + re.escape(var_name) + r'\b', r'\1 _' + var_name),
            # ` foo }` (last in destructure)
            (r'\b' + re.escape(var_name) + r'\b(\s*\})', r'_' + var_name + r'\1'),
            # ` foo: ...` (rename in destructure)
            (r'\b' + re.escape(var_name) + r'\s*:\s*', '_' + var_name + ': '),
        ]
        for pattern, repl in patterns:
            new_line = re.subn(pattern, repl, line, count=1)[0]
            if new_line != line:
                lines[idx] = new_line
                return True, "destructure rename"

    # Strategy 3: function declaration `function foo(` or `function* foo(`
    if 'function' in line:
        new_line = re.sub(r'(\bfunction\*?\s+)\b' + re.escape(var_name) + r'\b',
                          r'\1_' + var_name, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            # Need to also update callers
            _update_callers(filepath, var_name, '_' + var_name)
            return True, "function rename"

        # `export function foo` or `export async function foo`
        new_line = re.sub(r'(\bexport\s+(?:default\s+)?(?:async\s+)?function\*?\s+)\b' + re.escape(var_name) + r'\b',
                          r'\1_' + var_name, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, "export function rename"

    # Strategy 4: variable declaration `const foo` or `let foo` or `var foo`
    decl_pattern = r'\b(const|let|var)\s+\b' + re.escape(var_name) + r'\b'
    new_line, n = re.subn(decl_pattern, r'\1 _' + var_name, line, count=1)
    if n > 0:
        lines[idx] = new_line
        return True, "var declaration rename"

    # Strategy 5: export default foo
    if 'export default' in line:
        new_line = re.sub(r'(\bexport\s+default\s+)\b' + re.escape(var_name) + r'\b',
                          r'\1_' + var_name, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, "export default rename"

    # Strategy 6: assignment `foo = ...`
    new_line, n = re.subn(r'(=\s*)\b' + re.escape(var_name) + r'\b',
                          r'\1_' + var_name, line, count=1)
    if n > 0:
        lines[idx] = new_line
        return True, "assignment rename"

    # Strategy 7: destructure property `foo: ...` or `...foo`
    new_line = re.sub(r'(\{\s*)' + re.escape(var_name) + r'(\s*[:,}])',
                      r'\1_' + var_name + r'\2', line, count=1)
    if new_line != line:
        lines[idx] = new_line
        return True, "destructure prop rename"

    return False, f"no pattern matched: {line.strip()}"


def _remove_from_import(match, var_name):
    """Remove var_name from a destructured import like `{ foo, bar, baz }`."""
    content = match.group(2)
    # Split by comma, remove var_name
    items = [s.strip() for s in content.split(',') if s.strip() and s.strip() != var_name]
    if not items:
        return match.group(1) + match.group(3)  # empty import
    return match.group(1) + ', '.join(items) + match.group(3)


def _update_callers(filepath, old_name, new_name):
    """Find all callers of old_name and update to new_name."""
    with open(filepath, 'r') as f:
        content = f.read()
    # Use word boundary
    new_content = re.sub(r'\b' + re.escape(old_name) + r'\b', new_name, content)
    with open(filepath, 'w') as f:
        f.write(new_content)


def main():
    data = get_warnings()

    fixes_by_file = {}
    for fd in data:
        fpath = fd['filePath']
        is_test = '.test.' in fpath or '/test/' in fpath
        if is_test:
            continue
        for m in fd['messages']:
            if m['severity'] != 1:
                continue
            msg = m['message']
            match = re.match(r"'([^']+)' (?:is defined but|is assigned a value but)", msg)
            if match:
                var = match.group(1)
                if var.startswith('_'):
                    continue
                fixes_by_file.setdefault(fpath, []).append((m['line'], m['column'], var, m['message']))

    total_applied = 0
    total_failed = 0
    for fpath, fixes in fixes_by_file.items():
        with open(fpath, 'r') as f:
            original_content = f.read()

        for line_no, col, var, msg in sorted(set(fixes), key=lambda x: (-x[0], -x[1])):
            ok, info = apply_fix(fpath, line_no, col, var, msg)
            if ok:
                total_applied += 1
            else:
                total_failed += 1
                fname = os.path.basename(fpath)
                print(f"  [FAIL] {fname}:{line_no}:{col} {var} - {info}")

    print(f"\nTotal applied: {total_applied}")
    print(f"Total failed: {total_failed}")


if __name__ == '__main__':
    main()
