import os

# 🔧 CONFIG
OUTPUT_FILE = "combined_code.txt"

IGNORE_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    ".next",
    "venv"
}

ALLOWED_EXTENSIONS = {
    ".js", ".ts", ".jsx", ".tsx",
    ".py", ".html", ".css",
    ".json", ".md"
}


def is_valid_file(filename):
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)


def collect_code(base_path):
    combined = []

    for root, dirs, files in os.walk(base_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            if is_valid_file(file):
                file_path = os.path.abspath(os.path.join(root, file))

                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                    # 🔥 STRONG HEADER (always at top of each file block)
                    header = (
                        "\n\n"
                        + "=" * 100 + "\n"
                        + f"FILE NAME : {file}\n"
                        + f"FILE PATH : {file_path}\n"
                        + "=" * 100 + "\n\n"
                    )

                    combined.append(header + content)

                except Exception as e:
                    print(f"Skipped {file_path}: {e}")

    return "".join(combined)


if __name__ == "__main__":
    project_path = os.getcwd()

    print("Collecting code from project...")
    result = collect_code(project_path)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(result)

    print(f"\n✅ Done! Output saved in: {OUTPUT_FILE}")