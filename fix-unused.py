#!/usr/bin/env python3
"""Phase 6.1 — Bulk-prefix unused variables with underscore based on ESLint output."""

import json
import re
import subprocess
import sys
import os

# Get warnings
result = subprocess.run(
    ["npx", "eslint", "src/", "--format=json"],
    capture_output=True, text=True, cwd="/workspace/projects/InvestmentLineNotify",
    timeout=60
)
data = json.loads(result.stdout)

# Group by file
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
            # Skip already-prefixed
            if var.startswith('_'):
                continue
            fixes_by_file.setdefault(fpath, []).append((m['line'], m['column'], var))

# Apply fixes: rename `const foo` -> `const _foo` at given line/col
# Read each file and replace line by line
total_applied = 0
for fpath, fixes in fixes_by_file.items():
    with open(fpath, 'r') as f:
        lines = f.readlines()

    # Sort fixes by line desc to preserve line numbers
    fixes_sorted = sorted(set(fixes), key=lambda x: (-x[0], -x[1]))

    for line_no, col, var in fixes_sorted:
        idx = line_no - 1
        if idx >= len(lines):
            continue
        line = lines[idx]

        # Try to find the variable declaration and prefix with _
        # Patterns:
        #   const { foo, bar } = ...   (destructure)
        #   const foo = ...
        #   let foo = ...
        #   var foo = ...
        #   function foo(...)
        #   async function foo(...)
        #   foo: function() ...
        #   export const foo = ...
        #   export function foo(...)

        # Replace destructure: `const { foo,` -> `const { _foo,`
        # Replace declaration: `const foo =` -> `const _foo =`
        # Replace function name: `function foo(` -> `function _foo(`

        replacements = [
            (r'\b(const|let|var)\s+\b' + re.escape(var) + r'\b', r'\1 _' + var),
            (r'\bfunction\s+\b' + re.escape(var) + r'\b', r'function _' + var),
            (r'\b(async\s+function)\s+\b' + re.escape(var) + r'\b', r'\1 _' + var),
            (r'\b(export\s+(?:default\s+)?(?:async\s+)?function)\s+\b' + re.escape(var) + r'\b', r'\1 _' + var),
            (r'\b(export\s+default)\s+\b' + re.escape(var) + r'\b', r'\1 _' + var),
        ]

        applied = False
        for pattern, replacement in replacements:
            new_line, n = re.subn(pattern, replacement, line, count=1)
            if n > 0:
                lines[idx] = new_line
                applied = True
                total_applied += 1
                break

        if not applied:
            # Try destructure inside {}
            # Look for `, foo` or `{ foo` or `{foo,` or `,foo,` etc.
            destructure_patterns = [
                (r'(\{[^}]*?)\b' + re.escape(var) + r'\b([^}]*?\})', r'\1_' + var + r'\2'),
            ]
            for pattern, replacement in destructure_patterns:
                new_line, n = re.subn(pattern, replacement, line, count=1)
                if n > 0:
                    lines[idx] = new_line
                    applied = True
                    total_applied += 1
                    break

        if not applied:
            print(f"  [WARN] Could not fix in {os.path.basename(fpath)}:{line_no}: {var}", file=sys.stderr)

    with open(fpath, 'w') as f:
        f.writelines(lines)

print(f"Total fixes applied: {total_applied}")
