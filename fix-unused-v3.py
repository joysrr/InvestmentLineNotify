#!/usr/bin/env python3
"""Phase 6.1 — Bulk fix by file-line.

Read each (filepath, line, var) warning and apply minimal change.
Handle multi-property imports properly.
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


def fix_import_line(filepath, idx, var):
    """Remove var from import or prefix with _."""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    line = lines[idx]
    original = line

    # Pattern 1: `import { foo, bar } from "..."`
    # Remove the specific var name from the list
    m = re.search(r'import\s*\{([^}]*)\}\s*from', line)
    if m:
        items_str = m.group(1)
        items = [s.strip() for s in items_str.split(',') if s.strip()]
        new_items = []
        for it in items:
            # Handle `foo as bar` - extract source name
            as_match = re.match(r'(\w+)\s+as\s+(\w+)', it)
            if as_match:
                src_name, alias = as_match.group(1), as_match.group(2)
                if alias == var:
                    new_items.append(f'{src_name} as _{var}')
                    continue
            if it == var:
                new_items.append(f'_{var}')
                continue
            new_items.append(it)

        new_items_str = ', '.join(new_items)
        new_line = re.sub(r'import\s*\{[^}]*\}\s*from', f'import {{ {new_items_str} }} from', line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, lines

    # Pattern 2: default import `import foo from "..."` or `import foo, { ... } from "..."`
    if re.match(r'\s*import\s+' + re.escape(var) + r'\b', line):
        # Prefix with _
        new_line = re.sub(r'(\bimport\s+)' + re.escape(var) + r'\b', r'\1_' + var, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, lines

    # Pattern 3: side-effect import or general - just prefix var in the line
    new_line = re.sub(r'\b' + re.escape(var) + r'\b', '_' + var, line, count=1)
    if new_line != line:
        lines[idx] = new_line
        return True, lines

    return False, lines


def fix_assignment_line(filepath, idx, var):
    """For `var = ...` or `const var = ...`."""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    line = lines[idx]
    original = line

    # destructure: `const { foo, bar } = ...` or `const { foo: a, bar: b } = ...`
    # Pattern: prefix each unused name in destructure
    if '{' in line and '=' in line:
        # Try simple: { foo, bar }
        new_line = re.sub(r'(\{\s*)\b' + re.escape(var) + r'\b(\s*[,}])',
                          r'\1_' + var + r'\2', line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, lines
        # Try: { foo: a }
        new_line = re.sub(r'(\{\s*)\b' + re.escape(var) + r'\s*:',
                          r'\1_' + var + r' :', line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, lines
        # Try: { ...foo }
        new_line = re.sub(r'(\{\s*\.\.\.)\b' + re.escape(var) + r'\b',
                          r'\1_' + var, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            return True, lines

    # const foo = ... (with optional type)
    new_line = re.sub(r'\b(const|let|var)\s+\b' + re.escape(var) + r'\b',
                      r'\1 _' + var, line, count=1)
    if new_line != line:
        lines[idx] = new_line
        return True, lines

    # function foo(...)
    if 'function' in line:
        new_line = re.sub(r'(\bfunction\*?\s+)\b' + re.escape(var) + r'\b',
                          r'\1_' + var, line, count=1)
        if new_line != line:
            lines[idx] = new_line
            # Update callers
            return True, _update_callers(filepath, var, '_' + var)

    # export default foo
    new_line = re.sub(r'(\bexport\s+default\s+)\b' + re.escape(var) + r'\b',
                      r'\1_' + var, line, count=1)
    if new_line != line:
        lines[idx] = new_line
        return True, lines

    # Last resort: prefix in line
    new_line = re.sub(r'\b' + re.escape(var) + r'\b', '_' + var, line, count=1)
    if new_line != line:
        lines[idx] = new_line
        return True, lines

    return False, lines


def fix_function_arg(filepath, idx, var):
    """For function args like `function foo(bar)`."""
    with open(filepath, 'r') as f:
        lines = f.readlines()
    line = lines[idx]
    new_line = re.sub(r'(\(|,\s*)\b' + re.escape(var) + r'\b(\s*[),=])',
                      r'\1_' + var + r'\2', line, count=1)
    if new_line != line:
        lines[idx] = new_line
        return True, lines
    return False, lines


def _update_callers(filepath, old, new):
    """Replace old with new everywhere in file."""
    with open(filepath, 'r') as f:
        content = f.read()
    new_content = re.sub(r'\b' + re.escape(old) + r'\b', new, content)
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
                fixes_by_file.setdefault(fpath, []).append((m['line'], m['column'], var, msg))

    total_applied = 0
    total_failed = 0
    for fpath, fixes in fixes_by_file.items():
        # Group fixes by line to avoid index shift issues
        unique_lines = sorted(set((line_no, col, var, msg) for line_no, col, var, msg in fixes),
                              key=lambda x: (-x[0], -x[1]))

        # Apply fixes one at a time, re-reading the file
        for line_no, col, var, msg in unique_lines:
            idx = line_no - 1
            with open(fpath, 'r') as f:
                lines = f.readlines()

            if idx >= len(lines):
                continue
            line = lines[idx]

            # Decide fix strategy based on line content
            is_import = re.match(r'\s*import\b', line) is not None
            is_arg = 'Allowed unused args' in msg

            if is_import:
                ok, new_lines = fix_import_line(fpath, idx, var)
            elif is_arg:
                ok, new_lines = fix_function_arg(fpath, idx, var)
            else:
                ok, new_lines = fix_assignment_line(fpath, idx, var)

            if ok:
                # Write back if changed
                with open(fpath, 'w') as f:
                    f.writelines(new_lines)
                total_applied += 1
            else:
                total_failed += 1
                fname = os.path.basename(fpath)
                print(f"  [FAIL] {fname}:{line_no}:{col} {var} - line: {line.strip()[:80]}")

    print(f"\nTotal applied: {total_applied}")
    print(f"Total failed: {total_failed}")


if __name__ == '__main__':
    main()
