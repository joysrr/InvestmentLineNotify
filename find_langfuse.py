import subprocess
import os
import re

# Find all source files that import langfuse directly
result = subprocess.run(
    ["grep", "-rn", "--include=*.mjs", "--include=*.js",
     "-l", "from ['\"]langfuse", "src/"],
    capture_output=True, text=True, cwd="/workspace/projects/InvestmentLineNotify"
)
direct_importers = set(result.stdout.strip().split('\n'))
print("=== Direct importers of langfuse ===")
for f in sorted(direct_importers):
    print(f)
print(f"Total: {len(direct_importers)} files")

# Find files that import aiClient (which transitively imports langfuse
result2 = subprocess.run(
    ["grep", "-rn", "--include=*.mjs", "--include=*.js",
     "-l", "from ['\"][^'\"]*aiClient", "src/"],
    capture_output=True, text=True, cwd="/workspace/projects/InvestmentLineNotify"
)
aiclient_importers = set(result2.stdout.strip().split('\n'))
print(f"\n=== Files importing aiClient (transitive langfuse): {len(aiclient_importers)} ===")

# Find test files importing these
test_files_needing_mock = set()
for f in aiclient_importers:
    basename = os.path.basename(f).replace('.mjs', '')
    result3 = subprocess.run(
        ["grep", "-rln", "--include=*.test.mjs", "--include=*.test.js",
         f"from .*{basename}", "src/test/"],
        capture_output=True, text=True, cwd="/workspace/projects/InvestmentLineNotify"
    )
    if result3.stdout.strip():
        for tf in result3.stdout.strip().split('\n'):
            test_files_needing_mock.add(tf)

print(f"\n=== Test files importing aiClient transitively: {len(test_files_needing_mock)} ===")
for f in sorted(test_files_needing_mock):
    print(f)

# Check which of these already have vi.mock("langfuse")
print(f"\n=== Check vi.mock('langfuse') coverage ===")
for f in sorted(test_files_needing_mock):
    with open(f) as fh:
        content = fh.read()
    has_mock = bool(re.search(r'vi\.mock\(["\']langfuse["\']', content))
    print(f"{'OK' if has_mock else 'NEED MOCK':6} {f}")
