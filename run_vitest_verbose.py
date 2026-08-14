import subprocess

result = subprocess.run(
    ["npx", "vitest", "run", "--reporter=verbose"],
    capture_output=True, text=True, cwd="/workspace/projects/InvestmentLineNotify",
    timeout=180
)

output = result.stdout + "\n" + result.stderr
print("EXIT CODE:", result.returncode)

# Find worker errors
lines = output.split('\n')
for i, line in enumerate(lines):
    if 'Worker' in line and ('error' in line.lower() or 'crash' in line.lower() or 'exited' in line.lower()):
        print(f"LINE {i}: {line}")

# Show last 50 lines
print("\n=== LAST 50 LINES ===")
for line in lines[-50:]:
    print(line)
