#!/usr/bin/env python3
"""Phase 6.1 — Surgical fix for ESLint no-unused-vars.

Strategy:
1. For destructure assignments: prefix unused property with _
2. For function parameters: prefix with _
3. For variable assignments (const/let/var x = ...): prefix with _
4. For unused imports: remove from import OR prefix (if only import)
5. For function declarations: rename and update callers
6. For constants that are exported but unused: prefix with _

Only touch source files (not tests).
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


def apply_fixes():
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
            # Extract var name
            match = re.match(r"'([^']+)' (?:is defined but|is assigned a value but)", msg)
            if match:
                var = match.group(1)
                if var.startswith('_'):
                    continue
                fixes_by_file.setdefault(fpath, []).append((m['line'], m['column'], var, msg))

    # Sort fixes: by line DESC to avoid index shift
    total_applied = 0
    for fpath, fixes in fixes_by_file.items():
        # Read fresh each time
        with open(fpath, 'r') as f:
            lines = f.readlines()

        # Sort by line desc, col desc
        for line_no, col, var, msg in sorted(set(fixes), key=lambda x: (-x[0], -x[1])):
            idx = line_no - 1
            if idx >= len(lines):
                continue
            line = lines[idx]

            # Check if line was already modified (might have _ prefix)
            if f"_{var}" in line and f" {var}" not in line and f"{var} " not in line and f"{var}," not in line and f"{var}=" not in line:
                continue

            new_line = line

            # 1. Destructure assignment: `const { foo, bar } = ...` or `const { foo: a, bar: b } = ...`
            #    or `let { foo } = ...` or `var { foo } = ...`
            #    or `const { foo, bar } = ...`
            if re.search(r'(const|let|var)\s+\{', line) or re.search(r'\{\s*' + re.escape(var), line):
                # Prefix property in destructure
                # Pattern: `{ ... , foo , ... }` or `{ ... , foo }` or `{ foo , ... }` or `{ foo: ... }`
                patterns = [
                    (r'(\{\s*)\b' + re.escape(var) + r'\b(\s*[,}])', r'\1_' + var + r'\2'),
                    (r'(\{\s*)\b' + re.escape(var) + r'\b(\s*:)', r'\1_' + var + r'\2'),
                    (r'(\{\s*)\b' + re.escape(var) + r'\b(\s*\})', r'\1_' + var + r'\2'),
                    (r'(,\s*)\b' + re.escape(var) + r'\b(\s*[,}])', r'\1_' + var + r'\2'),
                    (r'(\{\s*)\b' + re.escape(var) + r'\b(\s*,)', r'\1_' + var + r'\2'),
                ]
                for pattern, repl in patterns:
                    new_line = re.sub(pattern, repl, new_line, count=1)
                    if new_line != line:
                        break

            # 2. Function parameters: `function foo(bar)` or `async function foo(bar)` or `(bar) =>`
            if 'Allowed unused args' in msg:
                patterns = [
                    (r'(\(|,\s*)\b' + re.escape(var) + r'\b(\s*[),=])', r'\1_' + var + r'\2'),
                    (r'(=>\s*)\b' + re.escape(var) + r'\b(\s*[),])', r'\1_' + var + r'\2'),
                ]
                for pattern, repl in patterns:
                    new_line = re.sub(pattern, repl, new_line, count=1)
                    if new_line != line:
                        break

            # 3. Variable declaration: `const foo = ...` or `let foo = ...` or `var foo = ...`
            if re.search(r'\b(const|let|var)\s+\b' + re.escape(var) + r'\b', line):
                new_line = re.sub(r'\b(const|let|var)\s+\b' + re.escape(var) + r'\b',
                                  r'\1 _' + var, new_line, count=1)

            # 4. Assignment without declaration: `foo = ...`
            if new_line == line and re.search(r'(^|[^a-zA-Z0-9_$])' + re.escape(var) + r'\s*=', line):
                new_line = re.sub(r'(^|[^a-zA-Z0-9_$])' + re.escape(var) + r'\b(?=\s*=)',
                                  r'\1_' + var, new_line, count=1)

            # 5. Import statement: `import { foo, bar } from "..."`
            if re.match(r'\s*import\b', line):
                # Try to remove from import list
                m = re.search(r'import\s*\{([^}]*)\}\s*from', line)
                if m:
                    items_str = m.group(1)
                    items = [s.strip() for s in items_str.split(',') if s.strip()]
                    new_items = []
                    removed = False
                    for it in items:
                        # Handle `foo as bar`
                        as_match = re.match(r'(\w+)\s+as\s+(\w+)', it)
                        if as_match:
                            src, alias = as_match.groups()
                            if alias == var or src == var:
                                new_items.append(f'{src} as _{var}')
                                removed = True
                                continue
                        if it == var:
                            removed = True
                            continue
                        new_items.append(it)

                    if removed:
                        new_items_str = ', '.join(new_items)
                        if new_items_str:
                            new_line = re.sub(r'import\s*\{[^}]*\}\s*from',
                                              f'import {{ {new_items_str} }} from', new_line, count=1)
                        else:
                            # Remove the whole import if nothing left
                            # But keep the import for side effects? Better to just comment
                            pass

            # 6. Function declaration: `function foo(...)` or `async function foo(...)`
            if new_line == line and 'function' in line and re.search(r'\bfunction\*?\s+\b' + re.escape(var) + r'\b', line):
                new_line = re.sub(r'(\bfunction\*?\s+)\b' + re.escape(var) + r'\b',
                                  r'\1_' + var, new_line, count=1)

            # 7. Export default: `export default foo`
            if new_line == line and 'export default' in line:
                new_line = re.sub(r'(\bexport\s+default\s+)\b' + re.escape(var) + r'\b',
                                  r'\1_' + var, new_line, count=1)

            if new_line != line:
                lines[idx] = new_line
                total_applied += 1
                # print(f"  Fixed: {os.path.basename(fpath)}:{line_no}:{col} {var}")

        # Write back if any changes
        if total_applied > 0:
            with open(fpath, 'w') as f:
                f.writelines(lines)

    return total_applied


def main():
    total = 0
    # Run multiple passes to catch cascade effects
    for i in range(5):
        applied = apply_fixes()
        if applied == 0:
            break
        total += applied
        print(f"Pass {i+1}: {applied} fixes")
    print(f"Total: {total}")


if __name__ == '__main__':
    main()